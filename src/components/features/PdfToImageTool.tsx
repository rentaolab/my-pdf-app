'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import {
  renderPDFPageToImageBlob,
  renderPDFPagesToZip,
  getImageExtension,
  getBaseName,
  type ImageFormat,
} from '@/lib/pdf-to-image';
import {
  Upload,
  Download,
  RefreshCw,
  FileImage,
  FileType,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  Archive,
  Ruler,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';

/** 可选的导出分辨率（DPI） */
const DPI_OPTIONS = [96, 150, 300] as const;

const FORMATS: { value: ImageFormat; key: 'png' | 'jpg' | 'webp' }[] = [
  { value: 'png', key: 'png' },
  { value: 'jpeg', key: 'jpg' },
  { value: 'webp', key: 'webp' },
];

export default function PdfToImageTool() {
  const t = useTranslations('PdfToImage');
  const tCommon = useTranslations('Common');

  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 导出设置
  const [format, setFormat] = useState<ImageFormat>('png');
  const [dpi, setDpi] = useState<number>(150);
  const [quality, setQuality] = useState<number>(0.92);

  // 选中的导出页面（默认全选，便于直接整包下载）
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // 预览与单页导出状态
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];

    if (selected.type !== 'application/pdf') {
      alert(tCommon('errors.uploadPdf'));
      e.target.value = '';
      return;
    }

    setFile(selected);
    setThumbnails([]);
    setSelectedPages([]);
    setActiveIndex(0);
    e.target.value = '';
  };

  useEffect(() => {
    if (!file) return;
    const currentFile = file;

    async function loadPreviews() {
      try {
        setIsLoading(true);
        const images = await renderPDFToImages(currentFile);
        setThumbnails(images);
        setSelectedPages(images.map((_, index) => index));
      } catch (err) {
        console.error(err);
        alert(t('errors.readFailed'));
        setFile(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreviews();
  }, [file]);

  const togglePage = (index: number) => {
    setActiveIndex(index);
    setSelectedPages((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  };

  const toggleSelectAll = () => {
    if (selectedPages.length === thumbnails.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(thumbnails.map((_, index) => index));
    }
  };

  const resetTool = () => {
    setFile(null);
    setThumbnails([]);
    setSelectedPages([]);
    setProgress(null);
    setBusyPage(null);
  };

  // 单页下载：按当前格式 / 分辨率即时渲染
  const handleDownloadSingle = async (pageIndex: number) => {
    if (!file) return;

    try {
      setBusyPage(pageIndex);
      const blob = await renderPDFPageToImageBlob(file, pageIndex, {
        format,
        quality,
        dpi,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getBaseName(file.name)}_page_${pageIndex + 1}.${getImageExtension(format)}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('errors.singleFailed'));
    } finally {
      setBusyPage(null);
    }
  };

  // 全页打包下载：逐页渲染并压缩为 ZIP
  const handleDownloadZip = async () => {
    if (!file) return;
    if (selectedPages.length === 0) {
      alert(t('errors.noPages'));
      return;
    }

    try {
      setIsProcessing(true);
      setProgress({ done: 0, total: selectedPages.length });

      const zipBlob = await renderPDFPagesToZip(
        file,
        selectedPages,
        { format, quality, dpi },
        (done, total) => setProgress({ done, total })
      );

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getBaseName(file.name)}_images.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // 1. 上传区
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

  // 2. 解析缩略图
  if (isLoading || thumbnails.length === 0) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        <p className="text-sm text-slate-600">{t('status.parsing')}</p>
      </div>
    );
  }

  const activeThumbnail = thumbnails[activeIndex] ?? thumbnails[0];

  return (
    <div className="space-y-6">
      {/* Slate-900 现代化控制栏 */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
              <FileImage className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-sm">
                {file.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('pages.selectedCount', {
                  selected: selectedPages.length,
                  total: thumbnails.length,
                })}
              </p>
            </div>
          </div>

          <button
            onClick={resetTool}
            className="flex items-center space-x-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{tCommon('actions.reupload')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 输出格式 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <FileType className="w-3.5 h-3.5" />
              <span>{t('format.label')}</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl">
              {FORMATS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFormat(item.value)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    format === item.value
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {t(`format.${item.key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Ruler className="w-3.5 h-3.5" />
              <span>{t('resolution.label')}</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl">
              {DPI_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => setDpi(value)}
                  title={t(
                    value === 96
                      ? 'resolution.standard'
                      : value === 150
                      ? 'resolution.high'
                      : 'resolution.ultra'
                  )}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    dpi === value
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {value} DPI
                </button>
              ))}
            </div>
          </div>

          {/* 质量 */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t('quality.label')}</span>
              </span>
              <span className="text-red-400">
                {format === 'png'
                  ? t('quality.lossless')
                  : `${Math.round(quality * 100)}%`}
              </span>
            </label>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.02}
              value={quality}
              disabled={format === 'png'}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-red-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <p className="flex items-center space-x-1.5 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('upload.tagline')}</span>
          </p>

          <button
            onClick={handleDownloadZip}
            disabled={isProcessing || selectedPages.length === 0}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            <span>
              {isProcessing && progress
                ? t('actions.exporting', { done: progress.done, total: progress.total })
                : t('actions.zipCount', { count: selectedPages.length })}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 页面网格 */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <FileImage className="w-4 h-4 text-red-600" />
              <span>{t('pages.title')}</span>
            </span>
            <button
              onClick={toggleSelectAll}
              className="flex items-center space-x-1.5 text-xs font-medium text-red-600 hover:underline"
            >
              {selectedPages.length === thumbnails.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{tCommon('actions.deselectAll')}</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>{t('pages.selectAll')}</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            {thumbnails.map((src, index) => {
              const isSelected = selectedPages.includes(index);
              const isActive = activeIndex === index;

              return (
                <div
                  key={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`group relative rounded-xl border overflow-hidden bg-white transition-all ${
                    isActive
                      ? 'border-red-500 ring-2 ring-red-500/25 shadow-md'
                      : isSelected
                      ? 'border-red-200 shadow-sm'
                      : 'border-slate-200 opacity-70'
                  }`}
                >
                  <button
                    onClick={() => togglePage(index)}
                    className="block w-full bg-slate-100 p-2"
                  >
                    <img
                      src={src}
                      alt={tCommon('status.page', { page: index + 1 })}
                      className="w-full h-40 object-contain rounded bg-white"
                    />
                  </button>

                  <span className="absolute top-2 left-2 bg-slate-900/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {tCommon('status.page', { page: index + 1 })}
                  </span>

                  <button
                    onClick={() => togglePage(index)}
                    className={`absolute top-2 right-2 p-1 rounded-md transition-colors ${
                      isSelected
                        ? 'bg-red-600 text-white'
                        : 'bg-white/90 text-slate-400 hover:text-red-600'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {getImageExtension(format)}
                    </span>
                    <button
                      onClick={() => handleDownloadSingle(index)}
                      disabled={busyPage !== null || isProcessing}
                      title={t('actions.downloadPage')}
                      className="flex items-center space-x-1 text-[11px] font-bold text-red-600 hover:text-red-700 disabled:text-slate-300 transition-colors"
                    >
                      {busyPage === index ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{tCommon('actions.download')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 实时预览面板 */}
        <div className="lg:col-span-1 sticky top-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500">
              <Eye className="w-3.5 h-3.5" />
              <span>{t('preview.title')}</span>
            </span>
            <span className="text-xs font-bold text-red-600">
              {tCommon('status.page', { page: activeIndex + 1 })}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center min-h-[320px] max-h-[520px] overflow-hidden border border-slate-100">
            {activeThumbnail ? (
              <img
                src={activeThumbnail}
                alt={tCommon('status.page', { page: activeIndex + 1 })}
                className="max-h-[480px] object-contain rounded shadow-sm"
              />
            ) : (
              <span className="text-xs text-slate-400">{t('preview.hint')}</span>
            )}
          </div>

          <button
            onClick={() => handleDownloadSingle(activeIndex)}
            disabled={busyPage !== null || isProcessing}
            className="w-full flex items-center justify-center space-x-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            {busyPage === activeIndex ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{t('actions.downloadPage')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

