import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/layout/Navbar";
import SiteFooter from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/seo";

export type LegalDoc = "privacy" | "terms";

type Section = { heading: string; body: string };

/**
 * Shared shell for the two legal pages (`/privacy`, `/terms`).
 *
 * Content lives in the dictionaries under `Legal.<doc>` as an ordered array of
 * `{ heading, body }` sections, so translators edit prose only and every locale
 * keeps the same structure. The body intentionally stays a single paragraph per
 * section: no inline markup to keep in ten languages.
 */
export default async function LegalPageShell({ docKey }: { docKey: LegalDoc }) {
  const [t, legal, locale] = await Promise.all([
    getTranslations(`Legal.${docKey}`),
    getTranslations("Legal"),
    getLocale(),
  ]);

  const sections = t.raw("sections") as Section[];
  const other: LegalDoc = docKey === "privacy" ? "terms" : "privacy";
  const title = t("title");

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Reeff.PDF", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}/${locale}/${docKey}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <article className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-10">
          <header className="pb-5 border-b border-slate-200/60 space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{t("lastUpdated")}</p>
          </header>

          <p className="mt-5 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("intro")}</p>

          <div className="mt-7 space-y-6">
            {sections.map((section, idx) => (
              <section key={section.heading} className="space-y-1.5">
                <h2 className="text-sm font-bold text-slate-900">
                  {idx + 1}. {section.heading}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-8 pt-5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              {t("contactLabel")}{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-red-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <Link
              href={`/${other}`}
              className="text-xs font-bold text-slate-600 hover:text-red-600 transition-colors"
            >
              {legal(`${other}.title`)} →
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </div>
  );
}
