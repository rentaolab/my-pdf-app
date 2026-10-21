"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { ADS_CMP, isAdsConfigured, type AdConsent } from "@/lib/ads";
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  subscribeConsent,
  writeConsent,
} from "@/lib/ads-consent";

type AdsContextValue = {
  /** Ads switched on for this build (master flag + client id present). */
  enabled: boolean;
  /** Ad requests allowed right now — i.e. `enabled` and consent settled. */
  canServe: boolean;
  consent: AdConsent;
  setConsent: (next: Exclude<AdConsent, "unknown">) => void;
};

/**
 * Defaults describe a build with advertising off, so any component rendered
 * outside the provider (tests, storybook, a future embed) stays inert instead
 * of throwing.
 */
const AdsContext = createContext<AdsContextValue>({
  enabled: false,
  canServe: false,
  consent: "unknown",
  setConsent: () => {},
});

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}

/**
 * Holds the advertising state for the whole app.
 *
 * - `enabled` is what the future membership flag flips: with `adFree` it becomes
 *   `false` and every `AdSlot` unmounts without touching the slot components
 *   (docs/monetization.md §3.2).
 * - It carries no ad markup itself: the AdSense runtime is injected by the first
 *   `AdSlot` that actually renders (see `lib/ads-script.ts`), so a build with
 *   advertising off — or a page without ad units — never contacts Google.
 */
export default function AdProvider({ children }: { children: React.ReactNode }) {
  const enabled = isAdsConfigured();
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );

  // In `google` mode Google's certified CMP gates the requests itself; in
  // `builtin` mode nothing is loaded until the visitor accepts.
  const canServe = enabled && (ADS_CMP === "google" || consent === "granted");

  const value = useMemo(
    () => ({ enabled, canServe, consent, setConsent: writeConsent }),
    [enabled, canServe, consent],
  );

  return (
    <AdsContext.Provider value={value}>
      {children}
    </AdsContext.Provider>
  );
}
