import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Crop } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfCropTool from "@/components/features/PdfCropTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "crop";
const PATH = "/crop-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function CropPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Crop}>
      <PdfCropTool />
    </ToolPageShell>
  );
}
