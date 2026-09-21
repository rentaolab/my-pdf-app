import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TOOLS } from "@/lib/seo";

/**
 * Internal-link block: every tool page links to the other ten.
 *
 * 11 pages × 10 links = 110 contextual internal links, which is the cheapest
 * crawl-depth win available — the pages already exist, they just were not
 * pointing at each other.
 */
export default function RelatedTools({ currentPath }: { currentPath: string }) {
  const t = useTranslations("Tools");
  const tCommon = useTranslations("Common");
  const others = TOOLS.filter((tool) => tool.path !== currentPath);

  return (
    <section aria-labelledby="related-tools" className="border-t border-slate-200/60 pt-6">
      <h2 id="related-tools" className="text-sm font-bold text-slate-700">
        {tCommon("relatedTools")}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {others.map((tool) => (
          <li key={tool.path}>
            <Link
              href={tool.path}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-500/40 hover:text-red-600"
            >
              {t(`${tool.key}.name`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
