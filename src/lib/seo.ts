import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Canonical origin of the PDF sub-brand. Referenced by every page's metadata so
 * canonical / hreflang / OG URLs stay absolute and consistent.
 */
export const SITE_URL = "https://pdf.reeff.app";

/** Brand name, used by the title template, Open Graph and structured data. */
export const SITE_NAME = "Reeff.PDF";

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
 * Standalone content pages (`/about`, `/how-it-works`). They are self-canonical
 * and localized like everything else, and they give the footer — which every
 * page renders — a second internal link target besides the legal pages.
 */
export const INFO_PATHS = ["/about", "/how-it-works"] as const;

/**
 * Legal pages. They are localized like everything else (so hreflang and the
 * language switcher keep working) and sitemapped with a low priority; AdSense
 * and most ad networks require both to exist and be reachable.
 */
export const LEGAL_PATHS = ["/privacy", "/terms"] as const;

/** Everything that belongs in `sitemap.xml`. */
export const SITEMAP_PATHS: string[] = [...PAGE_PATHS, ...INFO_PATHS, ...LEGAL_PATHS];

/**
 * Contact address shown on the legal pages and required by ad networks.
 * Single constant on purpose: change it here and every locale follows.
 */
export const CONTACT_EMAIL = "reeff.app@proton.me";

/**
 * `hreflang` / `<html lang>` value per locale.
 *
 * The URL prefix stays the short code (`/zh/merge-pdf`) — only the annotation is
 * more precise. Search engines match `zh-Hans` against Simplified Chinese
 * queries better than a bare `zh`, which covers both scripts.
 */
export const HREFLANG: Record<string, string> = {
  en: "en",
  zh: "zh-Hans",
  ja: "ja",
  ko: "ko",
  hi: "hi",
  ms: "ms",
  es: "es",
  pt: "pt",
  de: "de",
  fr: "fr",
};

/** Locale code → `hreflang`/`lang` annotation (falls back to the code itself). */
export function hreflangFor(locale: string): string {
  return HREFLANG[locale] ?? locale;
}

/**
 * Locale code → Open Graph `og:locale` value (`language_TERRITORY`).
 * Some scrapers silently ignore the bare hreflang form.
 */
export const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
  hi: "hi_IN",
  ms: "ms_MY",
  es: "es_ES",
  pt: "pt_BR",
  de: "de_DE",
  fr: "fr_FR",
};

/** Locale code → `og:locale` (falls back to the value used by `hreflang`). */
export function ogLocaleFor(locale: string): string {
  return OG_LOCALE[locale] ?? hreflangFor(locale);
}

/**
 * Canonical + hreflang for one page.
 *
 * Every locale gets its own URL (`localePrefix: 'always'`), so each page is
 * self-canonical and cross-linked to its 10 siblings plus `x-default`.
 */
export function alternatesFor(path: string, locale: string) {
  const languages: Record<string, string> = {};
  for (const code of routing.locales) languages[hreflangFor(code)] = `/${code}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;

  return { canonical: `/${locale}${path}`, languages };
}

const OG_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630 } as const;

/**
 * Metadata for every localized sub-page (tools + legal).
 *
 * A page-level `openGraph` object **replaces** the layout's one instead of
 * merging with it, so `type`, `siteName` and `locale` have to be repeated here
 * or they disappear from the rendered `<head>`. Keeping that in one helper means
 * the 13 pages cannot drift apart again.
 */
export function pageMetadata({
  title,
  description,
  path,
  locale,
  type = "article",
}: {
  title: string;
  description: string;
  path: string;
  locale: string;
  type?: "article" | "website";
}): Metadata {
  return {
    title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: `/${locale}${path}`,
      locale: ogLocaleFor(locale),
      images: [OG_IMAGE],
    },
  };
}

/**
 * `BreadcrumbList` for a tool page.
 *
 * The item URL must carry the locale prefix — it has to match the page's
 * canonical exactly, otherwise the declaration points at a redirect and search
 * engines discard it.
 */
export function breadcrumbFor({ path, locale, title }: { path: string; locale: string; title: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: `${SITE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: `${SITE_URL}/${locale}${path}`,
      },
    ],
  };
}

/**
 * `FAQPage` for a tool page or the home page.
 *
 * Note: Google limited FAQ rich results to authoritative government/health
 * sites in August 2023, so this does **not** buy a SERP feature. It is kept for
 * semantic completeness and for Bing / AI-search crawlers that read Q&A pairs.
 */
export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
