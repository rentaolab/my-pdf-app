'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  compressPdf,
  CompressionCancelled,
  isRasterLevel,
  type CompressLevel,
  type CompressResult,
} from '@/lib/pdf-compress';
import {
  Upload,
  Download,
  Loader2,
  Check,
  ArrowRight,
  X,
  TriangleAlert,
  FileText,
  RotateCcw,
} from 'lucide-react';

/** Shown top-to-bottom; `light` stays first because it is the safe default. */
const LEVELS: CompressLevel[] = ['light', 'balanced', 'strong'];

/**
 * Above this size the image levels get slow enough that a warning is worth the
 * space. It is a hint, not a cap — the tool never refuses a file (`Faq.common`
 * promises there is no limit imposed by us).
 */
const HEAVY_FILE_BYTES = 40 * 1024 * 1024;

/**
 * The workspace for `/compress-pdf`.
 *
 * Deliberately *not* a single "Compress" button: the two families of levels do
 * different things to the document, and the honest framing (`docs/brand-brief.md`
 * §5) is to let the visitor choose and then show both sizes. The result is never
 * silently larger than the original — if a level cannot beat the source, the
 * card says so instead of handing over a bigger file.
 */
export default function PdfCompressTool() {
  const t = useTranslations('PdfCompress');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressLevel>('light');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read between rendered pages, so cancel takes effect without aborting a page
  // that is mid-render (pdf.js cannot resume an aborted render).
  const cancelRef = useRef(false);

  const formatBytes = (bytes: number) =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: bytes < 1024 * 1024 ? 'kilobyte' : 'megabyte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      alert(tCommon('errors.uploadPdf'));
      return;
    }
    setFile(selected);
    setResult(null);
    setError(null);
    setLevel('light');
  };

  const resetTool = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const run = async (nextLevel: CompressLevel = level) => {
    if (!file || isProcessing) return;

    cancelRef.current = false;
    setError(null);
    setResult(null);
    setIsProcessing(true);
    setProgress(isRasterLevel(nextLevel) ? { done: 0, total: 0 } : null);

    try {
      const outcome = await compressPdf(file, nextLevel, {
        onProgress: (done, total) => setProgress({ done, total }),
        shouldCancel: () => cancelRef.current,
      });
      setResult(outcome);
    } catch (err) {
      if (err instanceof CompressionCancelled) return;
      const name = (err as { name?: string })?.name;
      if (name === 'EncryptedPDFError' || name === 'PasswordException') {
        setError(t('errors.encrypted'));
      } else if (name === 'InvalidPDFException') {
        setError(t('errors.readFailed'));
      } else {
        console.error(err);
        setError(t('errors.compressFailed'));
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const blob = new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
    link.click();
    URL.revokeObjectURL(url);
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

  // A level that cannot beat the original is reported, never offered as a
  // download: shipping a bigger file and calling it compression costs trust.
  const grew = result !== null && result.bytes.length >= file.size;
  const savedPercent = result
    ? Math.max(0, Math.round((1 - result.bytes.length / file.size) * 100))
    : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        {/* File identity: name + original size is the number everything is
            compared against, so it stays visible while a level runs. */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[220px] sm:max-w-md">
                {file.name}
              </p>
              <p className="text-[11px] text-slate-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            onClick={resetTool}
            disabled={isProcessing}
            className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            {tCommon('actions.clear')}
          </button>
        </div>

        <fieldset>
          <legend className="text-xs font-bold text-slate-900">{t('levels.label')}</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {LEVELS.map((option) => {
              const active = option === level;
              return (
                <label
                  key={option}
                  className={`relative cursor-pointer rounded-2xl border p-4 transition-colors ${
                    active
                      ? 'border-red-500 bg-red-50/40 ring-1 ring-red-500/30'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${isProcessing ? 'opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="compress-level"
                    value={option}
                    checked={active}
                    disabled={isProcessing}
                    onChange={() => {
                      setLevel(option);
                      setResult(null);
                    }}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{t(`levels.${option}`)}</span>
                    {active && <Check className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {t(`levels.${option}Body`)}
                  </p>
                </label>
              );
            })}
          </div>
        </fieldset>

        {isRasterLevel(level) && file.size > HEAVY_FILE_BYTES && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            <TriangleAlert className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            {t('warning.heavy')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => run()}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 active:scale-95 disabled:bg-slate-300"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            {isProcessing ? tCommon('status.processing') : t('actions.compress')}
          </button>

          {isProcessing && isRasterLevel(level) && (
            <button
              onClick={handleCancel}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              {tCommon('actions.cancel')}
            </button>
          )}

          {isProcessing && progress && progress.total > 0 && (
            <div className="flex flex-1 items-center gap-3 min-w-[180px]">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {t('status.progress', { done: progress.done, total: progress.total })}
              </span>
            </div>
          )}

          {isProcessing && progress?.total === 0 && (
            <span className="text-[11px] font-semibold text-slate-500">{t('status.working')}</span>
          )}
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
            <TriangleAlert className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">{t('result.heading')}</h2>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t('result.before')}
              </p>
              <p className="text-sm font-bold text-slate-500 line-through decoration-slate-300">
                {formatBytes(file.size)}
              </p>
            </div>
            <ArrowRight className="mb-1 w-4 h-4 text-slate-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t('result.after')}
              </p>
              <p className={`text-lg font-black ${grew ? 'text-slate-700' : 'text-red-600'}`}>
                {formatBytes(result.bytes.length)}
              </p>
            </div>
            {!grew && savedPercent > 0 && (
              <span className="mb-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                {t('result.saved', { percent: savedPercent })}
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            {result.rasterized ? t('result.rasterNote') : t('result.losslessNote')}
          </p>

          {grew ? (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              <TriangleAlert className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              {t('result.notSmaller')}
            </p>
          ) : (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              {t('actions.download')}
            </button>
          )}

          <button
            onClick={() => setResult(null)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:text-slate-900"
          >
            <RotateCcw className="w-3 h-3" />
            {t('actions.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
