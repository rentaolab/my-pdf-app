import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Shared site footer: policy + info links and the localized copyright line.
 *
 * The legal links live here (not only on the legal pages themselves) because
 * ad networks require the privacy policy to be reachable from the pages that
 * show ads, and because the home page is one click away from every tool.
 *
 * `/about` and `/how-it-works` are linked from the same row on purpose: every
 * page renders this footer, so they are the only two content pages that get an
 * inbound link from all 160 URLs.
 */
export default async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-slate-200/60 bg-white py-6 text-center text-[11px] text-slate-400 space-y-2">
      <nav className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/about" className="hover:text-red-600 transition-colors">
          {t("InfoPages.about.title")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/how-it-works" className="hover:text-red-600 transition-colors">
          {t("InfoPages.howItWorks.title")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="hover:text-red-600 transition-colors">
          {t("Legal.privacy.title")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="hover:text-red-600 transition-colors">
          {t("Legal.terms.title")}
        </Link>
      </nav>
      <p>
        {t.rich("HomePage.footer", {
          brand: (chunks) => <span className="font-bold text-slate-700">{chunks}</span>,
        })}
      </p>
    </footer>
  );
}
