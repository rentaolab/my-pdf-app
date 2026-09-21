import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FileImage } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfToImageTool from "@/components/features/PdfToImageTool";
import { alternatesFor } from "@/lib/seo";

const TOOL_KEY = "pdfToImage";
const PATH = "/pdf-to-image";

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

export default function PdfToImagePage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={FileImage}>
      <PdfToImageTool />
    </ToolPageShell>
  );
}
