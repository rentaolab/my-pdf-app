'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages, renderSinglePDFPageHighRes } from '@/lib/pdf-edit';
import { bakeEditsToPDF, FabricCanvasJSON } from '@/lib/pdf-edit-content';
import * as fabric from 'fabric';
import {
  Upload, Download, Loader2, Type, Square, Circle, MoveRight,
  Highlighter, PenTool, Trash2, ChevronLeft, ChevronRight, X,
  Check, Copy, Clipboard, ZoomIn, ZoomOut, Minus
} from 'lucide-react';

/** 仅描述本组件需要读取的样式字段，避免使用 any */
type StyleSource = {
  fill?: unknown;
  stroke?: unknown;
  strokeWidth?: unknown;
  fontSize?: unknown;
};

export default function PdfEditTool() {
  const t = useTranslations('PdfEdit');
  const tCommon = useTranslations('Common');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [highResBg, setHighResBg] = useState<string>('');
  
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 500, height: 680 });

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pageFabricMap, setPageFabricMap] = useState<{ [key: number]: FabricCanvasJSON }>({});
  
  // 荧光笔画笔激活状态控制
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightColor, setHighlightColor] = useState('rgba(254, 240, 138, 0.5)'); // 默认半透明荧光黄

  const clipboardRef = useRef<fabric.Object | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [objectStyle, setObjectStyle] = useState({
    fill: '#1E293B', stroke: '#EF4444', strokeWidth: 2, fontSize: 20,
  });

  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);

  const [showSignModal, setShowSignModal] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  // 落笔状态用 ref 承载：Pointer 事件跨重渲染读取，避免丢失起始笔画
  const isSigningRef = useRef(false);

  const syncObjectStyleToUI = (obj: StyleSource | null | undefined) => {
    if (!obj) return;
    setObjectStyle({
      fill: obj.fill === 'transparent' ? '#FFFFFF' : (obj.fill as string) || '#1E293B',
      stroke: (obj.stroke as string) || '#EF4444',
      strokeWidth: (obj.strokeWidth as number) || 2,
      fontSize: (obj.fontSize as number) || 20,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    if (selected.type !== 'application/pdf') return alert(tCommon('errors.uploadPdf'));
    setFile(selected);
    e.target.value = '';
  };

  useEffect(() => {
    if (!file) return;
    async function loadPDF() {
      if (!file) return;
      try {
        setIsLoading(true);
        const images = await renderPDFToImages(file);
        setThumbnails(images);
        setActivePageIndex(0);
      } catch (err) {
        alert(tCommon('errors.parsePdf'));
      } finally {
        setIsLoading(false);
      }
    }
    loadPDF();
  }, [file]);

  useEffect(() => {
    if (!file || thumbnails.length === 0) return;
    let isMounted = true;

    // 在异步函数内触发 loading，避免在 effect 主体同步 setState；
    // await 之前仍同步执行，行为与原来一致。
    const loadHighResPage = async () => {
      setIsLoading(true);
      try {
        const imgUrl = await renderSinglePDFPageHighRes(file, activePageIndex);
        if (isMounted) {
          setHighResBg(imgUrl);
          
          const img = new Image();
          img.src = imgUrl;
          img.onload = () => {
            const aspect = img.naturalHeight / img.naturalWidth;
            const computedWidth = 500;
            const computedHeight = Math.round(500 * aspect);
            setPageSize({ width: computedWidth, height: computedHeight });
            setIsLoading(false);
          };
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };

    loadHighResPage();

    return () => { isMounted = false; };
  }, [file, activePageIndex, thumbnails]);

  const applyReeffStyle = (obj: fabric.Object) => {
    obj.set({
      transparentCorners: false, cornerColor: '#FFFFFF', cornerStrokeColor: '#EF4444',
      borderColor: '#EF4444', cornerStyle: 'circle', cornerSize: 8,
      borderDashArray: [4, 4], borderScaleFactor: 1.5, padding: 4,
    });
  };

  const handlePageChange = (newIdx: number) => {
    if (newIdx === activePageIndex) return;
    if (fabricCanvasRef.current) {
      const json = fabricCanvasRef.current.toJSON();
      json.pageSize = pageSize;
      setPageFabricMap((prev) => ({ ...prev, [activePageIndex]: json }));
    }
    setSelectedObject(null);
    setIsHighlighting(false);
    setActivePageIndex(newIdx);
  };

  // 必须定义在下面的 useEffect 之前：该 effect 注册的 canvas 事件回调会调用它
  const saveCanvasState = () => {
    if (!fabricCanvasRef.current) return;
    const json = fabricCanvasRef.current.toJSON();
    json.pageSize = pageSize;
    setPageFabricMap((prev) => ({ ...prev, [activePageIndex]: json }));
  };

  useEffect(() => {
    if (!highResBg || !canvasElementRef.current) return;

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width: pageSize.width * zoomLevel,
      height: pageSize.height * zoomLevel,
      selection: !isHighlighting,
      controlsAboveOverlay: true,
      enableRetinaScaling: true,
    });
    
    canvas.setZoom(zoomLevel);
    fabricCanvasRef.current = canvas;

    // 💡 笔刷模式 + 去手抖采样平滑
    canvas.isDrawingMode = isHighlighting;
    if (isHighlighting) {
      const brush = new fabric.PencilBrush(canvas);
      brush.width = 18 * zoomLevel;
      brush.color = highlightColor;
      brush.strokeLineCap = 'square';
      // 去抖动采样阀门：平滑过滤离散手抖点
      brush.decimate = 6 * zoomLevel;
      canvas.freeDrawingBrush = brush;
    }

    if (pageFabricMap[activePageIndex]) {
      canvas.loadFromJSON(pageFabricMap[activePageIndex]).then(() => {
        canvas.getObjects().forEach((obj) => applyReeffStyle(obj));
        canvas.requestRenderAll();
      });
    }

    // 💡 智能直线矫正逻辑：自动识别划线动作并强制重置为绝对水平直线条
    canvas.on('path:created', (e: { path: fabric.Path }) => {
      const pathObj = e.path;
      if (!pathObj || !fabricCanvasRef.current) return;

      // fabric 的 path 指令元组类型过严，这里按坐标数组使用（实际只读取数字坐标）
      const pathData = pathObj.path as unknown as number[][]; // SVG Path 指令数组 [['M', x1, y1], ['Q', ...], ...]
      if (pathData && pathData.length > 0) {
        const startPoint = pathData[0];
        const endPoint = pathData[pathData.length - 1];

        const startX = startPoint[1];
        const startY = startPoint[2];
        const endX = endPoint[endPoint.length - 2] || startX;
        const endY = endPoint[endPoint.length - 1] || startY;

        const deltaX = Math.abs(endX - startX);
        const deltaY = Math.abs(endY - startY);

        // 如果用户滑动距离超过 20px 且 Y 轴垂直偏移小于 18px，判定为水平高亮划线动作
        if (deltaX > 20 && deltaY < 18 * zoomLevel) {
          const strokeWidth = pathObj.strokeWidth || 18;
          const strokeColor = pathObj.stroke || highlightColor;

          // 移除刚才手抖的自由贝塞尔 Path，替换为矫正后的绝对水平线
          fabricCanvasRef.current.remove(pathObj);

          const avgY = (startY + endY) / 2;
          const straightLine = new fabric.Line([startX, avgY, endX, avgY], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeLineCap: 'square',
          });

          applyReeffStyle(straightLine);
          fabricCanvasRef.current.add(straightLine);
          fabricCanvasRef.current.requestRenderAll();
          saveCanvasState();
          return;
        }
      }

      applyReeffStyle(pathObj);
      saveCanvasState();
    });

    canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0] ?? null);
      syncObjectStyleToUI(e.selected?.[0]);
    });
    canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0] ?? null);
      syncObjectStyleToUI(e.selected?.[0]);
    });
    canvas.on('selection:cleared', () => setSelectedObject(null));
    canvas.on('object:modified', (e) => {
      syncObjectStyleToUI(e.target);
      saveCanvasState();
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [activePageIndex, highResBg, pageSize, isHighlighting, highlightColor]);

  const toggleHighlightMode = () => {
    setIsHighlighting((prev) => !prev);
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.discardActiveObject();
      fabricCanvasRef.current.requestRenderAll();
    }
  };

  const addTextbox = () => {
    setIsHighlighting(false);
    if (!fabricCanvasRef.current) return;
    const text = new fabric.Textbox(t('defaultText'), {
      left: 50, top: 50, fontSize: 20, fill: '#1E293B', fontFamily: 'Helvetica',
    });
    applyReeffStyle(text);
    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    saveCanvasState();
  };

  const addRectangle = () => {
    setIsHighlighting(false);
    if (!fabricCanvasRef.current) return;
    const rect = new fabric.Rect({
      left: 50, top: 50, width: 120, height: 40,
      fill: '#FFFFFF', stroke: '#E2E8F0',
      strokeWidth: 1, rx: 4, ry: 4,
    });
    applyReeffStyle(rect);
    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect);
    saveCanvasState();
  };

  const addCircle = () => {
    setIsHighlighting(false);
    if (!fabricCanvasRef.current) return;
    const circle = new fabric.Circle({
      left: 100, top: 100, radius: 40, fill: 'transparent', stroke: '#EF4444', strokeWidth: 2,
    });
    applyReeffStyle(circle);
    fabricCanvasRef.current.add(circle);
    fabricCanvasRef.current.setActiveObject(circle);
    saveCanvasState();
  };

  const addArrow = () => {
    setIsHighlighting(false);
    if (!fabricCanvasRef.current) return;
    const arrowPath = new fabric.Path('M 0 0 L 100 0 M 85 -8 L 100 0 L 85 8', {
      left: 100, top: 100, stroke: '#EF4444', strokeWidth: 3, fill: 'transparent',
      strokeLineCap: 'round', strokeLineJoin: 'round',
    });
    applyReeffStyle(arrowPath);
    fabricCanvasRef.current.add(arrowPath);
    fabricCanvasRef.current.setActiveObject(arrowPath);
    saveCanvasState();
  };

  const addLine = () => {
    setIsHighlighting(false);
    if (!fabricCanvasRef.current) return;
    const line = new fabric.Line([50, 50, 200, 50], {
      stroke: '#EF4444', strokeWidth: 2, strokeLineCap: 'round',
    });
    applyReeffStyle(line);
    fabricCanvasRef.current.add(line);
    fabricCanvasRef.current.setActiveObject(line);
    fabricCanvasRef.current.requestRenderAll();
    saveCanvasState();
  };

  const copySelected = async () => {
    if (!fabricCanvasRef.current) return;
    const active = fabricCanvasRef.current.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    clipboardRef.current = cloned;
  };

  const pasteClipboard = async () => {
    if (!fabricCanvasRef.current || !clipboardRef.current) return;
    const clonedObj = await clipboardRef.current.clone();
    fabricCanvasRef.current.discardActiveObject();
    
    clonedObj.set({ left: clonedObj.left + 15, top: clonedObj.top + 15, evented: true });
    applyReeffStyle(clonedObj);

    if (clonedObj.type === 'activeSelection') {
      // forEachObject / setCoordinates 仅存在于 ActiveSelection 上
      const activeSelection = clonedObj as fabric.ActiveSelection;
      activeSelection.canvas = fabricCanvasRef.current;
      activeSelection.forEachObject((obj: fabric.Object) => {
        applyReeffStyle(obj);
        fabricCanvasRef.current?.add(obj);
      });
      // 注：fabric v7 的 ActiveSelection 已移除 setCoordinates()，多选边界由内部自动重算
    } else {
      fabricCanvasRef.current.add(clonedObj);
    }
    clipboardRef.current.top += 10;
    clipboardRef.current.left += 10;
    fabricCanvasRef.current.setActiveObject(clonedObj);
    fabricCanvasRef.current.requestRenderAll();
    saveCanvasState();
  };

  const deleteActiveObject = () => {
    if (!fabricCanvasRef.current) return;
    const active = fabricCanvasRef.current.getActiveObject();
    if (active) {
      fabricCanvasRef.current.remove(active);
      setSelectedObject(null);
      saveCanvasState();
    }
  };

  const openSignModal = () => {
    isSigningRef.current = false;
    setShowSignModal(true);
  };

  const closeSignModal = () => {
    isSigningRef.current = false; // 关闭弹窗时重置落笔状态，避免残留
    setShowSignModal(false);
  };

  /** 屏幕坐标 → 画布内部像素：移动端画布被 CSS 等比缩小时仍能笔笔对位 */
  const getSignPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  /** 空签名校验：画布上无任何非透明像素时视为未落笔 */
  const isSignatureBlank = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false; // 存在非透明像素即有笔迹
    }
    return true;
  };

  // 签名板统一使用 Pointer Events：同一套代码覆盖手指 / 触控笔 / 鼠标
  const startSigning = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId); // 手指滑出画布也不断笔
    isSigningRef.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSignPoint(canvas, e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigningRef.current) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSignPoint(canvas, e.clientX, e.clientY);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0F172A';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endSigning = () => { isSigningRef.current = false; };

  const saveSignature = async () => {
    const canvas = signCanvasRef.current;
    if (!canvas || !fabricCanvasRef.current) return;
    if (isSignatureBlank(canvas)) return; // 未落笔：不插入空白透明图片
    const dataUrl = canvas.toDataURL('image/png');

    try {
      const img = await fabric.Image.fromURL(dataUrl);
      img.scale(0.5);
      img.set({ left: 100, top: 100 });
      applyReeffStyle(img);
      fabricCanvasRef.current.add(img);
      fabricCanvasRef.current.setActiveObject(img);
      fabricCanvasRef.current.requestRenderAll();
      saveCanvasState();
    } catch (err) {
      console.error('Failed to insert signature:', err);
    }

    closeSignModal();
  };

  const handleZoom = (type: 'in' | 'out') => {
    const nextZoom = type === 'in' ? Math.min(2.5, zoomLevel + 0.2) : Math.max(0.6, zoomLevel - 0.2);
    setZoomLevel(nextZoom);

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setZoom(nextZoom);
      fabricCanvasRef.current.setDimensions({
        width: pageSize.width * nextZoom,
        height: pageSize.height * nextZoom
      });
    }
  };

  const handleExport = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      
      const updatedMap = { ...pageFabricMap };

      if (fabricCanvasRef.current) {
        const currentJson = fabricCanvasRef.current.toJSON();
        currentJson.pageSize = pageSize;
        updatedMap[activePageIndex] = currentJson;
      }

      for (const pageIdxStr of Object.keys(updatedMap)) {
        const pIdx = parseInt(pageIdxStr, 10);
        const pData = updatedMap[pIdx];

        if (pData && pData.objects && pData.objects.length > 0) {
          const tempCanvasEl = document.createElement('canvas');
          const pWidth = pData.pageSize?.width || 500;
          const pHeight = pData.pageSize?.height || 680;

          const tempCanvas = new fabric.Canvas(tempCanvasEl, {
            width: pWidth,
            height: pHeight,
          });

          await tempCanvas.loadFromJSON(pData);
          tempCanvas.renderAll();

          const pngUrl = tempCanvas.toDataURL({
            format: 'png',
            multiplier: 3,
          });

          pData.canvasDataUrl = pngUrl;
          tempCanvas.dispose();
        }
      }

      const pdfBytes = await bakeEditsToPDF(file, updatedMap);
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = file.name.replace(/\.pdf$/i, '');
      link.download = `${baseName}_edited.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(tCommon('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white hover:border-red-500 transition-colors cursor-pointer relative">
        <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="flex flex-col items-center space-y-3">
          <div className="p-3 bg-red-50 rounded-full text-red-600"><Upload className="w-8 h-8" /></div>
          <div>
            <p className="text-base font-medium text-slate-700">{tCommon('upload.prompt')}</p>
            <p className="text-xs text-slate-500 mt-1">{t('upload.hint')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none pb-12">
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[620px]">
        {/* 吸顶控制栏 */}
        <div className="bg-white px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={addTextbox} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><Type className="w-3.5 h-3.5 text-red-600" /><span>{t('toolbar.text')}</span></button>
            <button onClick={addRectangle} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><Square className="w-3.5 h-3.5 fill-slate-300 text-slate-600" /><span>{t('toolbar.rect')}</span></button>
            
            {/* 自由荧光笔模式开关 */}
            <button
              onClick={toggleHighlightMode}
              className={`flex items-center space-x-1.5 border px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isHighlighting
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/30'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
              title={isHighlighting ? t('toolbar.highlightStopTitle') : t('toolbar.highlightStartTitle')}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>{isHighlighting ? t('toolbar.highlightActive') : t('toolbar.highlighter')}</span>
            </button>

            <button onClick={addCircle} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><Circle className="w-3.5 h-3.5 text-red-600" /><span>{t('toolbar.circle')}</span></button>
            <button onClick={addArrow} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><MoveRight className="w-3.5 h-3.5 text-red-600" /><span>{t('toolbar.arrow')}</span></button>
            <button onClick={addLine} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><Minus className="w-3.5 h-3.5 text-red-600" /><span>{t('toolbar.line')}</span></button>
            <button onClick={openSignModal} className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors"><PenTool className="w-3.5 h-3.5 text-red-600" /><span>{t('toolbar.signature')}</span></button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-slate-50 p-0.5 rounded-xl border border-slate-200">
              <button onClick={copySelected} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors" title={t('toolbar.copy')}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={pasteClipboard} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors" title={t('toolbar.paste')}><Clipboard className="w-3.5 h-3.5" /></button>
              {selectedObject && <button onClick={deleteActiveObject} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('toolbar.deleteElement')}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
              <button onClick={() => handleZoom('out')} className="text-slate-600 hover:text-slate-900"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="text-xs font-bold font-mono text-slate-700">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => handleZoom('in')} className="text-slate-600 hover:text-slate-900"><ZoomIn className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <button onClick={handleExport} disabled={isProcessing} className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95 ml-auto">
            <Download className="w-3.5 h-3.5" />
            <span>{isProcessing ? t('status.exporting') : t('toolbar.save')}</span>
          </button>
        </div>

        {/* 开启荧光笔时的深色精致控制栏 */}
        {isHighlighting && (
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-bold border-b border-slate-800 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 text-[10px]">{t('style.brushColor')}</span>
                <div className="flex items-center space-x-1.5">
                  <button 
                    onClick={() => setHighlightColor('rgba(254, 240, 138, 0.5)')} 
                    className={`w-4 h-4 rounded-full bg-yellow-300 transition-transform ${highlightColor.includes('254, 240, 138') ? 'scale-125 ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'}`} 
                    title={t('colors.yellow')} 
                  />
                  <button 
                    onClick={() => setHighlightColor('rgba(187, 247, 208, 0.5)')} 
                    className={`w-4 h-4 rounded-full bg-emerald-300 transition-transform ${highlightColor.includes('187, 247, 208') ? 'scale-125 ring-2 ring-emerald-400' : 'opacity-70 hover:opacity-100'}`} 
                    title={t('colors.green')} 
                  />
                  <button 
                    onClick={() => setHighlightColor('rgba(254, 205, 211, 0.5)')} 
                    className={`w-4 h-4 rounded-full bg-rose-300 transition-transform ${highlightColor.includes('254, 205, 211') ? 'scale-125 ring-2 ring-rose-400' : 'opacity-70 hover:opacity-100'}`} 
                    title={t('colors.pink')} 
                  />
                  <button 
                    onClick={() => setHighlightColor('rgba(191, 219, 254, 0.5)')} 
                    className={`w-4 h-4 rounded-full bg-sky-300 transition-transform ${highlightColor.includes('191, 219, 254') ? 'scale-125 ring-2 ring-sky-400' : 'opacity-70 hover:opacity-100'}`} 
                    title={t('colors.blue')} 
                  />
                </div>

                <div className="border-l border-slate-700 pl-2 ml-1 flex items-center space-x-1">
                  <span className="text-slate-400 text-[10px]">{t('style.custom')}</span>
                  <input 
                    type="color" 
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.substring(1, 3), 16);
                      const g = parseInt(hex.substring(3, 5), 16);
                      const b = parseInt(hex.substring(5, 7), 16);
                      setHighlightColor(`rgba(${r}, ${g}, ${b}, 0.5)`);
                    }}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                    title={t('colors.customTitle')}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 text-[10px]">{t('style.thickness')}</span>
                <input 
                  type="range" 
                  min="8" 
                  max="50" 
                  defaultValue="18"
                  onChange={(e) => {
                    const size = parseInt(e.target.value, 10);
                    if (fabricCanvasRef.current?.freeDrawingBrush) {
                      fabricCanvasRef.current.freeDrawingBrush.width = size * zoomLevel;
                    }
                  }} 
                  className="w-20 accent-amber-400 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none" 
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-slate-400 text-[11px]">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{t('toolbar.autoStraighten')}</span>
              </div>

              <button 
                onClick={() => setIsHighlighting(false)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-[11px] transition-colors border border-slate-700 flex items-center space-x-1 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('toolbar.exitBrush')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 选中元素时的深色控制栏 */}
        {selectedObject && !isHighlighting && (
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-6 py-2.5 flex flex-wrap items-center space-x-5 text-xs font-bold border-b border-slate-800 animate-in fade-in duration-200">
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono text-[10px] border border-slate-700">
              {selectedObject.type}
            </span>

            {selectedObject.type === 'textbox' && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
                  <button 
                    onClick={() => { 
                      const newSize = Math.max(10, objectStyle.fontSize - 2); 
                      selectedObject.set('fontSize', newSize); 
                      setObjectStyle((prev) => ({ ...prev, fontSize: newSize })); 
                      fabricCanvasRef.current?.requestRenderAll(); 
                      saveCanvasState(); 
                    }} 
                    className="px-2 py-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                  >
                    A-
                  </button>
                  <span className="font-mono px-2 text-amber-400 text-[11px]">{objectStyle.fontSize}pt</span>
                  <button 
                    onClick={() => { 
                      const newSize = Math.min(72, objectStyle.fontSize + 2); 
                      selectedObject.set('fontSize', newSize); 
                      setObjectStyle((prev) => ({ ...prev, fontSize: newSize })); 
                      fabricCanvasRef.current?.requestRenderAll(); 
                      saveCanvasState(); 
                    }} 
                    className="px-2 py-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                  >
                    A+
                  </button>
                </div>

                <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 text-[10px]">{t('style.textColor')}</span>
                  <input 
                    type="color" 
                    value={objectStyle.fill} 
                    onChange={(e) => { 
                      const val = e.target.value; 
                      selectedObject.set('fill', val); 
                      setObjectStyle((prev) => ({ ...prev, fill: val })); 
                      fabricCanvasRef.current?.requestRenderAll(); 
                      saveCanvasState(); 
                    }} 
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent" 
                  />
                </div>
              </div>
            )}

            {(selectedObject.type === 'rect' || selectedObject.type === 'circle' || selectedObject.type === 'line' || selectedObject.type === 'path') && (
              <div className="flex items-center space-x-4">
                {selectedObject.type !== 'line' && (
                  <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                    <span className="text-slate-400 text-[10px]">{t('style.fill')}</span>
                    <input 
                      type="color" 
                      value={objectStyle.stroke} 
                      onChange={(e) => { 
                        const val = e.target.value; 
                        selectedObject.set('stroke', val); 
                        setObjectStyle((prev) => ({ ...prev, stroke: val })); 
                        fabricCanvasRef.current?.requestRenderAll(); 
                        saveCanvasState(); 
                      }} 
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent" 
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 text-[10px]">{t('style.thickness')}</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={objectStyle.strokeWidth} 
                    onChange={(e) => { 
                      const val = parseInt(e.target.value, 10); 
                      selectedObject.set('strokeWidth', val); 
                      setObjectStyle((prev) => ({ ...prev, strokeWidth: val })); 
                      fabricCanvasRef.current?.requestRenderAll(); 
                      saveCanvasState(); 
                    }} 
                    className="w-20 accent-red-500 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none" 
                  />
                  <span className="font-mono text-[11px] text-amber-400 w-4 text-right">{objectStyle.strokeWidth}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 主视口 */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-200/50">
          
          <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
            <div className="flex-1 overflow-y-auto overflow-x-auto p-8 flex justify-center items-start max-h-[calc(100vh-260px)]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center space-y-2 text-red-600 mt-20">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-medium">{t('status.parsingHd')}</span>
                </div>
              ) : (
                <div 
                  className={`relative shadow-2xl rounded bg-white shrink-0 my-2 ${isHighlighting ? 'cursor-crosshair' : ''}`}
                  style={{ width: pageSize.width * zoomLevel, height: pageSize.height * zoomLevel }}
                >
                  <img
                    src={highResBg || thumbnails[activePageIndex]}
                    alt="Edit Page"
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none rounded"
                  />
                  <div className="absolute inset-0">
                    <canvas ref={canvasElementRef} />
                  </div>
                </div>
              )}
            </div>

            {/* 底部悬浮控制条 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-200 z-20">
              <button onClick={() => handlePageChange(Math.max(0, activePageIndex - 1))} disabled={activePageIndex === 0} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-700 px-2">
                P. {activePageIndex + 1} / {thumbnails.length}
              </span>
              <button onClick={() => handlePageChange(Math.min(thumbnails.length - 1, activePageIndex + 1))} disabled={activePageIndex === thumbnails.length - 1} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 右侧单列页面列表 */}
          <div className="w-full md:w-64 bg-white p-4 border-l border-slate-200/80 shadow-sm flex flex-col shrink-0 z-10 max-h-[calc(100vh-260px)] overflow-y-auto">
            <div className="pb-2 border-b border-slate-100 mb-3 shrink-0">
              <span className="text-xs font-bold text-slate-800">{t('pages.title')}</span>
            </div>
            <div className="space-y-2.5 pr-1">
              {thumbnails.map((src, idx) => {
                const isActive = activePageIndex === idx;
                return (
                  <div key={idx} onClick={() => handlePageChange(idx)} className={`relative bg-slate-50 p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${isActive ? 'border-2 border-red-600 bg-red-50/20 shadow-sm' : 'border-slate-200/80'}`}>
                    <div className="text-[10px] font-mono font-bold text-slate-500 mb-1">P.{idx + 1}</div>
                    <img src={src} alt="" className="w-full h-20 object-contain pointer-events-none" />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 手写签名 Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{t('modal.signatureTitle')}</h3>
              <button onClick={closeSignModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-center">
              <canvas
                ref={signCanvasRef}
                width={360}
                height={160}
                onPointerDown={startSigning}
                onPointerMove={drawSign}
                onPointerUp={endSigning}
                onPointerCancel={endSigning}
                className="block w-full max-w-[360px] h-auto touch-none bg-white rounded border border-slate-300 cursor-crosshair"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => { const canvas = signCanvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); } }} className="text-xs font-bold text-slate-500 hover:text-slate-800">{t('modal.clearSignature')}</button>
              <div className="flex space-x-2">
                <button onClick={closeSignModal} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">{tCommon('actions.cancel')}</button>
                <button onClick={saveSignature} className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold rounded-lg shadow-sm"><Check className="w-3.5 h-3.5" /><span>{t('modal.applySignature')}</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}