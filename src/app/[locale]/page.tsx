import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Navbar from '@/components/layout/Navbar';
import { alternatesFor } from '@/lib/seo';
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
  ArrowUpRight,
} from 'lucide-react';

/**
 * The home page keeps the layout's full localized title (no template) and only
 * adds the description + canonical/hreflang for its own path.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('Metadata'), getLocale()]);

  return {
    description: t('description'),
    alternates: alternatesFor('', locale),
  };
}

export default function Home() {
  const t = useTranslations();
  const toolCards = [
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
          {t.rich('HomePage.heroTitle', {
            highlight: (chunks) => (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-500">
                {chunks}
              </span>
            ),
          })}
        </h1>
        
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          {t('HomePage.heroSubtitle')}
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
                      {t(`Tools.${card.key}.name`)}
                    </h3>

                    {/* 悬浮态：晕染淡出的说明文字 */}
                    <p className="text-[11px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 max-h-0 group-hover:max-h-12 transition-all duration-300 ease-out leading-relaxed truncate">
                      {t(`Tools.${card.key}.desc`)}
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
        {t.rich('HomePage.footer', {
          brand: (chunks) => (
            <span className="font-bold text-slate-700">{chunks}</span>
          ),
        })}
      </footer>
    </div>
  );
}