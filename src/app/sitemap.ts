import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { PAGE_PATHS, SITE_URL } from "@/lib/seo";

/**
 * 10 locales × 12 pages = 120 URLs, each with its own hreflang alternates block
 * (including x-default) so the locale variants are not treated as duplicates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const languagesFor = (path: string) => ({
    ...Object.fromEntries(routing.locales.map((code) => [code, `${SITE_URL}/${code}${path}`])),
    "x-default": `${SITE_URL}/${routing.defaultLocale}${path}`,
  });

  return routing.locales.flatMap((locale) =>
    PAGE_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: languagesFor(path) },
    })),
  );
}
