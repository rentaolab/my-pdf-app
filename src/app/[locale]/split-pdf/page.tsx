import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Split } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfSplitTool from "@/components/features/PdfSplitTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "split";
const PATH = "/split-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function SplitPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Split}>
      <PdfSplitTool />
    </ToolPageShell>
  );
}
