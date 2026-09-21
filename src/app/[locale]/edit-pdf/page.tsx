import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Edit3 } from "lucide-react";
import ToolPageShell from "@/components/layout/ToolPageShell";
import PdfEditTool from "@/components/features/PdfEditTool";
import { alternatesFor } from "@/lib/seo";

const TOOL_KEY = "edit";
const PATH = "/edit-pdf";

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

export default function EditPdfPage() {
  return (
    <ToolPageShell toolKey={TOOL_KEY} path={PATH} icon={Edit3}>
      <PdfEditTool />
    </ToolPageShell>
  );
}
