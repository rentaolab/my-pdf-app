'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { splitPDFByPoints } from '@/lib/pdf-split';
import {
  Upload,
  Split,
  Scissors,
  Download,
  RefreshCw,
  Loader2,
  Plus,
  Eye,
  CheckSquare,
  Square,
  Sparkles,
  X,
  FileCheck,
} from 'lucide-react';

export default function PdfSplitTool() {
  const t = useTranslations('PdfSplit');
  const tCommon = useTranslations('Common');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 用户手动取消勾选的 Part 索引
  const [unselectedPartIndexes, setUnselectedPartIndexes] = useState<number[]>([]);

  // 悬停在 Part 标签上时的索引（用于高亮属于该 Part 的卡片）
  const [hoveredPartIndex, setHoveredPartIndex] = useState<number | null>(null);

  // 手机与电脑预览状态
  const [activeHoverIndex, setActiveHoverIndex] = useState<number>(0);
  const [mobileZoomedIndex, setMobileZoomedIndex] = useState<number | null>(null);

  // 模拟 VIP 权限状态
  const [isVipUser, setIsVipUser] = useState(false);
  const maxAllowedSplits = isVipUser ? Infinity : 1;

  // 下载确认弹窗状态
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [customFilenamePrefix, setCustomFilenamePrefix] = useState('');
  
  // 新增：是否开启“独立定义每个文件名”的 Switch
  const [isCustomEachName, setIsCustomEachName] = useState(false);
  // 新增：记录每个 Part 独立文件名的映射字典 { [partIdx]: 'filename' }
  const [individualNames, setIndividualNames] = useState<{ [key: number]: string }>({});

  // 派生计算
  const totalParts = splitPoints.length + 1;
  const selectedPartIndexes = Array.from({ length: totalParts }, (_, i) => i)
    .filter((i) => !unselectedPartIndexes.includes(i));

  // 💡 计算每个 Part 对应的页面范围列表：[{ start: 0, end: 2 }, { start: 3, end: 5 }]
  const partRanges = (() => {
    const ranges: { start: number; end: number }[] = [];
    let currentStart = 0;
    const sortedPoints = [...splitPoints].sort((a, b) => a - b);

    for (const point of sortedPoints) {
      ranges.push({ start: currentStart, end: point });
      currentStart = point + 1;
    }
    ranges.push({ start: currentStart, end: thumbnails.length - 1 });
    return ranges;
  })();

  // 💡 辅助函数：判断某个页面 index 是否属于当前鼠标悬停的 Part
  const isPageInHoveredPart = (pageIdx: number) => {
    if (hoveredPartIndex === null || !partRanges[hoveredPartIndex]) return false;
    const range = partRanges[hoveredPartIndex];
    return pageIdx >= range.start && pageIdx <= range.end;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSplitPoints([]);
      setUnselectedPartIndexes([]);
      setActiveHoverIndex(0);
      setMobileZoomedIndex(null);
      setHoveredPartIndex(null);
    }
  };

  useEffect(() => {
    if (!file) return;
    async function loadThumbnails() {
      try {
        setIsLoading(true);
        const images = await renderPDFToImages(file!);
        setThumbnails(images);
      } catch (err) {
        alert(t('errors.readFailed'));
        setFile(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadThumbnails();
  }, [file]);

  const toggleSplitPoint = (index: number) => {
    setUnselectedPartIndexes([]);
    if (splitPoints.includes(index)) {
      setSplitPoints(splitPoints.filter((i) => i !== index));
    } else {
      if (splitPoints.length >= maxAllowedSplits) {
        alert(
          t('errors.freeLimit', { max: maxAllowedSplits })
        );
        return;
      }
      setSplitPoints([...splitPoints, index].sort((a, b) => a - b));
    }
  };

  const toggleSelectPart = (partIdx: number) => {
    setUnselectedPartIndexes((prev) =>
      prev.includes(partIdx)
        ? prev.filter((i) => i !== partIdx)
        : [...prev, partIdx]
    );
  };

  const toggleSelectAllParts = () => {
    if (selectedPartIndexes.length === totalParts) {
      setUnselectedPartIndexes(Array.from({ length: totalParts }, (_, i) => i));
    } else {
      setUnselectedPartIndexes([]);
    }
  };

  // 打开导出确认弹窗
  const handleOpenExportModal = () => {
    if (!file) return;
    if (selectedPartIndexes.length === 0) {
      alert(t('errors.noPartsSelected'));
      return;
    }
    const baseName = file.name.replace(/\.pdf$/i, '');
    setCustomFilenamePrefix(`${baseName}_split`);
    
    // 初始化每个 Part 的默认独立文件名
    const defaultIndividual: { [key: number]: string } = {};
    selectedPartIndexes.forEach((partIdx) => {
      defaultIndividual[partIdx] = `${baseName}_part_${partIdx + 1}`;
    });
    setIndividualNames(defaultIndividual);

    setShowFilenameModal(true);
  };

  // 确认并导出文件
  const handleConfirmExport = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      const allPdfs = await splitPDFByPoints(file, splitPoints);

      selectedPartIndexes.forEach((partIdx) => {
        const bytes = allPdfs[partIdx];
        if (!bytes) return;

        // 根据 Switch 状态获取对应的文件名
        let fileName = '';
        if (isCustomEachName) {
          fileName = individualNames[partIdx]?.trim() || `part_${partIdx + 1}`;
        } else {
          const prefix = customFilenamePrefix.trim() || 'split';
          fileName = `${prefix}_part_${partIdx + 1}`;
        }

        if (!fileName.endsWith('.pdf')) {
          fileName += '.pdf';
        }

        const blob = new Blob([bytes as unknown as BlobPart], {
          type: 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      });

      setShowFilenameModal(false);
    } catch (err) {
      console.error(err);
      alert(tCommon('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>
              {t('dev.modeLabel')}
              <strong>
                {isVipUser ? t('dev.vip') : t('dev.free', { max: maxAllowedSplits })}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setIsVipUser(!isVipUser)}
            className="bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
          >
            {t('dev.switchTo')} {isVipUser ? t('dev.freeMode') : t('dev.vipMode')}
          </button>
        </div>

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
              <p className="text-xs text-slate-500 mt-1">
                {t('upload.hint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        <p className="text-sm text-slate-600">{t('status.parsing')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slate-900 现代化控制栏 */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
              <Split className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-sm">
                {file.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('status.splitPoints', {
                  count: splitPoints.length,
                  max: maxAllowedSplits === Infinity ? tCommon('unlimited') : maxAllowedSplits,
                })}
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
              disabled={isProcessing || selectedPartIndexes.length === 0}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>
                {isProcessing
                  ? tCommon('status.processing')
                  : t('actions.exportSelected', { selected: selectedPartIndexes.length, total: totalParts })}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 区块选择与悬停高亮控制区 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <FileCheck className="w-4 h-4 text-red-600" />
            <span>{t('parts.title')}</span>
          </span>
          <button
            onClick={toggleSelectAllParts}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            {selectedPartIndexes.length === totalParts ? tCommon('actions.deselectAll') : t('actions.selectAllParts')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalParts }).map((_, partIdx) => {
            const isChecked = selectedPartIndexes.includes(partIdx);
            const isHovered = hoveredPartIndex === partIdx;

            return (
              <button
                key={partIdx}
                onClick={() => toggleSelectPart(partIdx)}
                onMouseEnter={() => setHoveredPartIndex(partIdx)}
                onMouseLeave={() => setHoveredPartIndex(null)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isHovered
                    ? 'border-red-600 bg-red-100 text-red-800 ring-2 ring-red-400/30 scale-105'
                    : isChecked
                    ? 'border-red-600 bg-red-50 text-red-700 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>{t('parts.partLabel', { index: partIdx + 1 })}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 网格预览区 */}
        <div className="lg:col-span-2 bg-slate-100 p-4 sm:p-6 rounded-xl border border-slate-200">
          <p className="text-xs text-slate-400 mb-3 block sm:hidden">
            {t('parts.hint')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {thumbnails.map((src, index) => {
              const isSplitAfter = splitPoints.includes(index);
              const isMobileZoomed = mobileZoomedIndex === index;
              const isInHoveredPart = isPageInHoveredPart(index);

              // 💡 根据索引动态计算放大方向，防止超出左右两侧边缘：
              // 偶数（左卡片）：向右靠齐（origin-left-center）
              // 奇数（右卡片）：向左靠齐（origin-right-center）
              const originClass = index % 2 === 0 ? 'origin-left' : 'origin-right';

              return (
                <div key={index} className="flex items-center space-x-2 my-2 relative">
                  {/* 缩略图卡片：使用动态 originClass 完美平移原点 */}
                  <div
                    onMouseEnter={() => setActiveHoverIndex(index)}
                    onClick={() => {
                      setActiveHoverIndex(index);
                      setMobileZoomedIndex(isMobileZoomed ? null : index);
                    }}
                    className={`relative w-28 bg-white p-2 rounded-lg border transition-all duration-300 cursor-pointer shadow-sm ${originClass} ${
                      isInHoveredPart
                        ? 'border-red-600 ring-4 ring-red-500/30 scale-105 bg-red-50/20 z-10'
                        : activeHoverIndex === index
                        ? 'border-red-600 ring-2 ring-red-500/20'
                        : 'border-slate-200'
                    } ${
                      /* 手机端放大 50% 动画：平滑原位向屏幕内部延伸放大 */
                      isMobileZoomed
                        ? 'scale-150 z-40 shadow-2xl ring-4 ring-red-500/50'
                        : 'hover:scale-105'
                    }`}
                  >
                    {isInHoveredPart && (
                      <div className="absolute -top-2 -left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow z-20">
                        Part {hoveredPartIndex! + 1}
                      </div>
                    )}

                    <img
                      src={src}
                      alt={`Page ${index + 1}`}
                      className="w-full h-36 object-contain bg-slate-50 rounded"
                    />
                    <div className="flex items-center justify-between mt-1 px-1">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {tCommon('status.page', { page: index + 1 })}
                      </span>
                      <Eye className="w-3.5 h-3.5 text-slate-400 lg:hidden" />
                    </div>
                  </div>

                  {/* 拆分线 */}
                  {index < thumbnails.length - 1 && (
                    <button
                      onClick={() => toggleSplitPoint(index)}
                      className={`group relative flex items-center justify-center w-8 h-36 rounded-md border-2 border-dashed transition-all z-10 ${
                        isSplitAfter
                          ? 'border-red-500 bg-red-50 text-red-600'
                          : 'border-slate-300 hover:border-red-500 bg-white text-slate-400'
                      }`}
                      title={isSplitAfter ? t('actions.uncut') : t('actions.cutHere')}
                    >
                      {isSplitAfter ? (
                        <Scissors className="w-5 h-5 animate-bounce" />
                      ) : (
                        <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                      )}
                      {isSplitAfter && (
                        <span className="absolute -bottom-6 text-[10px] font-bold text-red-500 whitespace-nowrap">
                          {t('badge.cut')}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 侧边大图预览 */}
        <div className="hidden lg:block lg:col-span-1 sticky top-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-500">{tCommon('preview.title')}</span>
            <span className="text-xs text-red-600 font-bold">
              {tCommon('status.page', { page: activeHoverIndex + 1 })}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center min-h-[380px] max-h-[500px] overflow-hidden border border-slate-100">
            {thumbnails[activeHoverIndex] ? (
              <img
                src={thumbnails[activeHoverIndex]}
                alt={`Preview page ${activeHoverIndex + 1}`}
                className="max-h-[460px] object-contain rounded shadow-sm transition-all duration-150"
              />
            ) : (
              <span className="text-xs text-slate-400">{t('preview.hint')}</span>
            )}
          </div>
        </div>
      </div>

      

      {/* 确认导出与自定义文件名弹窗 */}
      {showFilenameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{t('modal.title')}</h3>
              <button
                onClick={() => setShowFilenameModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs text-slate-600">
              <p>
                {t('modal.summary', { count: selectedPartIndexes.length })}
              </p>

              {/* 💡 Switch 开关：独立定义每个文件名 */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">{t('modal.customNames')}</span>
                <button
                  type="button"
                  onClick={() => setIsCustomEachName(!isCustomEachName)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isCustomEachName ? 'bg-red-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isCustomEachName ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 模式 A：统一前缀 */}
              {!isCustomEachName ? (
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">{t('modal.prefixLabel')}</label>
                  <div className="flex items-center space-x-2 border border-slate-300 rounded-lg p-2.5">
                    <input
                      type="text"
                      value={customFilenamePrefix}
                      onChange={(e) => setCustomFilenamePrefix(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-slate-400">_part_X.pdf</span>
                  </div>
                </div>
              ) : (
                /* 模式 B：单独定义每一个 Part 文件名 */
                <div className="space-y-2.5 pt-1">
                  <label className="font-medium text-slate-700 block">{t('modal.perPartLabel')}</label>
                  {selectedPartIndexes.map((partIdx) => (
                    <div key={partIdx} className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-red-600 w-16 flex-shrink-0">
                        Part {partIdx + 1}:
                      </span>
                      <div className="flex-1 flex items-center space-x-1 border border-slate-300 rounded-lg p-2 focus-within:ring-2 focus-within:ring-red-500">
                        <input
                          type="text"
                          value={individualNames[partIdx] || ''}
                          onChange={(e) =>
                            setIndividualNames({
                              ...individualNames,
                              [partIdx]: e.target.value,
                            })
                          }
                          className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400">.pdf</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowFilenameModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={isProcessing}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isProcessing ? tCommon('status.processing') : t('actions.confirmBatchDownload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}