import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FileImage } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfToImageTool from "@/components/features/PdfToImageTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "pdfToImage";
const PATH = "/pdf-to-image";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function PdfToImagePage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={FileImage}>
      <PdfToImageTool />
    </ToolPageShell>
  );
}
