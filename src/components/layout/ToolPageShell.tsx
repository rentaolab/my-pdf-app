import { useLocale, useTranslations } from "next-intl";
import AdSlot from "@/components/ads/AdSlot";
import Navbar from "@/components/layout/Navbar";
import RelatedTools from "@/components/layout/RelatedTools";
import SiteFooter from "@/components/layout/SiteFooter";
import ToolContent from "@/components/layout/ToolContent";
import { Link } from "@/i18n/navigation";
import { PDF_WORKER_PATH } from "@/lib/pdf-worker-path";
import { breadcrumbFor, faqSchema, SITE_NAME } from "@/lib/seo";

/** FAQ entries reused on every tool page (translated once per locale). */
const COMMON_FAQ_KEYS = ["free", "privacy", "sizeLimit", "mobile"] as const;

/**
 * Only these four tools rasterise or edit pages through pdf.js. The other seven
 * rewrite the document structure with `pdf-lib` and never start a worker, so
 * warming it for them would download 1.2 MB that is then never executed.
 */
const PDFJS_TOOL_KEYS = new Set(["organize", "crop", "edit", "pdfToImage"]);

/**
 * Shared shell for all 11 tool pages: navbar → P1 ad → breadcrumb → icon/title/
 * description header → the tool itself → P2 ad → related-tools internal links →
 * BreadcrumbList + FAQPage JSON-LD → footer.
 *
 * Keeping this in one place means the 11 pages stay identical in structure and
 * future additions (badges, per-page content sections, FAQ) land in a single file.
 *
 * Ad positions follow docs/monetization.md §2: P1 above the workspace, P2 after
 * it, never inside the tool card and never next to a download button (P2 keeps a
 * 96px gap plus a divider from the card). Both render nothing at all unless
 * advertising is enabled for the build.
 */
export default function ToolPageShell({
  toolKey,
  path,
  icon: Icon,
  children,
}: {
  toolKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const t = useTranslations("ToolPages");
  const tTools = useTranslations("Tools");
  const tFaq = useTranslations("Faq");
  const locale = useLocale();
  const title = t(`${toolKey}.title`);

  // The item URL must include the locale prefix so it matches the canonical.
  const breadcrumb = breadcrumbFor({ path, locale, title });

  // `has()` keeps the build green while a locale is missing a FAQ translation;
  // the JSON-LD is then simply emitted without that entry instead of the page
  // failing to render.
  const faqItems = [
    ...COMMON_FAQ_KEYS.filter((key) => tFaq.has(`common.${key}.q`)).map((key) => ({
      q: tFaq(`common.${key}.q`),
      a: tFaq(`common.${key}.a`),
    })),
    ...(tFaq.has(`tool.${toolKey}.q`)
      ? [{ q: tFaq(`tool.${toolKey}.q`), a: tFaq(`tool.${toolKey}.a`) }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* The 1.2 MB pdf.js worker is only needed once a file is chosen, so it must
          not block the first screen — but a cold fetch at that moment is exactly
          when the visitor is waiting. `prefetch` lets the browser pull it at low
          priority while the page is being read, so the first upload finds it in
          the HTTP cache (served immutable by `public/_headers`). Emitted only on
          the four pages that actually use pdf.js. */}
      {PDFJS_TOOL_KEYS.has(toolKey) && <link rel="prefetch" href={PDF_WORKER_PATH} />}
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <AdSlot placement="p1" />

        {/* Visible breadcrumb — mirrors the BreadcrumbList JSON-LD below. */}
        <nav aria-label="Breadcrumb" className="text-[11px] text-slate-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="font-semibold hover:text-red-600 transition-colors">
                {SITE_NAME}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li className="font-semibold text-slate-700">{tTools(`${toolKey}.name`)}</li>
          </ol>
        </nav>

        <div className="flex items-center space-x-3 pb-4 border-b border-slate-200/60">
          <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t(`${toolKey}.description`)}</p>
          </div>
        </div>

        {children}

        {/* P2: outside the tool card, 96px + divider away from any download
            button, and only rendered when advertising is enabled. */}
        <AdSlot
          placement="p2"
          className="mt-24! border-t border-slate-200/60 pt-8"
        />

        <ToolContent toolKey={toolKey} />

        {/* Visible FAQ. Google requires the Q&A pairs in FAQPage JSON-LD to be
            present on the page itself, so this block and the script below share
            one `faqItems` array and can never drift apart. */}
        {faqItems.length > 0 && (
          <section className="space-y-4 border-t border-slate-200/60 pt-6">
            <h2 className="text-sm font-bold text-slate-900">{tFaq("heading")}</h2>
            <dl className="grid gap-4 md:grid-cols-2">
              {faqItems.map((item) => (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <dt className="text-xs font-bold text-slate-900">{item.q}</dt>
                  <dd className="mt-2 text-xs leading-relaxed text-slate-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <RelatedTools currentPath={path} />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqItems)) }} />
      )}
    </div>
  );
}
