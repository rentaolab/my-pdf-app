import { AD_SCRIPT_SRC } from "@/lib/ads";

/**
 * Loads the AdSense runtime on demand.
 *
 * Called by `AdSlot` right before the first ad request, so pages without an ad
 * unit (`/privacy`, `/terms`, the 404 page) never contact Google at all — and a
 * page with two units still injects the script once. Idempotent by element id,
 * which also survives React strict-mode double effects.
 *
 * Loading is client-only by construction (effects never run during SSR), so the
 * static export is unaffected.
 */
const SCRIPT_ID = "reeff-ads";

export function ensureAdScriptLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = AD_SCRIPT_SRC;
  script.crossOrigin = "anonymous";
  // A blocked script (ad blocker, CSP) simply never fires onload; the slot's
  // watchdog hides the container instead of leaving a blank box.
  document.head.appendChild(script);
}
