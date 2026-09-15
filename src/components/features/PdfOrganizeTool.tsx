'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { crossMergePDFPages, SelectedPageItem } from '@/lib/pdf-cross-merge';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Upload,
  Download,
  RefreshCw,
  Plus,
  RotateCw,
  Layers,
  FileText,
  GripHorizontal,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Maximize2,
  Minimize2,
  CheckSquare,
  Square,
  Sliders,
  ListTree,
  FolderOpen,
  Undo2,
  Redo2,
  FilePlus,
  Binary,
} from 'lucide-react';

interface PdfOutlineNode {
  title: string;
  pageIndex: number;
  items?: PdfOutlineNode[];
}

interface HistorySnapshot {
  basketItems: SelectedPageItem[];
  selectedSourcePages: number[];
}

// 辅助纯函数：解析 "1-5, 8, 12-20" 页码表达式
function parsePageRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(/[,，]/);

  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        start = Math.max(1, Math.min(start, maxPage));
        end = Math.max(1, Math.min(end, maxPage));
        const min = Math.min(start, end);
        const max = Math.max(start, end);

        for (let i = min; i <= max; i++) {
          pages.add(i - 1);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPage) {
        pages.add(num - 1);
      }
    }
  });

  return Array.from(pages).sort((a, b) => a - b);
}

// 辅助纯函数：创建空白 A4 图片
function createBlankPageDataUrl(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 595;
  canvas.height = 842;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  return canvas.toDataURL('image/png');
}

/** 暂存篮条目 ID（放在模块作用域，避免在渲染期调用 Date.now / Math.random） */
const createBasketItemId = (fileIndex: number, pageIndex: number) =>
  `file-${fileIndex}-page-${pageIndex}-${Date.now()}-${Math.random()}`;

/** pdf.js 内部引用对象（仅用于 getPageIndex），避免使用 any */
type PdfRefLike = { num: number; gen: number };

/** pdf.js 书签节点（仅描述本组件用到的字段） */
type RawOutlineNode = {
  title: string;
  dest?: string | PdfRefLike[] | null;
  items?: RawOutlineNode[];
};

export default function PdfOrganizeTool() {
  const t = useTranslations('PdfOrganize');
  const tCommon = useTranslations('Common');
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [fileThumbnails, setFileThumbnails] = useState<{ [key: number]: string[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // 💡 微调 3：暂存篮默认折叠 (collapsed) + 呼吸动画 Trigger
  const [basketItems, setBasketItems] = useState<SelectedPageItem[]>([]);
  const [basketState, setBasketState] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [activeBasketIndex, setActiveBasketIndex] = useState<number | null>(null);
  const [basketPulseTrigger, setBasketPulseTrigger] = useState(false); // 呼吸气泡控制

  // 多选与高级工具栏
  const [selectedSourcePages, setSelectedSourcePages] = useState<number[]>([]);
  const [lastSelectedSourceIndex, setLastSelectedSourceIndex] = useState<number | null>(null);
  const [showAdvancedBar, setShowAdvancedBar] = useState(false);
  const [pageRangeInput, setPageRangeInput] = useState('');

  // 目录 Modal
  const [showOutlineModal, setShowOutlineModal] = useState(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineNode[]>([]);
  const [isParsingOutline, setIsParsingOutline] = useState(false);

  // 预览状态
  const [activeHoverImage, setActiveHoverImage] = useState<string | null>(null);
  const [activeHoverRotation, setActiveHoverRotation] = useState<number>(0);
  const [activeHoverLabel, setActiveHoverLabel] = useState<string>('');
  const [activeHoverPageIdx, setActiveHoverPageIdx] = useState<number | null>(null);

  // 拖拽与文件名 Modal
  const [draggedBasketIndex, setDraggedBasketIndex] = useState<number | null>(null);
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [customFilename, setCustomFilename] = useState('');

  // 撤销/重做 栈管理
  const historyStackRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 触发呼吸气泡动画的短定时器
  const triggerBasketPulse = () => {
    setBasketPulseTrigger(true);
    setTimeout(() => setBasketPulseTrigger(false), 1200);
  };

  const pushSnapshot = useCallback(() => {
    const snapshot: HistorySnapshot = {
      basketItems: JSON.parse(JSON.stringify(basketItems)),
      selectedSourcePages: [...selectedSourcePages],
    };

    const nextStack = historyStackRef.current.slice(0, historyIndexRef.current + 1);
    nextStack.push(snapshot);
    if (nextStack.length > 30) nextStack.shift();

    historyStackRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, [basketItems, selectedSourcePages]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snap = historyStackRef.current[historyIndexRef.current];
    if (snap) {
      setBasketItems(snap.basketItems);
      setSelectedSourcePages(snap.selectedSourcePages);
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyStackRef.current.length - 1);
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyStackRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyStackRef.current[historyIndexRef.current];
    if (snap) {
      setBasketItems(snap.basketItems);
      setSelectedSourcePages(snap.selectedSourcePages);
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyStackRef.current.length - 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter((f) => f.type === 'application/pdf');
    if (selected.length === 0) return;

    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  useEffect(() => {
    if (files.length === 0 || !files[activeFileIndex]) return;

    async function loadCurrentThumbnails() {
      if (fileThumbnails[activeFileIndex]) return;

      try {
        setIsLoading(true);
        const images = await renderPDFToImages(files[activeFileIndex]);

        setFileThumbnails((prev) => ({
          ...prev,
          [activeFileIndex]: images,
        }));

        if (images.length > 0 && !activeHoverImage) {
          setActiveHoverImage(images[0]);
          setActiveHoverLabel(t('hover.pageWithFile', { page: 1, name: files[activeFileIndex].name }));
          setActiveHoverPageIdx(0);
        }
      } catch (err) {
        alert(tCommon('errors.parsePdf'));
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentThumbnails();
  }, [files, activeFileIndex, fileThumbnails, activeHoverImage]);

  useEffect(() => {
    if (basketItems.length > 0 && historyStackRef.current.length === 0) {
      pushSnapshot();
    }
  }, [basketItems, pushSnapshot]);

  const currentThumbnails = fileThumbnails[activeFileIndex] || [];

  // 在暂存篮指定位置 targetIndex 插入空白页（静默追加 + 气泡动画）
  const handleInsertBlankPageToBasket = (targetIndex?: number) => {
    const blankSrc = createBlankPageDataUrl(t('canvas.blankPage'));
    const newItem: SelectedPageItem = {
      id: `blank-${Date.now()}-${Math.random()}`,
      fileIndex: -1,
      originalPageIndex: -1,
      rotation: 0,
      thumbnailSrc: blankSrc,
      fileName: t('blank.fileName'),
    };

    setBasketItems((prev) => {
      const updated = [...prev];
      if (targetIndex !== undefined && targetIndex >= 0) {
        updated.splice(targetIndex, 0, newItem);
      } else {
        updated.push(newItem);
      }
      return updated;
    });

    triggerBasketPulse();
    pushSnapshot();
  };

  // 💡 微调 2：奇偶页智能开/关逻辑（再次点击自动反选/取消）
  const handleSelectOddEvenPages = (type: 'odd' | 'even') => {
    const totalCount = currentThumbnails.length;
    const targetIndices: number[] = [];

    for (let i = 0; i < totalCount; i++) {
      const pageNum = i + 1;
      if (type === 'odd' && pageNum % 2 !== 0) targetIndices.push(i);
      else if (type === 'even' && pageNum % 2 === 0) targetIndices.push(i);
    }

    // 判断当前选中的页面是否已经包含并完全覆盖了该类型的奇/偶页
    const isAlreadyFullySelected =
      targetIndices.length > 0 &&
      targetIndices.every((idx) => selectedSourcePages.includes(idx));

    if (isAlreadyFullySelected) {
      // 再次点击时取消这些奇/偶页的勾选
      setSelectedSourcePages((prev) => prev.filter((idx) => !targetIndices.includes(idx)));
    } else {
      // 否则进行选中（与现有选中叠加）
      setSelectedSourcePages((prev) => Array.from(new Set([...prev, ...targetIndices])));
    }

    pushSnapshot();
  };

  // 提取书本目录树
  const handleFetchPdfOutline = async () => {
    if (!files[activeFileIndex]) return;
    try {
      setIsParsingOutline(true);
      setShowOutlineModal(true);

      const arrayBuffer = await files[activeFileIndex].arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const rawOutline = await pdfDoc.getOutline();

      if (!rawOutline || rawOutline.length === 0) {
        setPdfOutline([]);
        return;
      }

      const processItems = async (items: RawOutlineNode[]): Promise<PdfOutlineNode[]> => {
        const result: PdfOutlineNode[] = [];
        for (const item of items) {
          let pageIdx = 0;
          try {
            if (typeof item.dest === 'string') {
              const destRef = await pdfDoc.getDestination(item.dest);
              if (destRef) pageIdx = await pdfDoc.getPageIndex(destRef[0]);
            } else if (Array.isArray(item.dest)) {
              pageIdx = await pdfDoc.getPageIndex(item.dest[0]);
            }
          } catch (e) {
            console.warn(e);
          }

          const children = item.items ? await processItems(item.items) : undefined;
          result.push({ title: item.title, pageIndex: pageIdx, items: children });
        }
        return result;
      };

      const parsedTree = await processItems(rawOutline);
      setPdfOutline(parsedTree);
    } catch (err) {
      alert(t('errors.outlineFailed'));
    } finally {
      setIsParsingOutline(false);
    }
  };

  const handleSelectOutlineChapter = (pageIdx: number) => {
    if (!selectedSourcePages.includes(pageIdx)) {
      setSelectedSourcePages((prev) => [...prev, pageIdx]);
    }
    setShowOutlineModal(false);
    pushSnapshot();
  };

  // 框选应用
  const handleApplyPageRange = () => {
    const parsed = parsePageRange(pageRangeInput, currentThumbnails.length);
    if (parsed.length === 0) return alert(tCommon('errors.invalidRange'));
    setSelectedSourcePages(parsed);
    pushSnapshot();
  };

  // 全选/反选
  const toggleSelectAllSourcePages = () => {
    if (selectedSourcePages.length === currentThumbnails.length) {
      setSelectedSourcePages([]);
    } else {
      setSelectedSourcePages(currentThumbnails.map((_, idx) => idx));
    }
    pushSnapshot();
  };

  // 放入暂存篮（静默添加 + 触发呼吸气泡动画，不骚扰展开）
  const addPageToBasket = (pageIdx: number, thumbnailSrc: string) => {
    const newItem: SelectedPageItem = {
      id: createBasketItemId(activeFileIndex, pageIdx),
      fileIndex: activeFileIndex,
      originalPageIndex: pageIdx,
      rotation: 0,
      thumbnailSrc,
      fileName: files[activeFileIndex].name,
    };
    setBasketItems((prev) => [...prev, newItem]);
    triggerBasketPulse();
    pushSnapshot();
  };

  const addSelectedPagesToBasket = () => {
    const newItems: SelectedPageItem[] = selectedSourcePages.map((pageIdx) => ({
      id: createBasketItemId(activeFileIndex, pageIdx),
      fileIndex: activeFileIndex,
      originalPageIndex: pageIdx,
      rotation: 0,
      thumbnailSrc: currentThumbnails[pageIdx],
      fileName: files[activeFileIndex].name,
    }));

    setBasketItems((prev) => [...prev, ...newItems]);
    setSelectedSourcePages([]);
    setLastSelectedSourceIndex(null);
    triggerBasketPulse();
    pushSnapshot();
  };

  // 源卡片点击
  const handleSourceCardClick = (e: React.MouseEvent, pageIdx: number) => {
    if (e.shiftKey && lastSelectedSourceIndex !== null) {
      const start = Math.min(lastSelectedSourceIndex, pageIdx);
      const end = Math.max(lastSelectedSourceIndex, pageIdx);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedSourcePages((prev) => Array.from(new Set([...prev, ...range])));
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedSourcePages((prev) =>
        prev.includes(pageIdx) ? prev.filter((i) => i !== pageIdx) : [...prev, pageIdx]
      );
    } else {
      setSelectedSourcePages((prev) =>
        prev.includes(pageIdx) ? prev.filter((i) => i !== pageIdx) : [...prev, pageIdx]
      );
    }
    setLastSelectedSourceIndex(pageIdx);
    pushSnapshot();
  };

  const rotateBasketItem = (id: string) => {
    setBasketItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item))
    );
    pushSnapshot();
  };

  const removeFromBasket = (id: string) => {
    setBasketItems((prev) => prev.filter((item) => item.id !== id));
    if (activeBasketIndex !== null) setActiveBasketIndex(null);
    pushSnapshot();
  };

  // 暂存篮平移与拖拽
  const moveActiveBasketItem = (direction: 'left' | 'right') => {
    if (activeBasketIndex === null) return;
    const targetIndex = direction === 'left' ? activeBasketIndex - 1 : activeBasketIndex + 1;
    if (targetIndex < 0 || targetIndex >= basketItems.length) return;

    const updated = [...basketItems];
    [updated[activeBasketIndex], updated[targetIndex]] = [updated[targetIndex], updated[activeBasketIndex]];
    setBasketItems(updated);
    setActiveBasketIndex(targetIndex);
    pushSnapshot();
  };

  const handleBasketDragStart = (index: number) => !isTouchDevice && setDraggedBasketIndex(index);
  const handleBasketDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (isTouchDevice || draggedBasketIndex === null || draggedBasketIndex === index) return;
    const updated = [...basketItems];
    const dragged = updated[draggedBasketIndex];
    updated.splice(draggedBasketIndex, 1);
    updated.splice(index, 0, dragged);
    setDraggedBasketIndex(index);
    setBasketItems(updated);
    setActiveBasketIndex(index);
  };
  const handleBasketDragEnd = () => {
    setDraggedBasketIndex(null);
    pushSnapshot();
  };

  // 统一导出逻辑
  const handleOpenExportModal = () => {
    if (basketItems.length === 0) return alert(t('errors.emptyBasket'));
    const baseName = files[activeFileIndex]?.name?.replace(/\.pdf$/i, '') || 'organized';
    setCustomFilename(`${baseName}_organized`);
    setShowFilenameModal(true);
  };

  const handleConfirmExport = async () => {
    try {
      setIsProcessing(true);
      const pdfBytes = await crossMergePDFPages(files, basketItems);

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const finalName = customFilename.trim() || 'organized';
      link.download = `${finalName.endsWith('.pdf') ? finalName : `${finalName}.pdf`}`;

      link.click();
      URL.revokeObjectURL(url);
      setShowFilenameModal(false);
    } catch (err) {
      console.error(err);
      alert(tCommon('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white hover:border-red-500 transition-colors cursor-pointer relative">
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center space-y-3">
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <Upload className="w-8 h-8" />
          </div>
          <p className="text-base font-medium text-slate-700">
            {t('upload.prompt')}
          </p>
          <p className="text-xs text-slate-500">
            {t('upload.hint')}
          </p>
        </div>
      </div>
    );
  }

  const isAllSourceSelected =
    selectedSourcePages.length === currentThumbnails.length && currentThumbnails.length > 0;

  // 判断奇偶页是否处于全选激活状态（用作按钮高亮样式）
  const isOddFullySelected =
    currentThumbnails.length > 0 &&
    currentThumbnails.every((_, idx) => (idx % 2 === 0 ? selectedSourcePages.includes(idx) : true));
  const isEvenFullySelected =
    currentThumbnails.length > 0 &&
    currentThumbnails.every((_, idx) => (idx % 2 !== 0 ? selectedSourcePages.includes(idx) : true));

  const renderOutlineTree = (nodes: PdfOutlineNode[], depth = 0) => (
    <ul className={`space-y-1 ${depth > 0 ? 'ml-4 border-l border-slate-200 pl-2 mt-1' : ''}`}>
      {nodes.map((node, idx) => (
        <li key={idx} className="text-xs">
          <button
            onClick={() => handleSelectOutlineChapter(node.pageIndex)}
            className="w-full text-left flex items-center justify-between p-1.5 hover:bg-red-50 hover:text-red-600 rounded transition-colors group"
          >
            <span className="truncate max-w-[280px] font-medium text-slate-700 group-hover:text-red-600">
              {node.title}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-500 group-hover:bg-red-100 group-hover:text-red-700 px-1.5 py-0.5 rounded font-mono">
              P.{node.pageIndex + 1}
            </span>
          </button>
          {node.items && node.items.length > 0 && renderOutlineTree(node.items, depth + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4 relative pb-24 select-none">
      {/* 顶部 Pills 文件管理栏（已彻底移除干净的 Undo/Redo，移入下方操作栏） */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700">
            {t('files.title', { count: files.length })}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveFileIndex(idx);
                setSelectedSourcePages([]);
                setLastSelectedSourceIndex(null);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                activeFileIndex === idx
                  ? 'border-red-600 bg-red-600 text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{f.name}</span>
            </button>
          ))}
        </div>

        <label className="text-xs text-red-600 font-bold hover:underline cursor-pointer ml-auto">
          {t('files.add')}
          <input type="file" multiple accept="application/pdf" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {/* 核心双栏面板区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* 左侧源页面列表视口 */}
        <div className="lg:col-span-2 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-210px)] min-h-[520px]">
          
          {/* 💡 微调 1：集中式聚合操作工具栏（全选 / Undo / Redo / 高级折叠面板） */}
          <div className="bg-white px-4 py-3 border-b border-slate-200/80 space-y-2.5 shrink-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">
                  {files[activeFileIndex]?.name}
                </span>
                <span className="text-[11px] text-slate-400">{t('files.selectHint')}</span>
              </div>

              {/* 右侧工具组：Undo/Redo、一键全选、高级工具控制 */}
              <div className="flex items-center space-x-2">
                {/* 💡 统一集成的 Undo / Redo 按钮组 */}
                <div className="flex items-center space-x-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200 mr-1">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-1 hover:bg-white text-slate-700 disabled:opacity-20 rounded transition-colors"
                    title={t('actions.undo')}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-1 hover:bg-white text-slate-700 disabled:opacity-20 rounded transition-colors"
                    title={t('actions.redo')}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={toggleSelectAllSourcePages}
                  className="flex items-center space-x-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors"
                >
                  {isAllSourceSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                      <span>{tCommon('actions.deselectAll')}</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>{tCommon('actions.selectAll')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowAdvancedBar(!showAdvancedBar)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    showAdvancedBar
                      ? 'bg-red-50 border-red-300 text-red-600'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-red-600" />
                  <span>{t('actions.advanced')}</span>
                  {showAdvancedBar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {selectedSourcePages.length > 0 && (
                  <button
                    onClick={addSelectedPagesToBasket}
                    className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors animate-in fade-in"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('actions.addToBasketCount', { count: selectedSourcePages.length })}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 折叠高级工具栏：奇偶页开关、页码框选、目录树 */}
            {showAdvancedBar && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150">
                <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{t('range.label')}</span>
                  <input
                    type="text"
                    placeholder={t('range.placeholder')}
                    value={pageRangeInput}
                    onChange={(e) => setPageRangeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPageRange()}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleApplyPageRange}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors shadow-sm whitespace-nowrap"
                  >
                    {tCommon('actions.confirm')}
                  </button>
                </div>

                {/* 💡 微调 2 视觉组件：奇偶页反选/勾选按钮 */}
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleSelectOddEvenPages('odd')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      isOddFullySelected
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-100 hover:bg-red-50 hover:text-red-600 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Binary className="w-3.5 h-3.5" />
                    <span>{t('range.odd')}</span>
                  </button>
                  <button
                    onClick={() => handleSelectOddEvenPages('even')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      isEvenFullySelected
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-100 hover:bg-red-50 hover:text-red-600 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Binary className="w-3.5 h-3.5" />
                    <span>{t('range.even')}</span>
                  </button>

                  <button
                    onClick={handleFetchPdfOutline}
                    className="flex items-center space-x-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs font-bold transition-colors ml-1"
                  >
                    <ListTree className="w-3.5 h-3.5 text-red-600" />
                    <span>{t('range.outline')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 独立滚动视口 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-2 text-red-600">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs font-medium">{tCommon('status.parsingThumbnails')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {currentThumbnails.map((src, pageIdx) => {
                  const addedCount = (basketItems || []).filter(
                    (item) => item.fileIndex === activeFileIndex && item.originalPageIndex === pageIdx
                  ).length;
                  const isChecked = selectedSourcePages.includes(pageIdx);

                  return (
                    <div
                      key={pageIdx}
                      onMouseEnter={() => {
                        setActiveHoverImage(src);
                        setActiveHoverRotation(0);
                        setActiveHoverLabel(t('hover.pageWithFile', { page: pageIdx + 1, name: files[activeFileIndex].name }));
                        setActiveHoverPageIdx(pageIdx);
                      }}
                      onClick={(e) => handleSourceCardClick(e, pageIdx)}
                      className={`relative bg-white p-2 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer hover:scale-105 ${
                        isChecked
                          ? 'border-red-600 ring-2 ring-red-500 bg-red-50/20'
                          : addedCount > 0
                          ? 'border-red-400 bg-red-50/10'
                          : 'border-slate-200 hover:border-red-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10 ${
                          isChecked ? 'bg-red-600' : 'bg-slate-300/80 hover:bg-red-400'
                        }`}
                      >
                        {isChecked ? <Check className="w-3 h-3" /> : pageIdx + 1}
                      </div>

                      {addedCount > 0 && (
                        <div className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow z-10">
                          <span>{t('basket.countBadge', { count: addedCount })}</span>
                        </div>
                      )}

                      <img src={src} alt="" className="w-full h-32 object-contain bg-slate-50 rounded pointer-events-none mt-2" />

                      <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-slate-500">
                        <span>{tCommon('status.page', { page: pageIdx + 1 })}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addPageToBasket(pageIdx, src);
                          }}
                          className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow transition-transform active:scale-90"
                          title={t('actions.addToBasketTitle')}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右侧大图预览 */}
        <div className="hidden lg:block lg:col-span-1 sticky top-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-600">{tCommon('preview.title')}</span>
            <span className="text-[11px] text-red-600 font-bold truncate max-w-[150px]">{activeHoverLabel}</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-center min-h-[360px] max-h-[440px] overflow-hidden border border-slate-100 relative group">
            {activeHoverImage ? (
              <img
                src={activeHoverImage}
                alt="Preview"
                style={{ transform: `rotate(${activeHoverRotation}deg)` }}
                className="max-h-[400px] object-contain rounded shadow-sm transition-transform duration-200"
              />
            ) : (
              <span className="text-xs text-slate-400">{t('preview.hint')}</span>
            )}
          </div>

          {activeHoverPageIdx !== null && activeHoverImage && (
            <button
              onClick={() => addPageToBasket(activeHoverPageIdx, activeHoverImage)}
              className="w-full flex items-center justify-center space-x-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t('actions.putCurrent')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 💡 微调 3：统一拼装暂存篮 (默认折叠 + 静默呼吸气泡动画提示) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-red-600 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] transition-all duration-300 ${
          basketState === 'full' ? 'h-[85vh]' : basketState === 'half' ? 'h-[40vh]' : 'h-[56px]'
        }`}
      >
        <div
          onClick={() => setBasketState(basketState === 'collapsed' ? 'half' : 'collapsed')}
          className="bg-red-50/90 hover:bg-red-100/90 transition-colors border-b border-red-100 px-4 py-2 flex items-center justify-between cursor-pointer select-none relative"
        >
          <div className="w-24 hidden sm:block"></div>

          {/* 中部：展开收起控制 + 呼吸动画气泡 */}
          <div className="flex items-center space-x-3 mx-auto relative">
            <div
              className={`bg-red-600 text-white px-2.5 py-0.5 rounded-lg flex items-center space-x-1 shadow transition-all duration-300 ${
                basketPulseTrigger ? 'scale-125 ring-4 ring-red-400/60 bg-red-500' : 'scale-100'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{basketItems.length}</span>
            </div>

            <span className="text-xs font-bold text-slate-800">{t('basket.title')}</span>

            {/* 💡 呼吸气泡 Pulse Tag */}
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 transition-all duration-300 ${
                basketPulseTrigger
                  ? 'bg-red-600 text-white animate-bounce shadow-md'
                  : 'bg-red-200 text-red-800 hover:bg-red-300'
              }`}
            >
              <span>
                {basketPulseTrigger
                  ? t('basket.pulseAdded')
                  : basketState === 'collapsed'
                  ? t('basket.pulseExpand')
                  : t('basket.pulseCollapse')}
              </span>
              {basketState === 'collapsed' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBasketState(basketState === 'full' ? 'half' : 'full');
              }}
              className="p-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 shadow-sm transition-all flex items-center space-x-1 px-2 text-[10px] font-medium"
            >
              {basketState === 'full' ? <Minimize2 className="w-3.5 h-3.5 text-red-600" /> : <Maximize2 className="w-3.5 h-3.5 text-red-600" />}
            </button>
          </div>

          {/* 右侧：导出合成 PDF 按钮 */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExportModal();
              }}
              disabled={basketItems.length === 0}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('actions.export')}</span>
            </button>
          </div>
        </div>

        {basketState !== 'collapsed' && (
          <div className="flex flex-col h-[calc(100%-48px)]">
            <div className="flex-1 p-6 sm:p-10 overflow-y-auto">
              {basketItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-300" />
                  <p>{t('basket.empty')}</p>
                  <button
                    onClick={() => handleInsertBlankPageToBasket(0)}
                    className="mt-2 text-red-600 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200"
                  >
                    {t('actions.insertFirstBlank')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-y-5 pb-8 pt-2">
                  {/* 队首悬浮缝隙插槽 */}
                  <div className="group relative py-4 px-1 -mx-2 flex items-center justify-center">
                    <button
                      onClick={() => handleInsertBlankPageToBasket(0)}
                      className="w-6 h-12 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-md opacity-20 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all flex flex-col items-center justify-center space-y-0.5 text-[10px] font-bold z-20"
                      title={t('actions.insertBlankFirstTitle')}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[8px] leading-tight">{t('blank.short')}</span>
                    </button>
                  </div>

                  {basketItems.map((item, index) => {
                    const isSelected = activeBasketIndex === index;

                    return (
                      <div key={item.id} className="flex items-center">
                        {/* 暂存篮卡片体 */}
                        <div
                          draggable={!isTouchDevice}
                          onDragStart={() => handleBasketDragStart(index)}
                          onDragOver={(e) => handleBasketDragOver(e, index)}
                          onDragEnd={handleBasketDragEnd}
                          onMouseEnter={() => {
                            setActiveHoverImage(item.thumbnailSrc);
                            setActiveHoverRotation(item.rotation);
                            setActiveHoverLabel(t('hover.basketWithFile', { index: index + 1, name: item.fileName }));
                          }}
                          onClick={() => setActiveBasketIndex(index)}
                          className={`relative w-28 bg-slate-50 p-2 rounded-lg border transition-all duration-300 cursor-pointer origin-center hover:scale-105 ${
                            isSelected ? 'border-red-600 ring-2 ring-red-500 bg-white shadow-md' : 'border-slate-200 hover:border-red-400'
                          } ${draggedBasketIndex === index ? 'opacity-30 border-red-400 scale-95' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">#{index + 1}</span>
                            <div className="flex items-center space-x-1">
                              {!isTouchDevice && (
                                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5">
                                  <GripHorizontal className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); rotateBasketItem(item.id); }} className="p-0.5 text-slate-400 hover:text-red-600" title={t('actions.rotate90')}>
                                <RotateCw className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeFromBasket(item.id); }} className="p-0.5 text-red-400 hover:text-red-600" title={t('actions.remove')}>
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="aspect-[1/1.3] bg-white rounded overflow-hidden flex items-center justify-center border border-slate-100 pointer-events-none">
                            <img src={item.thumbnailSrc} alt="" style={{ transform: `rotate(${item.rotation}deg)` }} className="max-h-full max-w-full object-contain transition-transform duration-200" />
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate max-w-[80px]">{item.fileName}</span>
                            {isSelected && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded">{tCommon('status.selectedShort')}</span>}
                          </div>
                        </div>

                        {/* 卡片右侧相邻缝隙插槽 */}
                        <div className="group relative py-4 px-1 -mx-2 flex items-center justify-center">
                          <button
                            onClick={() => handleInsertBlankPageToBasket(index + 1)}
                            className="w-6 h-12 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-md opacity-20 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all flex flex-col items-center justify-center space-y-0.5 text-[10px] font-bold z-20"
                            title={t('actions.insertBlankBetweenTitle', { from: index + 1, to: index + 2 })}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[8px] leading-tight">{t('blank.short')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 暂存篮底部集中全局排序控制 */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-center space-x-3">
              <span className="text-xs font-bold text-slate-600">
                {activeBasketIndex !== null ? t('basket.selectedHint', { index: activeBasketIndex + 1 }) : t('basket.orderHint')}
              </span>

              <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-xl border border-slate-300 shadow-sm">
                <button
                  onClick={() => moveActiveBasketItem('left')}
                  disabled={activeBasketIndex === null || activeBasketIndex === 0}
                  className="flex items-center space-x-1 px-2 py-1 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t('basket.moveForward')}</span>
                </button>

                <div className="w-[1px] h-4 bg-slate-200"></div>

                <button
                  onClick={() => moveActiveBasketItem('right')}
                  disabled={activeBasketIndex === null || activeBasketIndex === basketItems.length - 1}
                  className="flex items-center space-x-1 px-2 py-1 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold disabled:opacity-30 transition-colors"
                >
                  <span>{t('basket.moveBackward')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF 书本目录 Modal */}
      {showOutlineModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-800">{t('outline.title', { name: files[activeFileIndex]?.name })}</h3>
              </div>
              <button onClick={() => setShowOutlineModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {isParsingOutline ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-red-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-medium">{t('outline.loading')}</span>
                </div>
              ) : pdfOutline.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">{t('outline.empty')}</div>
              ) : (
                renderOutlineTree(pdfOutline)
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
              <span>{t('outline.hint')}</span>
              <button onClick={() => setShowOutlineModal(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg">{tCommon('actions.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认导出文件名 Modal */}
      {showFilenameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{t('modal.title')}</h3>
              <button onClick={() => setShowFilenameModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">{tCommon('filename.label')}</label>
              <div className="flex items-center space-x-2 border border-slate-300 rounded-lg p-2.5 focus-within:ring-2 focus-within:ring-red-500">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                  autoFocus
                />
                <span className="text-xs font-semibold text-slate-400">.pdf</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setShowFilenameModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
                {tCommon('actions.cancel')}
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={isProcessing}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg text-xs font-medium shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isProcessing ? t('status.assembling') : tCommon('actions.confirmDownload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}