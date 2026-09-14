import Navbar from '@/components/layout/Navbar';
import PdfDeleteTool from '@/components/features/PdfDeleteTool';
import { Trash2 } from 'lucide-react';

export default function DeletePdfPagesPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-200/60">
          <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">删除 PDF 页面 (Delete Pages)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              点击卡片即可轻松剔除不需要的页面，支持奇偶页快捷与页码范围输入
            </p>
          </div>
        </div>

        <PdfDeleteTool />
      </main>
    </div>
  );
}