import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { RotateCw } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfRotateTool from "@/components/features/PdfRotateTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "rotate";
const PATH = "/rotate-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function RotatePdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={RotateCw}>
      <PdfRotateTool />
    </ToolPageShell>
  );
}
