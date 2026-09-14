import Navbar from '@/components/layout/Navbar';
import PdfOrganizeTool from '@/components/features/PdfOrganizeTool';
import { Layers } from 'lucide-react';

export default function OrganizePdfPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-200/60">
          <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">页面整理 (Organize)</h1>
            <p className="text-xs text-slate-500 mt-0.5">可视化网格排序、旋转、插空白页与重组</p>
          </div>
        </div>
        <PdfOrganizeTool />
      </main>
    </div>
  );
}