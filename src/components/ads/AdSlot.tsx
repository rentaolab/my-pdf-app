"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AD_PLACEMENTS,
  ADS_CLIENT,
  ADS_TEST_MODE,
  isPlacementReady,
  pushAd,
  type AdPlacement,
} from "@/lib/ads";
import { ensureAdScriptLoaded } from "@/lib/ads-script";
import { useAds } from "@/components/ads/AdProvider";

type SettledStatus = "filled" | "collapsed";

/**
 * How long to wait for AdSense to report `data-ad-status` before assuming the
 * request will never be answered (ad blocker, CSP, no fill).
 */
const FILL_WATCHDOG_MS = 4000;

/**
 * One ad unit, labelled and height-reserved.
 *
 * Renders `null` — no markup at all, not even an empty container — unless the
 * build has adverts enabled *and* this placement has an ad-unit id. That is the
 * whole of the "ads off" contract in docs/monetization.md §7 Step 2.
 *
 * When it does render:
 * - the "Advertisement" label sits above the unit (policy requirement, §4.1);
 * - the size group's height is reserved so the ad cannot shift the page (CLS);
 * - no fill / blocked requests hide the container, leaving no grey box (§3.4);
 * - a new pathname gets a freshly keyed `<ins>`, so client-side navigation can
 *   never reuse a spent slot ("广告串页", §3.3).
 */
export default function AdSlot({
  placement,
  className = "",
}: {
  placement: AdPlacement;
  /** Extra wrapper classes: spacing and dividers belong to the caller. */
  className?: string;
}) {
  const config = AD_PLACEMENTS[placement];
  const t = useTranslations("Ads");
  const pathname = usePathname();
  const { canServe } = useAds();
  const insRef = useRef<HTMLModElement | null>(null);
  const requestedFor = useRef<string | null>(null);
  const [settled, setSettled] = useState<{ requestKey: string; status: SettledStatus } | null>(null);

  const enabled = canServe && isPlacementReady(placement);
  const requestKey = `${pathname}::${placement}`;

  // A status belongs to the request that produced it, so navigation returns the
  // unit to "pending" without an extra render pass or an effect that writes state.
  const status = settled?.requestKey === requestKey ? settled.status : "pending";

  useEffect(() => {
    if (!enabled) return;
    const ins = insRef.current;
    if (!ins) return;
    if (requestedFor.current === requestKey) return;
    requestedFor.current = requestKey;

    // Feedback from AdSense and from our watchdog arrives in callbacks: the
    // effect itself only touches the external ad runtime.
    const settle = (next: SettledStatus) => setSettled({ requestKey, status: next });

    ensureAdScriptLoaded();

    if (!pushAd()) {
      window.setTimeout(() => settle("collapsed"), 0);
      return;
    }

    const watchdog = window.setTimeout(() => {
      if (!ins.getAttribute("data-ad-status")) settle("collapsed");
    }, FILL_WATCHDOG_MS);

    const observer = new MutationObserver(() => {
      const next = ins.getAttribute("data-ad-status");
      if (next === "filled") {
        settle("filled");
        window.clearTimeout(watchdog);
      } else if (next === "unfilled") {
        settle("collapsed");
        window.clearTimeout(watchdog);
      }
    });
    observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });

    return () => {
      window.clearTimeout(watchdog);
      observer.disconnect();
    };
  }, [enabled, requestKey, placement]);

  if (!enabled) return null;

  return (
    <aside
      aria-label={t("label")}
      className={`w-full ${status === "collapsed" ? "hidden" : ""} ${className}`.trim()}
    >
      <p className="mb-1 text-center text-[10px] font-mono uppercase tracking-wider text-slate-400">
        {t("label")}
      </p>
      <div className={`flex items-start justify-center overflow-hidden ${config.minHeightClass}`}>
        <ins
          key={pathname}
          ref={insRef}
          className="adsbygoogle block w-full"
          // Mirrors the snippet AdSense generates: `display:block` must not
          // depend on our stylesheet, in-article units are centre-aligned.
          style={{
            display: "block",
            textAlign: config.layout === "in-article" ? "center" : undefined,
          }}
          data-ad-client={ADS_CLIENT}
          data-ad-slot={config.slot}
          data-ad-format={config.format}
          data-ad-layout={config.layout}
          data-full-width-responsive="true"
          data-adtest={ADS_TEST_MODE ? "on" : undefined}
        />
      </div>
    </aside>
  );
}
