'use client';

import { useState, useEffect } from 'react';
import { renderPDFToImages } from '@/lib/pdf-edit';
import { processPDFTransformations, PageTransformState } from '@/lib/pdf-rotate';
import {
  Upload,
  Download,
  RefreshCw,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Check,
  CheckSquare,
  Square,
  Undo2,
  FileCheck2,
} from 'lucide-react';

export default function PdfRotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 记录每一页的变换状态
  const [transforms, setTransforms] = useState<{ [key: number]: PageTransformState }>({});
  // 多选选中状态
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

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

        const initialTransforms: { [key: number]: PageTransformState } = {};
        images.forEach((_, idx) => {
          initialTransforms[idx] = { rotation: 0, flipH: false, flipV: false };
        });
        setTransforms(initialTransforms);
        setSelectedPages(images.map((_, idx) => idx));
      } catch (err) {
        alert('解析 PDF 页面失败');
      } finally {
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [file]);

  const applyTransformToSelected = (
    action: 'rotateLeft' | 'rotateRight' | 'flipH' | 'flipV' | 'reset'
  ) => {
    if (selectedPages.length === 0) return alert('请先勾选需要调整姿态的页面');

    setTransforms((prev) => {
      const next = { ...prev };
      selectedPages.forEach((idx) => {
        const current = next[idx] || { rotation: 0, flipH: false, flipV: false };

        if (action === 'rotateRight') {
          next[idx] = { ...current, rotation: (current.rotation + 90) % 360 };
        } else if (action === 'rotateLeft') {
          next[idx] = { ...current, rotation: (current.rotation + 270) % 360 };
        } else if (action === 'flipH') {
          next[idx] = { ...current, flipH: !current.flipH };
        } else if (action === 'flipV') {
          next[idx] = { ...current, flipV: !current.flipV };
        } else if (action === 'reset') {
          next[idx] = { rotation: 0, flipH: false, flipV: false };
        }
      });
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPages.length === thumbnails.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(thumbnails.map((_, idx) => idx));
    }
  };

  const toggleSelectPage = (idx: number) => {
    setSelectedPages((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleExport = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      const pdfBytes = await processPDFTransformations(file, transforms);

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const baseName = file.name.replace(/\.pdf$/i, '');
      link.download = `${baseName}_rotated.pdf`;

      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('调整导出失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. 按照 PdfMergeTool 标准完全统一的上传区域 (虚线边框 + 经典圆圈图标)
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
              支持 90°/180° 方向旋转以及水平与垂直镜面反转
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* 2. 主容器视口 */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-220px)] min-h-[500px]">
        
        {/* 固定 Header 控制栏 */}
        <div className="bg-white px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10">
          {/* 左侧：文件信息与全选 */}
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

            <span className="text-xs font-bold text-slate-700 hidden sm:inline-block max-w-[200px] truncate">
              {file.name}
            </span>
          </div>

          {/* 中部：分类操作工具组 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/80 space-x-1">
              <button
                onClick={() => applyTransformToSelected('rotateLeft')}
                className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold shadow-sm transition-colors"
                title="逆时针旋转 90 度"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                <span>向左转</span>
              </button>

              <button
                onClick={() => applyTransformToSelected('rotateRight')}
                className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold shadow-sm transition-colors"
                title="顺时针旋转 90 度"
              >
                <RotateCw className="w-3.5 h-3.5 text-red-600" />
                <span>向右转</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/80 space-x-1">
              <button
                onClick={() => applyTransformToSelected('flipH')}
                className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold shadow-sm transition-colors"
                title="水平左右镜像"
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-red-600" />
                <span>水平镜像</span>
              </button>

              <button
                onClick={() => applyTransformToSelected('flipV')}
                className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold shadow-sm transition-colors"
                title="垂直上下镜像"
              >
                <FlipVertical className="w-3.5 h-3.5 text-red-600" />
                <span>垂直镜像</span>
              </button>
            </div>

            <button
              onClick={() => applyTransformToSelected('reset')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              title="重置当前选中页"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </div>

          {/* 右侧：下载主动作 */}
          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isProcessing ? '处理导出中...' : '下载 PDF'}</span>
          </button>
        </div>

        {/* 3. 网格内容视口 */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto ">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 text-red-600">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">正在生成高清预览图...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {thumbnails.map((src, pageIdx) => {
                const isChecked = selectedPages.includes(pageIdx);
                const transform = transforms[pageIdx] || { rotation: 0, flipH: false, flipV: false };

                const cssTransform = `rotate(${transform.rotation}deg) scaleX(${
                  transform.flipH ? -1 : 1
                }) scaleY(${transform.flipV ? -1 : 1})`;

                const hasChanged = transform.rotation !== 0 || transform.flipH || transform.flipV;

                return (
                  <div
                    key={pageIdx}
                    onClick={() => toggleSelectPage(pageIdx)}
                    className={`relative bg-white p-2.5 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer hover:scale-105 ${
                      isChecked
                        ? 'border-red-600 ring-2 ring-red-500 bg-red-50/10'
                        : 'border-slate-200/80 hover:border-red-300'
                    }`}
                  >
                    {/* 编号/勾选徽章 */}
                    <div
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10 transition-colors ${
                        isChecked ? 'bg-red-600' : 'bg-slate-300/80 hover:bg-red-400'
                      }`}
                    >
                      {isChecked ? <Check className="w-3 h-3" /> : pageIdx + 1}
                    </div>

                    {/* 修改状态黑色软胶囊 (Pill) */}
                    {hasChanged && (
                      <div className="absolute top-1.5 right-1.5 bg-slate-900/90 text-red-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shadow z-10 flex items-center space-x-1">
                        <FileCheck2 className="w-2.5 h-2.5" />
                        <span>
                          {transform.rotation}°{transform.flipH ? 'H' : ''}{transform.flipV ? 'V' : ''}
                        </span>
                      </div>
                    )}

                    {/* 视口展示 */}
                    <div className="aspect-[1/1.3] bg-slate-50 rounded overflow-hidden flex items-center justify-center border border-slate-100 p-1 mt-2">
                      <img
                        src={src}
                        alt=""
                        style={{ transform: cssTransform }}
                        className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out pointer-events-none"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-slate-500 font-medium">
                      <span>第 {pageIdx + 1} 页</span>
                      {isChecked && <span className="text-[9px] text-red-600 font-bold bg-red-50 px-1 rounded">选中</span>}
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