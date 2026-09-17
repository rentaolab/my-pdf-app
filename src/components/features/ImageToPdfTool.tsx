'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  imagesToPDF,
  isSupportedImageFile,
  type PdfPageSize,
  type PdfOrientation,
} from '@/lib/image-to-pdf';
import {
  Upload,
  Download,
  Trash2,
  GripVertical,
  ImagePlus,
  Loader2,
  Images,
  Ruler,
  LayoutTemplate,
  RotateCw,
  Sparkles,
} from 'lucide-react';

/** 页边距预设（单位 pt，1 pt = 1/72 inch） */
const MARGIN_PRESETS: { value: number; key: 'none' | 'small' | 'medium' | 'large' }[] = [
  { value: 0, key: 'none' },
  { value: 18, key: 'small' },
  { value: 36, key: 'medium' },
  { value: 72, key: 'large' },
];

const PAGE_SIZES: PdfPageSize[] = ['fit', 'a4', 'letter'];
const ORIENTATIONS: PdfOrientation[] = ['auto', 'portrait', 'landscape'];

const ACCEPTED_IMAGES =
  'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

/**
 * 列表项：为每个文件分配稳定 id，保证拖拽排序时 React 不会重建 DOM 节点
 * （否则 HTML5 拖拽会在中途被浏览器取消）。
 */
interface ImageEntry {
  id: string;
  file: File;
}

let entrySeed = 0;

function createImageEntry(file: File): ImageEntry {
  entrySeed += 1;
  return { id: `${file.name}-${file.size}-${entrySeed}`, file };
}

/**
 * 纯 Canvas 缩略图预览：不依赖任何后端，上传后即时绘制。
 * 使用 devicePixelRatio 保证高清屏下的清晰度。
 */
function ImagePreviewCanvas({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      const maxWidth = 220;
      const maxHeight = 260;
      const scale = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    };

    image.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return <canvas ref={canvasRef} className="rounded-md shadow-sm" />;
}

export default function ImageToPdfTool() {
  const t = useTranslations('ImageToPdf');
  const tCommon = useTranslations('Common');

  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 导出设置
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [orientation, setOrientation] = useState<PdfOrientation>('auto');
  const [margin, setMargin] = useState<number>(18);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selected = Array.from(e.target.files);
    const supported = selected.filter(isSupportedImageFile);

    if (supported.length === 0) {
      alert(t('errors.unsupported'));
      e.target.value = '';
      return;
    }

    if (supported.length < selected.length) {
      alert(t('errors.unsupported'));
    }

    setEntries((prev) => [...prev, ...supported.map(createImageEntry)]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // --- 拖拽排序（HTML5 Drag & Drop，实时交换顺序） ---
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...entries];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setEntries(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 合成导出标准 PDF
  const handleExport = async () => {
    if (entries.length === 0) {
      alert(t('errors.noImages'));
      return;
    }

    try {
      setIsProcessing(true);
      const pdfBytes = await imagesToPDF(
        entries.map((entry) => entry.file),
        { pageSize, orientation, margin }
      );
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });

      const baseName = entries[0].file.name.replace(/\.[^.]+$/, '') || 'images';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_images.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };


  // 1. 上传区（空状态）
  if (entries.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white hover:border-red-500 transition-colors cursor-pointer relative">
        <input
          type="file"
          multiple
          accept={ACCEPTED_IMAGES}
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

  const hasFitPage = pageSize === 'fit';
  const totalSize = entries.reduce((sum, entry) => sum + entry.file.size, 0);

  return (
    <div className="space-y-6">
      {/* Slate-900 现代化控制栏 */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
              <Images className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {t('list.count', { count: entries.length })}
              </p>
              <p className="text-[11px] text-slate-400">
                {(totalSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 继续添加图片 */}
            <div className="relative">
              <input
                type="file"
                multiple
                accept={ACCEPTED_IMAGES}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <span className="flex items-center space-x-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors pointer-events-none">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>{t('list.addMore')}</span>
              </span>
            </div>

            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isProcessing ? t('actions.exporting') : t('actions.export')}
              </span>
            </button>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-4">
          {/* 纸张尺寸 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>{t('settings.pageSize.label')}</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl">
              {PAGE_SIZES.map((value) => (
                <button
                  key={value}
                  onClick={() => setPageSize(value)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    pageSize === value
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {t(`settings.pageSize.${value}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 页面方向 */}
          <div className={`space-y-2 ${hasFitPage ? 'opacity-40' : ''}`}>
            <label className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t('settings.orientation.label')}</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl">
              {ORIENTATIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => setOrientation(value)}
                  disabled={hasFitPage}
                  className={`py-2 rounded-lg text-xs font-bold transition-all disabled:cursor-not-allowed ${
                    orientation === value
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {t(`settings.orientation.${value}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 页边距 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Ruler className="w-3.5 h-3.5" />
              <span>{t('settings.margin.label')}</span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-800 p-1 rounded-xl">
              {MARGIN_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setMargin(preset.value)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    margin === preset.value
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {t(`settings.margin.${preset.key}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* 图片列表：Canvas 预览 + 拖拽排序 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
            <Images className="w-4 h-4 text-red-600" />
            <span>{t('list.title')}</span>
          </span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('list.dragHint')}</span>
            </span>
            <button
              onClick={() => setEntries([])}
              className="text-xs text-red-500 hover:underline"
            >
              {tCommon('actions.clear')}
            </button>
          </div>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl border bg-white transition-all overflow-hidden ${
                draggedIndex === index
                  ? 'border-red-500 opacity-40 ring-2 ring-red-500/30'
                  : 'border-slate-200 hover:border-red-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between px-2 pt-2">
                <span className="flex items-center space-x-1 text-slate-400">
                  <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing" />
                  <span className="text-[10px] font-bold text-slate-500">
                    #{index + 1}
                  </span>
                </span>
                <button
                  onClick={() => removeFile(index)}
                  title={t('actions.remove')}
                  className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-center py-3 min-h-[180px]">
                <ImagePreviewCanvas file={entry.file} />
              </div>

              <div className="px-3 pb-3 space-y-0.5">
                <p
                  className="text-[11px] font-medium text-slate-700 truncate"
                  title={entry.file.name}
                >
                  {entry.file.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

