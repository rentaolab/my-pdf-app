import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/layout/Navbar";
import SiteFooter from "@/components/layout/SiteFooter";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/seo";

export type InfoPageKey = "about" | "howItWorks";

/** Locale-free path per page key; the `Link` wrapper adds the locale prefix. */
const PATHS: Record<InfoPageKey, string> = {
  about: "/about",
  howItWorks: "/how-it-works",
};

type Block = { heading: string; body: string };
type Step = { title: string; body: string };

/**
 * Badge vocabulary shared with the tool pages (`docs/brand-brief.md` §7). Only
 * the three states that actually exist in the product are listed: a "no
 * tracking" badge would be untrue while ad slots are enabled, so it is not
 * offered here.
 */
const BADGE_STATES = [
  { key: "runsLocally", dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "needsInternet", dot: "bg-sky-500", ring: "border-sky-200 bg-sky-50 text-sky-700" },
  { key: "beta", dot: "bg-slate-400", ring: "border-slate-200 bg-slate-50 text-slate-600" },
] as const;

/**
 * Shared shell for `/about` and `/how-it-works`.
 *
 * Content lives in the dictionaries under `InfoPages.<page>` (`sections` as an
 * ordered array of `{ heading, body }`, plus `steps` on the how-it-works page),
 * so translators edit prose only and every locale keeps the same structure.
 *
 * These two pages exist to give the footer — rendered on all 160 URLs — a small
 * set of indexable, non-legal targets: a site with only tool pages and a privacy
 * policy reads as thin to both crawlers and ad reviewers.
 */
export default async function InfoPageShell({ pageKey }: { pageKey: InfoPageKey }) {
  const [t, pages, badges, locale] = await Promise.all([
    getTranslations(`InfoPages.${pageKey}`),
    getTranslations("InfoPages"),
    getTranslations("Badges"),
    getLocale(),
  ]);

  const title = t("title");
  const sections = t.raw("sections") as Block[];
  const steps = t.has("steps") ? (t.raw("steps") as Step[]) : [];
  const path = PATHS[pageKey];
  const otherKey: InfoPageKey = pageKey === "about" ? "howItWorks" : "about";

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/${locale}` },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}/${locale}${path}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        {/* Visible breadcrumb — mirrors the BreadcrumbList JSON-LD below. */}
        <nav aria-label="Breadcrumb" className="mb-4 text-[11px] text-slate-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="font-semibold hover:text-red-600 transition-colors">
                {SITE_NAME}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li className="font-semibold text-slate-700">{title}</li>
          </ol>
        </nav>

        <article className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-10">
          <header className="pb-5 border-b border-slate-200/60">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          </header>

          <p className="mt-5 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("intro")}</p>

          {steps.length > 0 && (
            <ol className="mt-7 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-red-400">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{step.title}</h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-1.5">
                <h2 className="text-sm font-bold text-slate-900">{section.heading}</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>

          {/* The legend belongs on the page that explains the machinery: a
              visitor who lands here after seeing a badge on a tool page can look
              up what it promises. Only the how-it-works page renders it. */}
          {steps.length > 0 && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h2 className="text-sm font-bold text-slate-900">{badges("legendHeading")}</h2>
              <ul className="mt-3 space-y-3">
                {BADGE_STATES.map((state) => (
                  <li key={state.key} className="flex flex-wrap items-start gap-3">
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.ring}`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
                      {badges(state.key)}
                    </span>
                    <p className="text-xs leading-relaxed text-slate-600">{badges(`${state.key}Meaning`)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8 pt-5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              {pages("contactLabel")}{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-red-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <Link
              href={PATHS[otherKey]}
              className="text-xs font-bold text-slate-600 hover:text-red-600 transition-colors"
            >
              {pages(`${otherKey}.title`)} →
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </div>
  );
}
