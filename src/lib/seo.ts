import { routing } from "@/i18n/routing";

/**
 * Canonical origin of the PDF sub-brand. Referenced by every page's metadata so
 * canonical / hreflang / OG URLs stay absolute and consistent.
 */
export const SITE_URL = "https://pdf.reeff.app";

/**
 * Every tool page as a locale-free path. Single source of truth for the sitemap,
 * the "related tools" internal-link block and per-page metadata.
 * `key` matches both `Tools.<key>` and `ToolPages.<key>` in the dictionaries.
 */
export const TOOLS = [
  { key: "organize", path: "/organize-pdf" },
  { key: "merge", path: "/merge-pdf" },
  { key: "split", path: "/split-pdf" },
  { key: "rotate", path: "/rotate-pdf" },
  { key: "reorderPages", path: "/reorder-pdf-pages" },
  { key: "deletePages", path: "/delete-pdf-pages" },
  { key: "extractPages", path: "/extract-pdf-pages" },
  { key: "crop", path: "/crop-pdf" },
  { key: "edit", path: "/edit-pdf" },
  { key: "pdfToImage", path: "/pdf-to-image" },
  { key: "imageToPdf", path: "/image-to-pdf" },
] as const;

/** Home + all tool pages. */
export const PAGE_PATHS: string[] = ["", ...TOOLS.map((tool) => tool.path)];

/**
 * Legal pages. They are localized like everything else (so hreflang and the
 * language switcher keep working) and sitemapped with a low priority; AdSense
 * and most ad networks require both to exist and be reachable.
 */
export const LEGAL_PATHS = ["/privacy", "/terms"] as const;

/** Everything that belongs in `sitemap.xml`. */
export const SITEMAP_PATHS: string[] = [...PAGE_PATHS, ...LEGAL_PATHS];

/**
 * Contact address shown on the legal pages and required by ad networks.
 * Single constant on purpose: change it here and every locale follows.
 */
export const CONTACT_EMAIL = "support@reeff.app";

/**
 * Canonical + hreflang for one page.
 *
 * Every locale gets its own URL (`localePrefix: 'always'`), so each page is
 * self-canonical and cross-linked to its 10 siblings plus `x-default`.
 */
export function alternatesFor(path: string, locale: string) {
  const languages: Record<string, string> = {};
  for (const code of routing.locales) languages[code] = `/${code}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;

  return { canonical: `/${locale}${path}`, languages };
}
