import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
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
  const t = await getTranslations("Metadata");

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

