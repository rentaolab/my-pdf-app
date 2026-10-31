import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Images } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import ImageToPdfTool from "@/components/features/ImageToPdfTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "imageToPdf";
const PATH = "/image-to-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function ImageToPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Images}>
      <ImageToPdfTool />
    </ToolPageShell>
  );
}
