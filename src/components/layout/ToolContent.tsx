import { useTranslations } from "next-intl";

/**
 * Per-tool content block: a unique intro paragraph, a three-step "how it works"
 * list, three concrete use cases, a "when to use it" paragraph that states the
 * tool's limits, and the local-processing promise.
 *
 * This is what turns the tool pages from thin pages (h1 + one line) into pages
 * with unique, indexable prose — the tool copy carries roughly 220 words per
 * page per locale, and the shared FAQ block adds another ~60 on top of that.
 * The extra Q&A pairs in `Faq.toolExtra` are rendered by `ToolPageShell` and
 * feed the FAQPage JSON-LD from the same array.
 */
export default function ToolContent({ toolKey }: { toolKey: string }) {
  const t = useTranslations("ToolContent");
  const steps = [t("stepPick"), t(`stepAction.${toolKey}`), t("stepDownload")];
  const useCases = t.raw(`useCases.${toolKey}`) as string[];

  return (
    <section className="space-y-4 border-t border-slate-200/60 pt-6">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{t(`intro.${toolKey}`)}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">{t("howItWorks")}</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-red-400">
                  {index + 1}
                </span>
                <p className="text-xs leading-relaxed text-slate-600">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">{t("useCases.heading")}</h2>
          <ul className="mt-4 space-y-3">
            {useCases.map((useCase) => (
              <li key={useCase} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <p className="text-xs leading-relaxed text-slate-600">{useCase}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">{t("detailHeading")}</h2>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-600">{t(`detail.${toolKey}`)}</p>
      </div>

      <p className="max-w-3xl border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">{t("privacy")}</p>
    </section>
  );
}
