'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { crossMergePDFPages, SelectedPageItem } from '@/lib/pdf-cross-merge';
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  Plus,
  RotateCw,
  Layers,
  FileText,
  GripHorizontal,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/** 暂存篮条目 ID（放在模块作用域，避免在渲染期调用 Date.now / Math.random） */
const createBasketItemId = (fileIndex: number, pageIndex: number) =>
  `file-${fileIndex}-page-${pageIndex}-${Date.now()}-${Math.random()}`;

export default function PdfCrossMergeTool() {
  const t = useTranslations('PdfCrossMerge');
  const tCommon = useTranslations('Common');
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  const [fileThumbnails, setFileThumbnails] = useState<{ [key: number]: string[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [basketItems, setBasketItems] = useState<SelectedPageItem[]>([]);

  const [activeHoverImage, setActiveHoverImage] = useState<string | null>(null);
  const [activeHoverRotation, setActiveHoverRotation] = useState<number>(0);
  const [activeHoverLabel, setActiveHoverLabel] = useState<string>('');
  const [mobileZoomedId, setMobileZoomedId] = useState<string | null>(null);

  const [draggedBasketIndex, setDraggedBasketIndex] = useState<number | null>(null);

  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [customFilename, setCustomFilename] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files).filter(
      (f) => f.type === 'application/pdf'
    );
    if (selectedFiles.length === 0) return;

    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  useEffect(() => {
    if (files.length === 0 || !files[activeFileIndex]) return;
    if (fileThumbnails[activeFileIndex]) return;

    async function loadCurrentFileThumbnails() {
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
        }
      } catch (err) {
        alert(tCommon('errors.parsePdf'));
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentFileThumbnails();
  }, [files, activeFileIndex, fileThumbnails, activeHoverImage]);

  const getPageAddedCount = (fileIdx: number, pageIdx: number) => {
    return basketItems.filter(
      (item) => item.fileIndex === fileIdx && item.originalPageIndex === pageIdx
    ).length;
  };

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
  };

  const removeFromBasket = (id: string) => {
    setBasketItems((prev) => prev.filter((item) => item.id !== id));
  };

  const rotateBasketItem = (id: string) => {
    setBasketItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newRot = (item.rotation + 90) % 360;
          if (activeHoverLabel.includes(id)) {
            setActiveHoverRotation(newRot);
          }
          return { ...item, rotation: newRot };
        }
        return item;
      })
    );
  };

  // 💡 适配移动端的向前（左）移动
  const moveBasketItemLeft = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;
    const updated = [...basketItems];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setBasketItems(updated);
  };

  // 💡 适配移动端的向后（右）移动
  const moveBasketItemRight = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === basketItems.length - 1) return;
    const updated = [...basketItems];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setBasketItems(updated);
  };

  // 电脑端 Drag & Drop
  const handleBasketDragStart = (index: number) => {
    setDraggedBasketIndex(index);
  };

  const handleBasketDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedBasketIndex === null || draggedBasketIndex === index) return;

    const updated = [...basketItems];
    const draggedItem = updated[draggedBasketIndex];
    updated.splice(draggedBasketIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedBasketIndex(index);
    setBasketItems(updated);
  };

  const handleBasketDragEnd = () => {
    setDraggedBasketIndex(null);
  };

  const handleOpenExportModal = () => {
    if (basketItems.length === 0) {
      alert(t('errors.emptyBasket'));
      return;
    }
    setCustomFilename(`cross_merged_${Date.now()}`);
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

      const finalName = customFilename.trim() || 'cross_merged';
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
          <div>
            <p className="text-base font-medium text-slate-700">
              {t('upload.prompt')}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {t('upload.hint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentThumbnails = fileThumbnails[activeFileIndex] || [];

  return (
    <div className="space-y-6">
      {/* 1. 源文档切换 Pill 栏 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <Layers className="w-4 h-4 text-red-600" />
            <span>{t('sources.title')}</span>
          </span>
          <label className="text-xs text-red-600 font-medium hover:underline cursor-pointer">
            {t('sources.addMore')}
            <input
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => {
            const isActive = activeFileIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveFileIndex(idx)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  isActive
                    ? 'border-red-600 bg-red-600 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 核心双栏工作区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 左侧 (lg:col-span-2)：源文件页面网格 */}
        <div className="lg:col-span-2 bg-slate-100 p-4 sm:p-6 rounded-xl border border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-600">
            <span>
              {t('sources.current', { name: files[activeFileIndex]?.name })}
            </span>
            {isLoading && (
              <span className="flex items-center space-x-1 text-red-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('status.parsing')}</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 block lg:hidden">
            {t('sources.hint')}
          </p>

          {!isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentThumbnails.map((src, pageIdx) => {
                const addedCount = getPageAddedCount(activeFileIndex, pageIdx);
                const zoomId = `source-${pageIdx}`;
                const isZoomed = mobileZoomedId === zoomId;

                const total = currentThumbnails.length;
                const isNearBottom = pageIdx >= total - 4;

                const originClass = isNearBottom
                  ? (pageIdx % 2 === 0 ? 'origin-bottom-left' : 'origin-bottom-right')
                  : (pageIdx % 2 === 0 ? 'origin-left' : 'origin-right');

                return (
                  <div
                    key={pageIdx}
                    onMouseEnter={() => {
                      setActiveHoverImage(src);
                      setActiveHoverRotation(0);
                      setActiveHoverLabel(t('hover.pageWithFile', { page: pageIdx + 1, name: files[activeFileIndex].name }));
                    }}
                    onClick={() => setMobileZoomedId(isZoomed ? null : zoomId)}
                    className={`relative bg-white p-2 rounded-lg border shadow-sm transition-all duration-300 cursor-pointer ${originClass} ${
                      addedCount > 0
                        ? 'border-red-500 ring-2 ring-red-500/25 bg-red-50/10'
                        : 'border-slate-200 hover:border-red-400'
                    } ${
                      isZoomed
                        ? 'scale-150 z-50 shadow-2xl ring-4 ring-red-500/50'
                        : 'hover:scale-105'
                    }`}
                  >
                    {addedCount > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow z-10 flex items-center space-x-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>{addedCount}</span>
                      </div>
                    )}

                    <img
                      src={src}
                      alt={`Page ${pageIdx + 1}`}
                      className="w-full h-32 object-contain bg-slate-50 rounded"
                    />

                    <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-slate-500">
                      <span>{tCommon('status.page', { page: pageIdx + 1 })}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addPageToBasket(pageIdx, src);
                        }}
                        className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow transition-transform active:scale-90"
                        title={t('actions.addToBasket')}
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

        {/* 右侧 (lg:col-span-1)：电脑端实时大图预览栏 */}
        <div className="hidden lg:block lg:col-span-1 sticky top-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500">{tCommon('preview.title')}</span>
            <span className="text-[11px] text-red-600 font-bold truncate max-w-[150px]">
              {activeHoverLabel}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center min-h-[360px] max-h-[460px] overflow-hidden border border-slate-100">
            {activeHoverImage ? (
              <img
                src={activeHoverImage}
                alt="Preview"
                style={{ transform: `rotate(${activeHoverRotation}deg)` }}
                className="max-h-[420px] object-contain rounded shadow-sm transition-transform duration-200"
              />
            ) : (
              <span className="text-xs text-slate-400">{t('preview.hintCards')}</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 text-center">{t('preview.hint')}</p>
        </div>
      </div>

      {/* 3. 底部拼装暂存篮 Drawer */}
      <div className="bg-white rounded-xl border-2 border-red-500 shadow-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">
              {t('basket.title')}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {t('basket.subtitle', { count: basketItems.length })}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              {t('basket.dragHint')}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setBasketItems([])}
              className="text-xs text-red-500 hover:underline"
            >
              {t('basket.clear')}
            </button>
            <button
              onClick={handleOpenExportModal}
              disabled={isProcessing || basketItems.length === 0}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isProcessing ? t('status.generating') : t('actions.assembleExport')}</span>
            </button>
          </div>
        </div>

        {/* 暂存篮卡片列表 */}
        {basketItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {t('basket.empty')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 p-1">
            {basketItems.map((item, index) => {
              const zoomId = `basket-${item.id}`;
              const isZoomed = mobileZoomedId === zoomId;
              const originClass = index % 2 === 0 ? 'origin-bottom-left' : 'origin-bottom-right';

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleBasketDragStart(index)}
                  onDragOver={(e) => handleBasketDragOver(e, index)}
                  onDragEnd={handleBasketDragEnd}
                  onMouseEnter={() => {
                    setActiveHoverImage(item.thumbnailSrc);
                    setActiveHoverRotation(item.rotation);
                    setActiveHoverLabel(t('hover.basketWithFile', { index: index + 1, name: item.fileName }));
                  }}
                  onClick={() => setMobileZoomedId(isZoomed ? null : zoomId)}
                  className={`relative w-32 bg-slate-50 p-2 rounded-lg border transition-all duration-300 cursor-pointer ${originClass} ${
                    draggedBasketIndex === index
                      ? 'opacity-30 border-red-400 scale-95'
                      : 'border-slate-200 hover:border-red-500'
                  } ${
                    isZoomed
                      ? 'scale-150 z-50 shadow-2xl ring-4 ring-red-500/50 bg-white'
                      : 'hover:scale-105'
                  }`}
                >
                  {/* 顶部按钮与移动控制栏 */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">
                      #{index + 1}
                    </span>

                    {/* 💡 移动端友好：左右移动箭头 */}
                    <div className="flex items-center space-x-0.5">
                      <button
                        onClick={(e) => moveBasketItemLeft(index, e)}
                        disabled={index === 0}
                        className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 active:scale-90"
                        title={t('actions.moveLeft')}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => moveBasketItemRight(index, e)}
                        disabled={index === basketItems.length - 1}
                        className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 active:scale-90"
                        title={t('actions.moveRight')}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateBasketItem(item.id);
                      }}
                      className="p-0.5 text-slate-400 hover:text-red-600"
                      title={t('actions.rotate90')}
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromBasket(item.id);
                      }}
                      className="p-0.5 text-red-400 hover:text-red-600"
                      title={t('actions.remove')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="aspect-[1/1.3] bg-white rounded overflow-hidden flex items-center justify-center border border-slate-100">
                    <img
                      src={item.thumbnailSrc}
                      alt=""
                      style={{ transform: `rotate(${item.rotation}deg)` }}
                      className="max-h-full max-w-full object-contain transition-transform duration-200"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-1" title={item.fileName}>
                    {item.fileName}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 确认导出文件名 Modal */}
      {showFilenameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{t('modal.title')}</h3>
              <button
                onClick={() => setShowFilenameModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">
                {t('modal.summary', { count: basketItems.length })}
              </label>
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
              <button
                onClick={() => setShowFilenameModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
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