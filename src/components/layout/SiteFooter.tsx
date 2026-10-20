import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Shared site footer: legal links + the localized copyright line.
 *
 * The legal links live here (not only on the legal pages themselves) because
 * ad networks require the privacy policy to be reachable from the pages that
 * show ads, and because the home page is one click away from every tool.
 */
export default async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-slate-200/60 bg-white py-6 text-center text-[11px] text-slate-400 space-y-2">
      <nav className="flex items-center justify-center gap-2">
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
