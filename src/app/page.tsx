import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import {
  Layers,
  Merge,
  Split,
  RotateCw,
  Trash2,
  FileOutput,
  Crop,
  Edit3,
  ArrowUpRight,
} from 'lucide-react';

export default function Home() {
  const toolCards = [
    {
      title: '页面整理',
      desc: '网格拖拽排序、旋转、插空白页与重组',
      href: '/organize-pdf',
      icon: Layers,
    },
    {
      title: '拼接 PDF',
      desc: '按任意顺序将多个文档合并为一个',
      href: '/merge-pdf',
      icon: Merge,
    },
    {
      title: '拆分 PDF',
      desc: '按指定范围或单页独立切分导出',
      href: '/split-pdf',
      icon: Split,
    },
    {
      title: '旋转 PDF',
      desc: '批量纠正 PDF 页面旋转角度',
      href: '/rotate-pdf',
      icon: RotateCw,
    },
    {
      title: '删除页面',
      desc: '一键剔除文档中不需要的页面',
      href: '/delete-pdf-pages',
      icon: Trash2,
    },
    {
      title: '提取页面',
      desc: '挑选特定页面导出为全新的文档',
      href: '/extract-pdf-pages',
      icon: FileOutput,
    },
    {
      title: '裁剪 PDF',
      desc: '可视框自由调整，裁剪留白边框',
      href: '/crop-pdf',
      icon: Crop,
    },
    {
      title: '改字编辑',
      desc: '添加文本、手写签名、涂鸦与标注',
      href: '/edit-pdf',
      icon: Edit3,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      <Navbar />

      {/* Hero 区域：经典红极简标语 */}
      <section className="pt-16 pb-12 text-center px-4 max-w-3xl mx-auto space-y-4">
        {/*<div className="inline-flex items-center space-x-2 bg-slate-900 text-red-400 text-[11px] font-mono px-3.5 py-1 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          <span>reeff.app · 浏览器端私密处理</span>
        </div>*/}
        
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
          轻巧、极简的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-500">PDF 处理工具</span>
        </h1>
        
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          无需安装，无文件大小限制。所有处理均在本地内存完成，数据零上传。
        </p>
      </section>

      {/* 极简 Hover 晕染网格 */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 flex-1 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {toolCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                href={card.href}
                className="group relative bg-white p-6 rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:border-red-500/40 transition-all duration-300 flex flex-col justify-between min-h-[160px] overflow-hidden"
              >
                {/* 悬浮时的红色背景微光 Glow */}
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500 pointer-events-none"></div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-red-400 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300 shadow-sm">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  {/* 常态：只有干净的中文大标题 */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                      {card.title}
                    </h3>

                    {/* 悬浮态：晕染淡出的说明文字 */}
                    <p className="text-[11px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 max-h-0 group-hover:max-h-12 transition-all duration-300 ease-out leading-relaxed truncate">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-slate-200/60 bg-white py-6 text-center text-[11px] text-slate-400">
        © 2026 <span className="font-bold text-slate-700">Reeff.PDF</span> (reeff.app) · 本地加密处理
      </footer>
    </div>
  );
}