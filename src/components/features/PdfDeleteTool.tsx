'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { removePDFPages } from '@/lib/pdf-delete';
import {
  Upload,
  Download,
  Loader2,
  Trash2,
  Undo2,
  Check,
  Binary,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

// 辅助函数：解析 "1-5, 8, 12-20" 页码表达式
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

export default function PdfDeleteTool() {
  const t = useTranslations('PdfDelete');
  const tCommon = useTranslations('Common');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 记录被标记为【删除】的页码索引数组
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [pageRangeInput, setPageRangeInput] = useState('');

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
        setDeletedPages([]); // 初始化清空删除标记
      } catch (err) {
        alert(tCommon('errors.parsePdf'));
      } finally {
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [file]);

  // 点击卡片切换标记状态（如果已删除则恢复，未删除则标记删除）
  const toggleDeletePage = (idx: number) => {
    setDeletedPages((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  // 快速选择奇/偶页标记删除（带有智能开关逻辑）
  const toggleOddEvenPagesToDelete = (type: 'odd' | 'even') => {
    const totalCount = thumbnails.length;
    const targetIndices: number[] = [];

    for (let i = 0; i < totalCount; i++) {
      const pageNum = i + 1;
      if (type === 'odd' && pageNum % 2 !== 0) targetIndices.push(i);
      else if (type === 'even' && pageNum % 2 === 0) targetIndices.push(i);
    }

    const isAllTargetDeleted =
      targetIndices.length > 0 &&
      targetIndices.every((idx) => deletedPages.includes(idx));

    if (isAllTargetDeleted) {
      setDeletedPages((prev) => prev.filter((idx) => !targetIndices.includes(idx)));
    } else {
      setDeletedPages((prev) => Array.from(new Set([...prev, ...targetIndices])));
    }
  };

  // 通过页码框选表达式标记删除
  const handleApplyPageRangeToDelete = () => {
    const parsed = parsePageRange(pageRangeInput, thumbnails.length);
    if (parsed.length === 0) return alert(tCommon('errors.invalidRange'));
    setDeletedPages((prev) => Array.from(new Set([...prev, ...parsed])));
    setPageRangeInput('');
  };

  // 导出生成剔除后的 PDF
  const handleExport = async () => {
    if (!file) return;
    if (deletedPages.length === thumbnails.length) {
      return alert(t('errors.keepOnePage'));
    }

    try {
      setIsProcessing(true);
      const pdfBytes = await removePDFPages(file, deletedPages);

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const baseName = file.name.replace(/\.pdf$/i, '');
      link.download = `${baseName}_deleted.pdf`;

      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(tCommon('errors.exportFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 遵循整站统一的上传区域格式
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

  const remainingPageCount = thumbnails.length - deletedPages.length;

  return (
    <div className="space-y-6 select-none pb-12">
      {/* 固定结构的主容器视口 */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-220px)] min-h-[500px]">
        
        {/* 固定吸顶控制栏 */}
        <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          
          {/* 左侧：文件信息与统计 */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-sm">
                {file.name}
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400">
                <span>{t('status.totalPages', { total: thumbnails.length })}</span>
                <span className="text-slate-600">•</span>
                <span className="text-red-400">{t('status.marked', { count: deletedPages.length })}</span>
                <span className="text-slate-600">•</span>
                <span>{t('status.remaining', { count: remainingPageCount })}</span>
              </p>
            </div>
          </div>

          {/* 中部：奇偶页与框选批量标记工具 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => toggleOddEvenPagesToDelete('odd')}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              >
                <Binary className="w-3.5 h-3.5 text-red-500" />
                <span>{t('actions.deleteOdd')}</span>
              </button>
              <button
                onClick={() => toggleOddEvenPagesToDelete('even')}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              >
                <Binary className="w-3.5 h-3.5 text-red-500" />
                <span>{t('actions.deleteEven')}</span>
              </button>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <input
                type="text"
                placeholder={t('placeholder.range')}
                value={pageRangeInput}
                onChange={(e) => setPageRangeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyPageRangeToDelete()}
                className="w-24 bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                onClick={handleApplyPageRangeToDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-0.5 rounded font-bold transition-colors shadow-sm"
              >
                {t('actions.deleteRange')}
              </button>
            </div>
          </div>

          {/* 右侧：恢复全部与下载导出 */}
          <div className="flex items-center space-x-2 ml-auto">
            {deletedPages.length > 0 && (
              <button
                onClick={() => setDeletedPages([])}
                className="flex items-center space-x-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                title={t('actions.restoreAllTitle')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('actions.restoreAll')}</span>
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={isProcessing || remainingPageCount === 0}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isProcessing ? tCommon('status.processing') : t('actions.generate')}</span>
            </button>
          </div>
        </div>

        {/* 独立内部滚动视口 */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
              <span className="text-sm text-slate-600">{tCommon('status.parsingThumbnails')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {thumbnails.map((src, pageIdx) => {
                const isDeleted = deletedPages.includes(pageIdx);

                return (
                  <div
                    key={pageIdx}
                    onClick={() => toggleDeletePage(pageIdx)}
                    className={`relative bg-white p-2.5 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md ${
                      isDeleted
                        ? 'border-red-500 bg-red-50/20 shadow-none'
                        : 'border-slate-200/80 hover:border-red-300 shadow-sm'
                    }`}
                  >
                    {/* 左上角标记编号徽章 */}
                    <div
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-20 transition-colors ${
                        isDeleted ? 'bg-red-600' : 'bg-slate-300/80 hover:bg-red-400'
                      }`}
                    >
                      {isDeleted ? <Trash2 className="w-3 h-3" /> : pageIdx + 1}
                    </div>

                    {/* 被删除时的半透明遮罩 overlay */}
                    {isDeleted && (
                      <div className="absolute inset-0 bg-red-500/15 backdrop-blur-[0.5px] rounded-xl z-10 flex flex-col items-center justify-center space-y-1 animate-in fade-in duration-150">
                        <div className="p-2 bg-red-600 text-white rounded-full shadow-lg">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-red-700 bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
                          {t('status.clickToRestore')}
                        </span>
                      </div>
                    )}

                    {/* 视口卡片 */}
                    <div className={`aspect-[1/1.3] bg-slate-50 rounded overflow-hidden flex items-center justify-center border border-slate-100 p-1 mt-2 transition-opacity ${
                      isDeleted ? 'opacity-40' : 'opacity-100'
                    }`}>
                      <img
                        src={src}
                        alt=""
                        className="max-h-full max-w-full object-contain pointer-events-none"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-1 px-1 text-[11px] font-medium text-slate-500">
                      <span>{tCommon('status.page', { page: pageIdx + 1 })}</span>
                      {isDeleted ? (
                        <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1 rounded">{t('status.markedBadge')}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">{t('status.kept')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}