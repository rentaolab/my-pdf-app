import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { alternatesFor } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pre-render all supported locales at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Canonical origin of this sub-brand. Required so Open Graph / Twitter image
 * URLs resolve to absolute paths (e.g. https://pdf.reeff.app/opengraph-image.png).
 * Future verticals (image./audio./receipt.reeff.app) only change this constant.
 */
const SITE_URL = "https://pdf.reeff.app";

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Metadata"), getLocale()]);

  return {
    metadataBase: new URL(SITE_URL),
    // Tool pages only set their own title, so the template adds the brand for them
    // while the home page keeps its full localized title.
    title: { default: t("title"), template: "%s · Reeff.PDF" },
    description: t("description"),
    alternates: alternatesFor("", locale),
    openGraph: {
      type: "website",
      siteName: "Reeff.PDF",
      title: t("title"),
      description: t("description"),
      url: `/${locale}`,
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
  const locale = await getLocale();

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
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}

