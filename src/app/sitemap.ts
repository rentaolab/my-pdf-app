import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { LEGAL_PATHS, SITE_URL, SITEMAP_PATHS } from "@/lib/seo";

// Required by `output: "export"` — metadata routes are emitted as static files
// at build time instead of being served by a Node runtime.
export const dynamic = "force-static";

/**
 * 10 locales × 14 pages = 140 URLs (12 tools/home + privacy + terms), each with
 * its own hreflang alternates block (including x-default) so the locale
 * variants are not treated as duplicates.
 *
 * Bump `LAST_MODIFIED` by hand when page copy actually changes. `new Date()`
 * here would restamp all 140 URLs on every deploy, which teaches Google that
 * `lastmod` carries no information and makes it ignore the field entirely.
 */
const LAST_MODIFIED = new Date("2026-10-30T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const languagesFor = (path: string) => ({
    ...Object.fromEntries(routing.locales.map((code) => [code, `${SITE_URL}/${code}${path}`])),
    "x-default": `${SITE_URL}/${routing.defaultLocale}${path}`,
  });

  const isLegal = (path: string) => (LEGAL_PATHS as readonly string[]).includes(path);

  return routing.locales.flatMap((locale) =>
    SITEMAP_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: path === "" ? ("weekly" as const) : isLegal(path) ? ("yearly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : isLegal(path) ? 0.3 : 0.8,
      alternates: { languages: languagesFor(path) },
    })),
  );
}
