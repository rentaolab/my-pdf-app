import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Layers } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfOrganizeTool from "@/components/features/PdfOrganizeTool";
import { pageMetadata } from "@/lib/seo";

const TOOL_KEY = "organize";
const PATH = "/organize-pdf";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ToolPages." + TOOL_KEY), getLocale()]);

  return pageMetadata({
    title: t("seoTitle"),
    description: t("seoDescription"),
    path: PATH,
    locale,
  });
}

export default function OrganizePdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Layers}>
      <PdfOrganizeTool />
    </ToolPageShell>
  );
}
