import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Minimize2 } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfCompressTool from "@/components/features/PdfCompressTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "compress";
const PATH = "/compress-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function CompressPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Minimize2}>
      <PdfCompressTool />
    </ToolPageShell>
  );
}
