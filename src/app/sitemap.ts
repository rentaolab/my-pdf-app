import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { INFO_PATHS, LEGAL_PATHS, SITE_URL, SITEMAP_PATHS, hreflangFor } from "@/lib/seo";

// Required by `output: "export"` — metadata routes are emitted as static files
// at build time instead of being served by a Node runtime.
export const dynamic = "force-static";

/**
 * 10 locales × 17 pages = 170 URLs (home + 12 tools + about + how-it-works +
 * privacy + terms), each with its own hreflang alternates block (including
 * x-default) so the locale variants are not treated as duplicates.
 *
 * Bump `LAST_MODIFIED` by hand when page copy actually changes. `new Date()`
 * here would restamp every URL on each deploy, which teaches Google that
 * `lastmod` carries no information and makes it ignore the field entirely.
 */
const LAST_MODIFIED = new Date("2026-10-31T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const languagesFor = (path: string) => ({
    ...Object.fromEntries(routing.locales.map((code) => [hreflangFor(code), `${SITE_URL}/${code}${path}`])),
    "x-default": `${SITE_URL}/${routing.defaultLocale}${path}`,
  });

  // Home is the entry point, tools are what people search for, the two info
  // pages sit below them, and the legal pages are only there for compliance.
  const inList = (list: readonly string[]) => (path: string) => list.includes(path);
  const isInfo = inList(INFO_PATHS);
  const isLegal = inList(LEGAL_PATHS);

  return routing.locales.flatMap((locale) =>
    SITEMAP_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: path === "" ? ("weekly" as const) : isLegal(path) ? ("yearly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : isLegal(path) ? 0.3 : isInfo(path) ? 0.6 : 0.8,
      alternates: { languages: languagesFor(path) },
    })),
  );
}
