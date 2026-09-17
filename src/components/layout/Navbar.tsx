'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Layers,
  Merge,
  Split,
  RotateCw,
  Trash2,
  FileOutput,
  Crop,
  Edit3,
  FileImage,
  Images,
  GripHorizontal,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';

const tools = [
  { key: 'organize', href: '/organize-pdf', icon: Layers },
  { key: 'merge', href: '/merge-pdf', icon: Merge },
  { key: 'split', href: '/split-pdf', icon: Split },
  { key: 'rotate', href: '/rotate-pdf', icon: RotateCw },
  { key: 'reorderPages', href: '/reorder-pdf-pages', icon: GripHorizontal },
  { key: 'deletePages', href: '/delete-pdf-pages', icon: Trash2 },
  { key: 'extractPages', href: '/extract-pdf-pages', icon: FileOutput },
  { key: 'crop', href: '/crop-pdf', icon: Crop },
  { key: 'edit', href: '/edit-pdf', icon: Edit3 },
  { key: 'pdfToImage', href: '/pdf-to-image', icon: FileImage },
  { key: 'imageToPdf', href: '/image-to-pdf', icon: Images },
] as const;

export default function Navbar() {
  const t = useTranslations();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
              {t('Tools.organize.name')}
            </Link>
            <Link
              href="/merge-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all"
            >
              {t('Tools.merge.name')}
            </Link>
            <Link
              href="/split-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all"
            >
              {t('Tools.split.name')}
            </Link>

            {/* 所有工具 Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setIsToolsOpen(true)}
              onMouseLeave={() => setIsToolsOpen(false)}
            >
              <button className="flex items-center space-x-1 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-all">
                <span>{t('Navbar.allTools')}</span>
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
                            {t(`Tools.${tool.key}.name`)}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {t(`Tools.${tool.key}.desc`)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 语言切换器 */}
            <div className="ml-1 border-l border-slate-200/80 pl-2">
              <LanguageSwitcher />
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
              aria-label={t('Navbar.toggleMenu')}
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
                <span className="text-xs font-bold text-slate-800">
                  {t(`Tools.${tool.key}.name`)}
                </span>
              </Link>
            );
          })}

          {/* 语言切换器 */}
          <div className="mt-1 border-t border-slate-200/80 pt-3">
            <LanguageSwitcher fullWidth />
          </div>
        </div>
      )}
    </header>
  );
}