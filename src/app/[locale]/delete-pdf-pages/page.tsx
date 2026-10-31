import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfDeleteTool from "@/components/features/PdfDeleteTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "deletePages";
const PATH = "/delete-pdf-pages";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function DeletePdfPagesPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Trash2}>
      <PdfDeleteTool />
    </ToolPageShell>
  );
}
