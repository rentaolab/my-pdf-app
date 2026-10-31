import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FileOutput } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfExtractTool from "@/components/features/PdfExtractTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "extractPages";
const PATH = "/extract-pdf-pages";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function ExtractPdfPagesPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={FileOutput}>
      <PdfExtractTool />
    </ToolPageShell>
  );
}
