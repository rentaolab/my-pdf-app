import { useTranslations } from "next-intl";
import AdSlot from "@/components/ads/AdSlot";
import Navbar from "@/components/layout/Navbar";
import RelatedTools from "@/components/layout/RelatedTools";
import SiteFooter from "@/components/layout/SiteFooter";
import ToolContent from "@/components/layout/ToolContent";
import { SITE_URL } from "@/lib/seo";

/**
 * Shared shell for all 11 tool pages: navbar → P1 ad → icon/title/description
 * header → the tool itself → P2 ad → related-tools internal links →
 * BreadcrumbList JSON-LD → footer.
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
  const title = t(`${toolKey}.title`);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Reeff.PDF", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${path}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <AdSlot placement="p1" />

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

        <RelatedTools currentPath={path} />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </div>
  );
}
