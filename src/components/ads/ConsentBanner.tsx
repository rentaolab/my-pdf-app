"use client";

import { useTranslations } from "next-intl";
import { ADS_CMP } from "@/lib/ads";
import { useAds } from "@/components/ads/AdProvider";

/**
 * Fallback consent gate for builds that have no Google-certified CMP yet.
 *
 * The production default is `ADS_CMP=google`, where Google's Privacy &
 * messaging (Funding Choices) handles consent and this component renders
 * nothing at all. With `ADS_CMP=builtin` the banner appears until the visitor
 * answers, and `AdProvider` keeps the AdSense script unloaded until then — so
 * refusing costs the visitor nothing but the ads (§3.2, §4.3).
 *
 * It is not a TCF-certified CMP: EEA / UK traffic must use `google` mode.
 */
export default function ConsentBanner() {
  const t = useTranslations("Ads");
  const { enabled, consent, setConsent } = useAds();

  if (!enabled || ADS_CMP !== "builtin" || consent !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("consent.title")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-slate-600">{t("consent.text")}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {t("consent.reject")}
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-slate-800"
          >
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
