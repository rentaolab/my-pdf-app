'use client';

import { useState, useEffect } from 'react';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { extractPagesToMergedPDF, extractPagesToZip } from '@/lib/pdf-extract';
import {
  Upload,
  Download,
  RefreshCw,
  Check,
  CheckSquare,
  Square,
  Binary,
  Layers,
  Archive,
  FileCheck2,
} from 'lucide-react';

// 解析 "1-5, 8, 12-20" 页码表达式
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

export default function PdfExtractTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 记录选中的提取页码
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageRangeInput, setPageRangeInput] = useState('');

  // 导出模式：'single' (合并成一个PDF) 或 'zip' (分拆成 ZIP)
  const [exportMode, setExportMode] = useState<'single' | 'zip'>('single');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    if (selected.type !== 'application/pdf') return alert('请上传 PDF 文件');

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
        // 默认全选，方便用户直接提取全部或做反向剔除
        setSelectedPages(images.map((_, idx) => idx));
      } catch (err) {
        alert('解析 PDF 页面失败');
      } finally {
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [file]);

  const toggleSelectPage = (idx: number) => {
    setSelectedPages((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPages.length === thumbnails.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(thumbnails.map((_, idx) => idx));
    }
  };

  // 奇偶页智能选/关
  const toggleOddEvenPages = (type: 'odd' | 'even') => {
    const totalCount = thumbnails.length;
    const targetIndices: number[] = [];

    for (let i = 0; i < totalCount; i++) {
      const pageNum = i + 1;
      if (type === 'odd' && pageNum % 2 !== 0) targetIndices.push(i);
      else if (type === 'even' && pageNum % 2 === 0) targetIndices.push(i);
    }

    const isAllTargetSelected =
      targetIndices.length > 0 &&
      targetIndices.every((idx) => selectedPages.includes(idx));

    if (isAllTargetSelected) {
      setSelectedPages((prev) => prev.filter((idx) => !targetIndices.includes(idx)));
    } else {
      setSelectedPages((prev) => Array.from(new Set([...prev, ...targetIndices])));
    }
  };

  // 表达式框选
  const handleApplyPageRange = () => {
    const parsed = parsePageRange(pageRangeInput, thumbnails.length);
    if (parsed.length === 0) return alert('请输入有效的页码表达式（如：1-5, 8）');
    setSelectedPages(parsed);
    setPageRangeInput('');
  };

  // 执行真正的导出提取
  const handleExport = async () => {
    if (!file) return;
    if (selectedPages.length === 0) return alert('请先勾选需要提取的页面！');

    try {
      setIsProcessing(true);
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (exportMode === 'single') {
        const pdfBytes = await extractPagesToMergedPDF(file, selectedPages);
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_extracted.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const zipBlob = await extractPagesToZip(file, selectedPages);
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_extracted_pages.zip`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('提取过程发生错误');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. 统一风格的上传框
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
            <p className="text-base font-medium text-slate-700">点击或拖拽 PDF 文件到此处上传</p>
            <p className="text-xs text-slate-500 mt-1">
              抽取选中的页面独立导出为新 PDF 或打包为 ZIP 压缩包
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none pb-12">
      {/* 2. 主容器视口 */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-220px)] min-h-[500px]">
        
        {/* 吸顶控制栏 */}
        <div className="bg-white px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          
          {/* 左侧：全选与计数 */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              {selectedPages.length === thumbnails.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  <span>取消全选</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>全选 ({selectedPages.length}/{thumbnails.length})</span>
                </>
              )}
            </button>

            <span className="text-xs font-bold text-slate-700 hidden sm:inline-block max-w-[180px] truncate">
              {file.name}
            </span>
          </div>

          {/* 中部：奇偶与框选 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => toggleOddEvenPages('odd')}
                className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              >
                <Binary className="w-3.5 h-3.5 text-red-600" />
                <span>奇数页</span>
              </button>
              <button
                onClick={() => toggleOddEvenPages('even')}
                className="flex items-center space-x-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              >
                <Binary className="w-3.5 h-3.5 text-red-600" />
                <span>偶数页</span>
              </button>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
              <input
                type="text"
                placeholder="如: 1-3, 7"
                value={pageRangeInput}
                onChange={(e) => setPageRangeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyPageRange()}
                className="w-24 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                onClick={handleApplyPageRange}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-0.5 rounded font-bold transition-colors shadow-sm"
              >
                框选
              </button>
            </div>
          </div>

          {/* 右侧：模式切换与导出 */}
          <div className="flex items-center space-x-2 ml-auto">
            {/* 模式选择 Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setExportMode('single')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  exportMode === 'single'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="所有提取页面合并为一个 PDF 文件"
              >
                <Layers className="w-3 h-3 text-red-600" />
                <span>合并导出</span>
              </button>
              <button
                onClick={() => setExportMode('zip')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  exportMode === 'zip'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="每个页面独立拆分为单个文件并打包为 ZIP"
              >
                <Archive className="w-3 h-3 text-red-600" />
                <span>单页打包 ZIP</span>
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={isProcessing || selectedPages.length === 0}
              className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isProcessing ? '提取导出中...' : `提取 (${selectedPages.length} 页)`}</span>
            </button>
          </div>
        </div>

        {/* 3. 网格内容视口 */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 text-red-600">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">正在解析页面缩略图...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {thumbnails.map((src, pageIdx) => {
                const isSelected = selectedPages.includes(pageIdx);

                return (
                  <div
                    key={pageIdx}
                    onClick={() => toggleSelectPage(pageIdx)}
                    className={`relative bg-white p-2.5 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md ${
                      isSelected
                        ? 'border-2 border-red-600 bg-red-50/10 shadow-sm'
                        : 'border border-slate-200/80 opacity-60 hover:opacity-100 hover:border-red-300'
                    }`}
                  >
                    {/* 勾选徽章 */}
                    <div
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10 transition-colors ${
                        isSelected ? 'bg-red-600' : 'bg-slate-300/80'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : pageIdx + 1}
                    </div>

                    {/* 提取标识 Pill */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 bg-slate-900/90 text-teal-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shadow z-10 flex items-center space-x-0.5">
                        <FileCheck2 className="w-2.5 h-2.5" />
                        <span>提取</span>
                      </div>
                    )}

                    {/* 视口卡片 */}
                    <div className="aspect-[1/1.3] bg-slate-50 rounded overflow-hidden flex items-center justify-center border border-slate-100 p-1 mt-2">
                      <img
                        src={src}
                        alt=""
                        className="max-h-full max-w-full object-contain pointer-events-none"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-1 px-1 text-[11px] font-medium text-slate-500">
                      <span>第 {pageIdx + 1} 页</span>
                      {isSelected && <span className="text-[9px] text-red-600 font-bold bg-red-50 px-1 rounded">已选中</span>}
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