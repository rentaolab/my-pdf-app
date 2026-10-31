import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Merge } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfMergeTool from "@/components/features/PdfMergeTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "merge";
const PATH = "/merge-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function MergePdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Merge}>
      <PdfMergeTool />
    </ToolPageShell>
  );
}
