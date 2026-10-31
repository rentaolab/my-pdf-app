import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import InfoPageShell from "@/components/layout/InfoPageShell";
import { pageMetadata } from "@/lib/seo";

const PATH = "/about";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("InfoPages.about"), getLocale()]);

  return pageMetadata({
    title: t("title"),
    description: t("description"),
    path: PATH,
    locale,
  });
}

export default function AboutPage() {
  return <InfoPageShell pageKey="about" />;
}
