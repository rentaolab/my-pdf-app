'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages, processPDFPages } from '@/lib/pdf-edit';
import { RotateCw, Check, Download, Loader2, Upload, Eye, GripHorizontal, X, RefreshCw } from 'lucide-react';

export default function PdfPageEditorTool() {
  const t = useTranslations('PdfPageEditor');
  const tCommon = useTranslations('Common');
  const [file, setFile] = useState<File | null>(null);
  
  // 页面缩略图与原始索引追踪 [{ id, src, originalIndex }]
  const [pageCards, setPageCards] = useState<
    { id: string; src: string; originalIndex: number }[]
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 选中的原始页面索引数组
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  // 页面旋转映射 { [originalPageIndex]: rotationAngle }
  const [rotations, setRotations] = useState<{ [key: number]: number }>({});

  // 拖拽控制状态
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);

  // 电脑/手机预览状态
  const [activeHoverIndex, setActiveHoverIndex] = useState<number>(0);
  const [mobileZoomedIndex, setMobileZoomedIndex] = useState<number | null>(null);

  // 导出文件名确认弹窗
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [customFilename, setCustomFilename] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setActiveHoverIndex(0);
      setMobileZoomedIndex(null);
      setRotations({});
    }
  };

  useEffect(() => {
    if (!file) return;
    async function loadPDF() {
      try {
        setIsLoading(true);
        const images = await renderPDFToImages(file!);
        const cards = images.map((src, index) => ({
          id: `page-${index}-${Date.now()}`,
          src,
          originalIndex: index,
        }));
        setPageCards(cards);
        setSelectedPages(images.map((_, index) => index));
      } catch (error) {
        alert(tCommon('errors.parsePdf'));
        setFile(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadPDF();
  }, [file]);

  const toggleSelectPage = (origIndex: number) => {
    setSelectedPages((prev) =>
      prev.includes(origIndex)
        ? prev.filter((i) => i !== origIndex)
        : [...prev, origIndex].sort((a, b) => a - b)
    );
  };

  const rotatePage = (origIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRotations((prev) => ({ ...prev, [origIndex]: ((prev[origIndex] || 0) + 90) % 360 }));
  };

  const toggleMobileZoom = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveHoverIndex(index);
    setMobileZoomedIndex(mobileZoomedIndex === index ? null : index);
  };

  // --- HTML5 拖拽排序 Handler ---
  const handleDragStart = (index: number) => {
    setDraggedCardIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCardIndex === null || draggedCardIndex === index) return;

    const updated = [...pageCards];
    const draggedItem = updated[draggedCardIndex];
    updated.splice(draggedCardIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedCardIndex(index);
    setPageCards(updated);
  };

  const handleDragEnd = () => {
    setDraggedCardIndex(null);
  };

  // 打开确认文件名弹窗
  const handleOpenExportModal = () => {
    if (!file || selectedPages.length === 0) {
      alert(t('errors.noPagesKept'));
      return;
    }
    const baseName = file.name.replace(/\.pdf$/i, '');
    setCustomFilename(`${baseName}_edited`);
    setShowFilenameModal(true);
  };

  // 真正导出：按照拖拽后的新顺序过滤导出的页面
  const handleConfirmExport = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);

      // 按拖拽后的 pageCards 顺序提取被勾选的页面
      const exportIndices = pageCards
        .map((card) => card.originalIndex)
        .filter((origIdx) => selectedPages.includes(origIdx));

      const pdfBytes = await processPDFPages(file, exportIndices, rotations);
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const finalName = customFilename.trim() || 'edited_pdf';
      link.download = `${finalName.endsWith('.pdf') ? finalName : `${finalName}.pdf`}`;

      link.click();
      URL.revokeObjectURL(url);
      setShowFilenameModal(false);
    } catch (error) {
      console.error(error);
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
            <p className="text-base font-medium text-slate-700">{t('upload.prompt')}</p>
            <p className="text-xs text-slate-500 mt-1">{t('upload.hint')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        <p className="text-sm text-slate-600">{t('status.generating')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slate-900 现代化控制栏 */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
              <GripHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-sm">
                {file.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('status.selected', { selected: selectedPages.length, total: pageCards.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFile(null)}
              className="flex items-center space-x-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{tCommon('actions.reupload')}</span>
            </button>

            <button
              onClick={handleOpenExportModal}
              disabled={isProcessing || selectedPages.length === 0}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isProcessing ? tCommon('status.processing') : t('actions.exportSelected')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-slate-100 p-4 sm:p-6 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center space-x-1.5 border-b border-slate-200/80 pb-2">
            <GripHorizontal className="w-4 h-4 text-red-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700">{t('hint.drag')}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pageCards.map((card, index) => {
              const origIdx = card.originalIndex;
              const isSelected = selectedPages.includes(origIdx);
              const rotation = rotations[origIdx] || 0;
              const isMobileZoomed = mobileZoomedIndex === index;

              const originClass = index % 2 === 0 ? 'origin-left' : 'origin-right';

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => setActiveHoverIndex(index)}
                  onClick={() => toggleSelectPage(origIdx)}
                  className={`relative bg-white p-3 rounded-xl border transition-all duration-200 cursor-pointer group shadow-sm ${originClass} ${
                    isSelected
                      ? 'border-red-500 ring-2 ring-red-500/25 shadow-md'
                      : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-red-300'
                  } ${
                    draggedCardIndex === index ? 'scale-95 opacity-30 ring-2 ring-red-400' : ''
                  } ${
                    isMobileZoomed
                      ? 'scale-150 z-30 shadow-2xl ring-4 ring-red-500/40 my-6'
                      : 'z-10 hover:scale-105'
                  }`}
                >
                  {/* 顶部拖拽手柄与勾选框 */}
                  <div className="flex items-center justify-between z-20 relative mb-2">
                    <div
                      className={`flex items-center justify-center text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md transition-colors ${
                        isSelected ? 'bg-red-600' : 'bg-slate-900/85'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : index + 1}
                    </div>

                    {/* 拖拽手柄 */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1">
                      <GripHorizontal className="w-4 h-4" />
                    </div>

                    {/* 旋转按钮 */}
                    <button
                      onClick={(e) => rotatePage(origIdx, e)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-md opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                      title={t('actions.rotate90')}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="aspect-[1/1.3] bg-slate-50 rounded overflow-hidden flex items-center justify-center border border-slate-100 p-1 relative">
                    <img
                      src={card.src}
                      alt={`Page ${index + 1}`}
                      style={{ transform: `rotate(${rotation}deg)` }}
                      className="max-h-full max-w-full object-contain transition-transform duration-200"
                    />

                    <button
                      onClick={(e) => toggleMobileZoom(index, e)}
                      className={`lg:hidden absolute bottom-2 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-lg backdrop-blur-sm z-20 transition-transform active:scale-95 ${
                        isMobileZoomed ? 'bg-red-600 ring-2 ring-white' : ''
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>{isMobileZoomed ? t('actions.collapse') : t('actions.zoom')}</span>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t('status.position', { pos: index + 1, orig: origIdx + 1 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：电脑端实时预览 */}
        <div className="hidden lg:block lg:col-span-1 sticky top-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500">{tCommon('preview.title')}</span>
            <span className="text-xs text-red-600 font-bold">
              {t('preview.position', { pos: activeHoverIndex + 1 })}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center min-h-[380px] max-h-[500px] overflow-hidden border border-slate-100">
            {pageCards[activeHoverIndex] ? (
              <img
                src={pageCards[activeHoverIndex].src}
                alt={`Preview page ${activeHoverIndex + 1}`}
                style={{
                  transform: `rotate(${
                    rotations[pageCards[activeHoverIndex].originalIndex] || 0
                  }deg)`,
                }}
                className="max-h-[460px] object-contain rounded shadow-sm transition-transform duration-200"
              />
            ) : (
              <span className="text-xs text-slate-400">{t('preview.hint')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 确认导出文件名弹窗 */}
      {showFilenameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{tCommon('filename.title')}</h3>
              <button
                onClick={() => setShowFilenameModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full"
              >
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
              <button
                onClick={() => setShowFilenameModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={isProcessing}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isProcessing ? tCommon('status.processing') : tCommon('actions.confirmDownload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}