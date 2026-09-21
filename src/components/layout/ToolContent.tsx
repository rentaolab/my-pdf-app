import { useTranslations } from "next-intl";

/**
 * Per-tool content block: a unique intro paragraph, a three-step "how it works"
 * list and the local-processing promise.
 *
 * This is what turns the tool pages from thin pages (h1 + one line) into pages
 * with unique, indexable prose — approximately 60–90 words per page per locale,
 * with only 22 tool-specific strings to maintain.
 */
export default function ToolContent({ toolKey }: { toolKey: string }) {
  const t = useTranslations("ToolContent");
  const steps = [t("stepPick"), t(`stepAction.${toolKey}`), t("stepDownload")];

  return (
    <section className="space-y-4 border-t border-slate-200/60 pt-6">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{t(`intro.${toolKey}`)}</p>

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
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">{t("privacy")}</p>
      </div>
    </section>
  );
}
