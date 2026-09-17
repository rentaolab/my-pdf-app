'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { cropPDFPagesCustom, cropPDFPagesToZip, CropRect } from '@/lib/pdf-crop';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Upload,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  Archive,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react';

export type CropScopeMode = 'all' | 'current' | 'odd' | 'even' | 'selected';

export default function PdfCropTool() {
  const t = useTranslations('PdfCrop');
  const tCommon = useTranslations('Common');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 当前预览页索引与真实 PT 尺寸
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });

  // 💡 1. 默认应用模式为“所有页” ('all')
  const [scopeMode, setScopeMode] = useState<CropScopeMode>('all');

  // 💡 逐页记录裁剪框数据：{ [pageIdx]: { x, y, width, height } }
  const [pageBoxPercentMap, setPageBoxPercentMap] = useState<{
    [key: number]: { x: number; y: number; width: number; height: number };
  }>({});

  // 💡 3. 右侧导航区勾选导出的页面索引数组（默认全选）
  const [selectedExportPages, setSelectedExportPages] = useState<number[]>([]);

  // 导出模式：'merged' (单个PDF) 或 'zip' (单页ZIP)
  const [exportMode, setExportMode] = useState<'merged' | 'zip'>('merged');

  // 拖拽控制状态
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    box: { x: number; y: number; width: number; height: number };
  }>({
    x: 0,
    y: 0,
    box: { x: 5, y: 5, width: 90, height: 90 },
  });

  // 当前展示页面的选框
  const currentBox = pageBoxPercentMap[activePageIndex] || { x: 5, y: 5, width: 90, height: 90 };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    if (selected.type !== 'application/pdf') return alert(tCommon('errors.uploadPdf'));

    setFile(selected);
    e.target.value = '';
  };

  useEffect(() => {
    if (!file) return;
    const currentFile = file;

    async function loadPDF() {
      try {
        setIsLoading(true);
        const images = await renderPDFToImages(currentFile);
        setThumbnails(images);

        // 默认勾选所有页面导出
        const allIndices = images.map((_, idx) => idx);
        setSelectedExportPages(allIndices);

        // 获取 PDF 真实 pt 尺寸
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const firstPage = await pdfDoc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        setPdfPageDimensions({ width: viewport.width, height: viewport.height });

        // 初始化所有页面的裁剪框
        const initialMap: typeof pageBoxPercentMap = {};
        images.forEach((_, idx) => {
          initialMap[idx] = { x: 5, y: 5, width: 90, height: 90 };
        });
        setPageBoxPercentMap(initialMap);
        setActivePageIndex(0);
      } catch (err) {
        alert(tCommon('errors.parsePdf'));
      } finally {
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [file]);

  // 辅助：同步给特定范围的页面
  const applyBoxToScope = (
    targetBox: { x: number; y: number; width: number; height: number },
    mode: CropScopeMode
  ) => {
    setPageBoxPercentMap((prev) => {
      const next = { ...prev };
      thumbnails.forEach((_, idx) => {
        const pageNum = idx + 1;
        if (
          mode === 'all' ||
          (mode === 'current' && idx === activePageIndex) ||
          (mode === 'odd' && pageNum % 2 !== 0) ||
          (mode === 'even' && pageNum % 2 === 0) ||
          (mode === 'selected' && selectedExportPages.includes(idx))
        ) {
          next[idx] = { ...targetBox };
        }
      });
      return next;
    });
  };

  // 切换作用域模式（同时同步框）
  // 💡 优化：切换裁剪应用范围时，同步更新右侧【导出勾选列表】
  // 💡 优化：切换裁剪应用范围时，增加智能跳页与视口自动同步
  const handleScopeChange = (mode: CropScopeMode) => {
    setScopeMode(mode);

    // 1. 自动跳页逻辑：如果当前处于单数页模式但画布在双数页，自动切到最近的单数页
    let targetPreviewIndex = activePageIndex;
    const currentNum = activePageIndex + 1;

    if (mode === 'odd' && currentNum % 2 === 0) {
      // 偶数页切单数页：优先跳前一页，没有就跳后一页
      targetPreviewIndex = Math.max(0, activePageIndex - 1);
    } else if (mode === 'even' && currentNum % 2 !== 0) {
      // 单数页切双数页：优先跳后一页（如果存在的话）
      if (activePageIndex + 1 < thumbnails.length) {
        targetPreviewIndex = activePageIndex + 1;
      } else if (activePageIndex - 1 >= 0) {
        targetPreviewIndex = activePageIndex - 1;
      }
    }

    // 更新预览页
    setActivePageIndex(targetPreviewIndex);

    // 2. 同步裁剪框尺寸
    const boxToApply = pageBoxPercentMap[targetPreviewIndex] || currentBox;
    applyBoxToScope(boxToApply, mode);

    // 3. 自动同步勾选右侧导出页面
    const totalCount = thumbnails.length;
    const targetExportIndices: number[] = [];

    for (let i = 0; i < totalCount; i++) {
      const pageNum = i + 1;
      if (mode === 'all') {
        targetExportIndices.push(i);
      } else if (mode === 'current') {
        targetExportIndices.push(targetPreviewIndex);
      } else if (mode === 'odd' && pageNum % 2 !== 0) {
        targetExportIndices.push(i);
      } else if (mode === 'even' && pageNum % 2 === 0) {
        targetExportIndices.push(i);
      }
    }

    if (mode !== 'selected') {
      setSelectedExportPages(Array.from(new Set(targetExportIndices)));
    }
  };

  // 拖拽时更新选框
  const updateCurrentBox = (newBox: { x: number; y: number; width: number; height: number }) => {
    if (scopeMode === 'current') {
      setPageBoxPercentMap((prev) => ({ ...prev, [activePageIndex]: newBox }));
    } else {
      applyBoxToScope(newBox, scopeMode);
    }
  };

  // 右侧勾选/取消勾选导出页面
  const toggleSelectExportPage = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发切换预览页
    setSelectedExportPages((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleSelectAllExport = () => {
    if (selectedExportPages.length === thumbnails.length) {
      setSelectedExportPages([]);
    } else {
      setSelectedExportPages(thumbnails.map((_, i) => i));
    }
  };

  // 拖拽 handlers
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(handle);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      box: { ...currentBox },
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      const initialBox = dragStartRef.current.box;
      let { x, y, width, height } = initialBox;

      if (activeHandle === 'move') {
        x = Math.max(0, Math.min(100 - width, initialBox.x + deltaXPercent));
        y = Math.max(0, Math.min(100 - height, initialBox.y + deltaYPercent));
      } else if (activeHandle) {
        if (activeHandle.includes('w')) {
          const newX = Math.max(0, Math.min(initialBox.x + initialBox.width - 5, initialBox.x + deltaXPercent));
          width = initialBox.width + (initialBox.x - newX);
          x = newX;
        }
        if (activeHandle.includes('e')) {
          width = Math.max(5, Math.min(100 - initialBox.x, initialBox.width + deltaXPercent));
        }
        if (activeHandle.includes('n')) {
          const newY = Math.max(0, Math.min(initialBox.y + initialBox.height - 5, initialBox.y + deltaYPercent));
          height = initialBox.height + (initialBox.y - newY);
          y = newY;
        }
        if (activeHandle.includes('s')) {
          height = Math.max(5, Math.min(100 - initialBox.y, initialBox.height + deltaYPercent));
        }
      }

      updateCurrentBox({ x, y, width, height });
    },
    [isDragging, activeHandle, scopeMode, activePageIndex]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 执行导出逻辑（过滤只导出勾选的页面）
  const handleExport = async () => {
    if (!file) return;
    if (selectedExportPages.length === 0) {
      return alert(t('errors.noExportPages'));
    }

    try {
      setIsProcessing(true);
      const pdfW = pdfPageDimensions.width;
      const pdfH = pdfPageDimensions.height;

      // 转换为 PDF PT 坐标映射 (只提取选中的页面)
      const pageCropMap: { [key: number]: CropRect } = {};
      selectedExportPages.forEach((idx) => {
        const box = pageBoxPercentMap[idx] || { x: 5, y: 5, width: 90, height: 90 };
        pageCropMap[idx] = {
          x: (box.x / 100) * pdfW,
          y: ((100 - box.y - box.height) / 100) * pdfH,
          width: (box.width / 100) * pdfW,
          height: (box.height / 100) * pdfH,
        };
      });

      const baseName = file.name.replace(/\.pdf$/i, '');

      if (exportMode === 'merged') {
        const pdfBytes = await cropPDFPagesCustom(file, pageCropMap);
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_cropped.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const zipBlob = await cropPDFPagesToZip(file, pageCropMap);
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_cropped_pages.zip`;
        link.click();
        URL.revokeObjectURL(url);
      }
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
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center space-y-3">
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-medium text-slate-700">{tCommon('upload.prompt')}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t('upload.hint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none pb-12">
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[560px]">
        
        {/* 固定 Header 控制栏 */}
        <div className="bg-white px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          
          {/* 💡 优化 1 & 2：明确的被选中高亮（默认所有页） */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700">{t('scope.label')}</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => handleScopeChange('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'all'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('scope.all')}
              </button>
              <button
                onClick={() => handleScopeChange('current')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'current'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('scope.current')}
              </button>
              <button
                onClick={() => handleScopeChange('odd')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'odd'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('scope.odd')}
              </button>
              <button
                onClick={() => handleScopeChange('even')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'even'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('scope.even')}
              </button>
              <button
                onClick={() => handleScopeChange('selected')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'selected'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('scope.selected', { count: selectedExportPages.length })}
              </button>
            </div>
          </div>

          {/* 重置 */}
          <button
            onClick={() => updateCurrentBox({ x: 5, y: 5, width: 90, height: 90 })}
            className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('actions.resetBox')}</span>
          </button>

          {/* 右侧：导出模式切换 + 导出按钮 */}
          <div className="flex items-center space-x-2 ml-auto">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setExportMode('merged')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  exportMode === 'merged'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3 h-3 text-red-600" />
                <span>{t('mode.merged')}</span>
              </button>
              <button
                onClick={() => setExportMode('zip')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  exportMode === 'zip'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-3 h-3 text-red-600" />
                <span>{t('mode.zip')}</span>
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={isProcessing || selectedExportPages.length === 0}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isProcessing ? tCommon('status.processing') : t('actions.exportCount', { count: selectedExportPages.length })}</span>
            </button>
          </div>
        </div>

        {/* 视口内容 */}
        <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
          
          {/* 左侧：主编辑 Canvas */}
          <div className="flex-1 bg-slate-200/70 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[420px]">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-2 text-red-600">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-medium">{t('status.parsingPreviews')}</span>
              </div>
            ) : (
              <div className="relative max-h-[480px] max-w-full flex items-center justify-center select-none shadow-xl rounded overflow-hidden">
                <img
                  src={thumbnails[activePageIndex]}
                  alt="Crop Preview"
                  className="max-h-[480px] w-auto object-contain pointer-events-none rounded"
                />

                {/* 裁剪框 */}
                <div ref={containerRef} className="absolute inset-0 pointer-events-auto">
                  <div
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                    style={{
                      left: `${currentBox.x}%`,
                      top: `${currentBox.y}%`,
                      width: `${currentBox.width}%`,
                      height: `${currentBox.height}%`,
                    }}
                    className="absolute border-2 border-red-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] cursor-move group"
                  >
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                      <div className="border-r border-b border-white"></div>
                      <div className="border-r border-b border-white"></div>
                      <div className="border-b border-white"></div>
                      <div className="border-r border-b border-white"></div>
                      <div className="border-r border-b border-white"></div>
                      <div className="border-b border-white"></div>
                    </div>

                    {/* 8 个 Handle */}
                    {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((pos) => {
                      let positionClass = '';
                      if (pos === 'nw') positionClass = '-top-1.5 -left-1.5 cursor-nwse-resize';
                      if (pos === 'n') positionClass = '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
                      if (pos === 'ne') positionClass = '-top-1.5 -right-1.5 cursor-nesw-resize';
                      if (pos === 'w') positionClass = 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize';
                      if (pos === 'e') positionClass = 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize';
                      if (pos === 'sw') positionClass = '-bottom-1.5 -left-1.5 cursor-nesw-resize';
                      if (pos === 's') positionClass = '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
                      if (pos === 'se') positionClass = '-bottom-1.5 -right-1.5 cursor-nwse-resize';

                      return (
                        <div
                          key={pos}
                          onMouseDown={(e) => handleMouseDown(e, pos)}
                          className={`absolute w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full shadow-md z-20 ${positionClass}`}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 当前翻页控制器 */}
            <div className="mt-3 flex items-center space-x-3 bg-white px-3 py-1 rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
                disabled={activePageIndex === 0}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700">
                P. {activePageIndex + 1} / {thumbnails.length}
              </span>
              <button
                onClick={() => setActivePageIndex((prev) => Math.min(thumbnails.length - 1, prev + 1))}
                disabled={activePageIndex === thumbnails.length - 1}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 💡 优化 3：右侧页面导航区支持勾选/取消勾选导出页面 */}
          <div className="w-full md:w-64 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col max-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-800">
                {t('nav.title', { selected: selectedExportPages.length, total: thumbnails.length })}
              </span>
              <button
                onClick={toggleSelectAllExport}
                className="text-[10px] font-bold text-red-600 hover:underline flex items-center space-x-0.5"
              >
                {selectedExportPages.length === thumbnails.length ? tCommon('actions.deselectAll') : tCommon('actions.selectAll')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
              {thumbnails.map((src, idx) => {
                const isActive = activePageIndex === idx;
                const isChecked = selectedExportPages.includes(idx);

                return (
                  <div
                    key={idx}
                    onClick={() => setActivePageIndex(idx)}
                    className={`relative bg-slate-50 p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${
                      isActive
                        ? 'border-2 border-red-600 bg-red-50/20 shadow-sm'
                        : 'border-slate-200/80 opacity-80'
                    }`}
                  >
                    {/* 勾选框：点击独立控制是否导出该页 */}
                    <button
                      onClick={(e) => toggleSelectExportPage(idx, e)}
                      className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center text-white text-[10px] font-bold z-10 transition-colors ${
                        isChecked ? 'bg-red-600' : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                      title={isChecked ? t('nav.uncheckTitle') : t('nav.checkTitle')}
                    >
                      {isChecked ? <Check className="w-3 h-3" /> : null}
                    </button>

                    <div className="text-[10px] font-mono font-bold text-right text-slate-500 mb-1 pr-1">
                      P.{idx + 1}
                    </div>
                    <img src={src} alt="" className="w-full h-32 object-contain pointer-events-none" />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}