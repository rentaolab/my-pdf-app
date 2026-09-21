import { useTranslations } from "next-intl";
import Navbar from "@/components/layout/Navbar";
import RelatedTools from "@/components/layout/RelatedTools";
import ToolContent from "@/components/layout/ToolContent";
import { SITE_URL } from "@/lib/seo";

/**
 * Shared shell for all 11 tool pages: navbar → icon/title/description header →
 * the tool itself → related-tools internal links → BreadcrumbList JSON-LD.
 *
 * Keeping this in one place means the 11 pages stay identical in structure and
 * future additions (badges, per-page content sections, FAQ) land in a single file.
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

        <ToolContent toolKey={toolKey} />

        <RelatedTools currentPath={path} />
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </div>
  );
}
