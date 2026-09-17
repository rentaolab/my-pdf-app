'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { mergePDFs } from '@/lib/pdf-merge';
import { Upload, Trash2, FileText, Download, Sparkles, GripVertical, X } from 'lucide-react';

export default function PdfMergeTool() {
  const t = useTranslations('PdfMerge');
  const tCommon = useTranslations('Common');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 拖拽排序状态记录：当前正在拖拽的 index 和 目标 hover 的 index
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 弹窗与自定义文件名状态
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [customFilename, setCustomFilename] = useState('');

  // 模拟当前用户状态
  const [isVipUser, setIsVipUser] = useState(false);
  const maxAllowedFiles = isVipUser ? Infinity : 2;

  // 处理文件上传与数量拦截
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files).filter(
      (file) => file.type === 'application/pdf'
    );

    const currentTotal = files.length + selectedFiles.length;

    if (currentTotal > maxAllowedFiles) {
      alert(t('errors.freeLimit', { max: maxAllowedFiles }));
      const remainingSlots = Math.max(0, maxAllowedFiles - files.length);
      if (remainingSlots > 0) {
        setFiles((prev) => [...prev, ...selectedFiles.slice(0, remainingSlots)]);
      }
    } else {
      setFiles((prev) => [...prev, ...selectedFiles]);
    }

    e.target.value = '';
  };

  // --- 拖拽排序处理逻辑 (Drag & Drop) ---
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // 必须阻止默认行为以允许 drop
    if (draggedIndex === null || draggedIndex === index) return;

    // 实时交换数组中的元素顺序
    const updatedFiles = [...files];
    const draggedItem = updatedFiles[draggedIndex];
    updatedFiles.splice(draggedIndex, 1);
    updatedFiles.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setFiles(updatedFiles);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // --- 打开文件名确认弹窗 ---
  const handleOpenDownloadModal = () => {
    if (files.length < 2) return alert(t('errors.minFiles'));
    // 设置默认文件名（不带 .pdf 后缀，导出时自动补全）
    setCustomFilename(`merged_${Date.now()}`);
    setShowFilenameModal(true);
  };

  // --- 执行真正的合并并下载 ---
  const handleConfirmDownload = async () => {
    try {
      setIsProcessing(true);
      const mergedBytes = await mergePDFs(files);
      const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // 如果用户把名字填空了，使用默认降级名称
      const finalName = customFilename.trim() || `merged_${Date.now()}`;
      link.download = `${finalName.endsWith('.pdf') ? finalName : `${finalName}.pdf`}`;

      link.click();
      URL.revokeObjectURL(url);
      setShowFilenameModal(false); // 下载完成后关闭弹窗
    } catch (error) {
      console.error(error);
      alert(t('errors.mergeFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 开发调试 Bar */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-800">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>
            {t('dev.modeLabel')}{' '}
            <strong>
              {isVipUser ? t('dev.vip') : t('dev.free', { max: maxAllowedFiles })}
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

      {/* 上传区域 */}
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
            <p className="text-base font-medium text-slate-700">{tCommon('upload.promptMultiple')}</p>
            <p className="text-xs text-slate-500 mt-1">
              {isVipUser ? t('upload.vipHint') : t('upload.freeHint', { max: maxAllowedFiles })}
            </p>
          </div>
        </div>
      </div>

      {/* 已加载：Slate-900 控制面板 + 文件列表 */}
      {files.length > 0 && (
        <>
          {/* Slate-900 现代化控制栏 */}
          <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 shadow-sm shadow-red-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    {t('list.selected', {
                      count: files.length,
                      max: isVipUser ? '∞' : maxAllowedFiles,
                    })}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {(files.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFiles([])}
                  className="flex items-center space-x-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{tCommon('actions.clear')}</span>
                </button>

                <button
                  onClick={handleOpenDownloadModal}
                  disabled={files.length < 2}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('actions.mergeDownload')}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <p className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {!isVipUser && files.length >= 2
                    ? t('footer.limitReached')
                    : isVipUser
                    ? t('upload.vipHint')
                    : t('upload.freeHint', { max: maxAllowedFiles })}
                </span>
              </p>
            </div>
          </div>

          {/* 文件列表 (支持拖拽手柄排序) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-1.5 border-b border-slate-100 px-4 py-3">
              <FileText className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-slate-700">{t('list.dragHint')}</span>
            </div>

            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`px-4 py-3 flex items-center justify-between transition-colors bg-white ${
                    draggedIndex === index ? 'opacity-40 bg-red-50/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    {/* 拖拽手柄图标 */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1 rounded">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>

                  <button
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                    title={t('actions.removeFile')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* 自定义文件名弹窗 (Modal) */}
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
              <div className="flex items-center space-x-2 border border-slate-300 rounded-lg p-2.5 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder={tCommon('filename.placeholder')}
                  className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                  autoFocus
                />
                <span className="text-xs font-semibold text-slate-400">.pdf</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowFilenameModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                onClick={handleConfirmDownload}
                disabled={isProcessing}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isProcessing ? t('actions.generating') : tCommon('actions.confirmDownload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}