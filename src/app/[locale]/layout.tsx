import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternatesFor, hreflangFor, ogLocaleFor, SITE_NAME, SITE_URL } from "@/lib/seo";
import AdProvider from "@/components/ads/AdProvider";
import ConsentBanner from "@/components/ads/ConsentBanner";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * The mono face is only used inside the tool workspaces (10 px page badges, zoom
 * readouts) and on the legal pages, never on a first screen. Preloading it would
 * put a second font on the critical path of all 140 pages for text most visitors
 * never see; without `preload` it is fetched the first time a `font-mono` rule
 * actually matches.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

/**
 * Namespaces that client components read through `useTranslations`.
 *
 * The dictionary is ~37 KB per locale and `NextIntlClientProvider` serialises
 * every namespace it is given into the RSC payload of every page. About 17 KB of
 * it (ToolPages headings, ToolContent, Faq, Legal, HomePage, Metadata) is only
 * ever rendered on the server, so the browser used to download and parse JSON it
 * could not ask for. Forwarding the client-reachable subset only keeps the
 * payload honest.
 *
 * `scripts/check-messages.mjs` cross-checks this list against the `useTranslations`
 * calls in every `"use client"` file and fails when one is missing, so a new
 * client component cannot start throwing MISSING_MESSAGE in the browser.
 */
const CLIENT_NAMESPACES = [
  "Ads",
  "Common",
  "LanguageSwitcher",
  "Navbar",
  "Tools",
  // One workspace dictionary per tool page; only the matching page renders it.
  "ImageToPdf",
  "PdfCrop",
  "PdfCrossMerge",
  "PdfDelete",
  "PdfEdit",
  "PdfExtract",
  "PdfMerge",
  "PdfOrganize",
  "PdfPageEditor",
  "PdfRotate",
  "PdfSplit",
  "PdfToImage",
] as const;

/** Keep only the namespaces client components actually resolve. */
function clientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const namespace of CLIENT_NAMESPACES) {
    const value = messages[namespace];
    if (value !== undefined) picked[namespace] = value;
  }
  return picked;
}

// Pre-render all supported locales at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Canonical origin of this sub-brand lives in `src/lib/seo.ts`; it is imported
 * above so metadataBase, canonical URLs and structured data cannot drift apart.
 */

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Metadata"), getLocale()]);

  return {
    metadataBase: new URL(SITE_URL),
    // Tool pages only set their own title, so the template adds the brand for them
    // while the home page keeps its full localized title.
    title: { default: t("title"), template: `%s · ${SITE_NAME}` },
    description: t("description"),
    alternates: alternatesFor("", locale),
    // Search Console / Bing Webmaster verification. Next omits the tag entirely
    // when the env var is unset, so local builds stay clean.
    verification: {
      google: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
      other: process.env.NEXT_PUBLIC_BING_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION }
        : undefined,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: t("title"),
      description: t("description"),
      url: `/${locale}`,
      locale: ogLocaleFor(locale),
      // Explicit on purpose: setting openGraph here would otherwise drop the image
      // that the file convention (src/app/opengraph-image.png) attaches.
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  // `getMessages()` returns the dictionary this locale was resolved against;
  // only the client-reachable namespaces are forwarded (see CLIENT_NAMESPACES).
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  // Site-level structured data: the brand entity plus the toolkit itself.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Reeff.PDF", url: SITE_URL, inLanguage: locale },
      {
        "@type": "SoftwareApplication",
        name: "Reeff.PDF",
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any modern web browser",
        url: SITE_URL,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };

  return (
    <html
      lang={hreflangFor(locale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={clientMessages(messages)}>
          {/* Advertising is off unless NEXT_PUBLIC_ADS_ENABLED=true, in which
              case AdProvider loads the AdSense runtime and ConsentBanner (only
              in `builtin` CMP mode) can appear. Both are inert otherwise. */}
          <AdProvider>
            {children}
            <ConsentBanner />
          </AdProvider>
        </NextIntlClientProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}

