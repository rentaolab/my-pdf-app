import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import LegalPageShell from "@/components/layout/LegalPageShell";
import { pageMetadata } from "@/lib/seo";

const PATH = "/terms";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Legal.terms"), getLocale()]);

  return pageMetadata({
    title: t("title"),
    description: t("description"),
    path: PATH,
    locale,
  });
}

export default function TermsPage() {
  return <LegalPageShell docKey="terms" />;
}
