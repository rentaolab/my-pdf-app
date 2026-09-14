'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Merge,
  Split,
  RotateCw,
  Trash2,
  FileOutput,
  Crop,
  Edit3,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

export default function Navbar() {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tools = [
    { name: '页面整理', href: '/organize-pdf', icon: Layers, desc: '可视化拖拽排序与重组' },
    { name: '拼接 PDF', href: '/merge-pdf', icon: Merge, desc: '多个文件无缝拼接' },
    { name: '拆分 PDF', href: '/split-pdf', icon: Split, desc: '按范围提取或切分' },
    { name: '旋转 PDF', href: '/rotate-pdf', icon: RotateCw, desc: '批量调整页面方向' },
    { name: '删除页面', href: '/delete-pdf-pages', icon: Trash2, desc: '剔除不需要的页码' },
    { name: '提取页面', href: '/extract-pdf-pages', icon: FileOutput, desc: '独立抽离选中页面' },
    { name: '裁剪 PDF', href: '/crop-pdf', icon: Crop, desc: '裁剪留白与多余边框' },
    { name: '编辑 PDF', href: '/edit-pdf', icon: Edit3, desc: '添加文字、涂鸦与签名' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#F8FAFC]/85 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* 纯文字 Logo: Reeff.PDF (去掉图形图标，经典红点缀) */}
          <Link href="/" className="flex items-center group">
            <span className="text-2xl font-black text-slate-900 tracking-tight group-hover:opacity-90 transition-opacity">
              Reeff<span className="text-red-500 mr-1">.</span><span className="text-red-600 font-extrabold">PDF</span>
            </span>
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/organize-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all"
            >
              页面整理
            </Link>
            <Link
              href="/merge-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all"
            >
              拼接 PDF
            </Link>
            <Link
              href="/split-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all"
            >
              拆分 PDF
            </Link>

            {/* 所有工具 Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setIsToolsOpen(true)}
              onMouseLeave={() => setIsToolsOpen(false)}
            >
              <button className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all">
                <span>全部工具</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {isToolsOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-[460px] bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800 p-4 grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-150">
                  {tools.map((tool, idx) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={idx}
                        href={tool.href}
                        className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors group"
                      >
                        <div className="p-2 bg-slate-800 group-hover:bg-red-500 text-red-400 group-hover:text-white rounded-lg transition-all shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200 group-hover:text-red-400 transition-colors">
                            {tool.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {tool.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* 右侧 Action 
          <div className="hidden md:flex items-center space-x-3">
            <Link
              href="/edit-pdf"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 shadow-sm shadow-red-500/20"
            >
              改字编辑
            </Link>
          </div>*/}

          {/* 移动端 Hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-700 rounded-lg"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* 移动端 Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white px-4 pt-3 pb-6 space-y-2">
          {tools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Link
                key={idx}
                href={tool.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 hover:bg-red-50"
              >
                <Icon className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-slate-800">{tool.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}