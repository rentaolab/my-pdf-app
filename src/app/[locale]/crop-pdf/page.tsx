import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Crop } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfCropTool from "@/components/features/PdfCropTool";
import { alternatesFor } from "@/lib/seo";

const TOOL_KEY = "crop";
const PATH = "/crop-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: alternatesFor(PATH, locale),
    openGraph: {
      title,
      description,
      url: `/${locale}${PATH}`,
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
  };
}

export default function CropPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Crop}>
      <PdfCropTool />
    </ToolPageShell>
  );
}
