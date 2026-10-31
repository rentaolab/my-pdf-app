import { useTranslations } from "next-intl";

/**
 * "Runs locally" badge for the tool pages (`docs/brand-brief.md` §7).
 *
 * It states the one thing a visitor cannot verify by looking at the screen and
 * cares about most: the file is not uploaded. Green is the brief's colour for
 * local processing, and the label comes from the `Badges` namespace so it stays
 * translated in all ten locales.
 *
 * All twelve tools currently process in the browser, so this is rendered
 * unconditionally. The moment a tool gains a server-side step it must stop using
 * this component and render the "needs internet" state (`how-it-works` explains
 * both), because a wrong badge is worse than no badge.
 */
export default function ToolBadge() {
  const t = useTranslations("Badges");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {t("runsLocally")}
    </span>
  );
}
