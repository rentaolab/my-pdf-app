import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import LegalPageShell from "@/components/layout/LegalPageShell";
import { alternatesFor } from "@/lib/seo";

const PATH = "/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Legal.privacy"), getLocale()]);
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: alternatesFor(PATH, locale),
    // Re-declared because a page-level `openGraph` replaces the layout's object,
    // and with `output: "export"` there is no server to infer the image from.
    openGraph: {
      type: "article",
      siteName: "Reeff.PDF",
      title,
      description,
      url: `/${locale}${PATH}`,
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
  };
}

export default function PrivacyPage() {
  return <LegalPageShell docKey="privacy" />;
}
