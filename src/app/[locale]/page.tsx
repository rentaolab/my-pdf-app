import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import AdSlot from '@/components/ads/AdSlot';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { alternatesFor, faqSchema } from '@/lib/seo';
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
  Minimize2,
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
    { key: 'compress', href: '/compress-pdf', icon: Minimize2 },
  ] as const;

  // Long-form home sections. The dictionary holds them as arrays/objects, so
  // `t.raw` is what keeps the structure instead of returning a joined string.
  const why = t.raw('HomePage.why') as { title: string; body: string }[];
  const groups = [
    { key: 'organize', href: '/organize-pdf' },
    { key: 'convert', href: '/pdf-to-image' },
    { key: 'edit', href: '/edit-pdf' },
  ] as const;
  // Same four questions on every tool page; on the home page they are the
  // visible half of the FAQPage block emitted at the bottom of this component.
  const faqItems = ['free', 'privacy', 'sizeLimit', 'mobile'].map((key) => ({
    q: t(`Faq.common.${key}.q`),
    a: t(`Faq.common.${key}.a`),
  }));

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

                    {/* Description is always visible: on touch devices there is no
                        hover state, and search engines should see real prose. */}
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {t(`Tools.${card.key}.desc`)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Why + task groups: long-form, indexable prose below the tool grid
            plus a second layer of internal links grouped by task instead of by
            tool, which is how people actually search for these jobs. */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-bold text-slate-900">{t('HomePage.whyHeading')}</h2>
            <ul className="mt-4 space-y-4">
              {why.map((item) => (
                <li key={item.title}>
                  <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.body}</p>
                </li>
              ))}
            </ul>
            {/* The mechanics live on their own page; linking from here keeps the
                home page copy short and gives the crawler a second entry point. */}
            <Link
              href="/how-it-works"
              className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-slate-700 transition-colors hover:text-red-600"
            >
              {t('InfoPages.howItWorks.title')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-bold text-slate-900">{t('HomePage.groups.heading')}</h2>
            <ul className="mt-4 space-y-3">
              {groups.map((group) => (
                <li key={group.key}>
                  <Link
                    href={group.href}
                    className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200/70 p-4 transition-all hover:border-red-500/40 hover:shadow-sm"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 transition-colors group-hover:text-red-600">
                        {t(`HomePage.groups.${group.key}.title`)}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {t(`HomePage.groups.${group.key}.body`)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:text-red-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ: the visible Q&A that the FAQPage JSON-LD below refers to. */}
        <section className="mt-16">
          <h2 className="text-sm font-bold text-slate-900">{t('Faq.heading')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {faqItems.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <dt className="text-xs font-bold text-slate-900">{item.q}</dt>
                <dd className="mt-2 text-xs leading-relaxed text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* P3: one in-article unit at the end of the page, so the tool grid
            stays untouched and the ad appears only after the visitor has seen
            the tools. Renders nothing unless advertising is enabled. */}
        <AdSlot placement="p3" className="mt-24 border-t border-slate-200/60 pt-8" />
      </main>

      {/* FAQPage structured data — mirrors the visible FAQ block above. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqItems)) }} />

      {/* 页脚：版权 + 隐私/条款（广告平台要求从主页可达） */}
      <SiteFooter />
    </div>
  );
}