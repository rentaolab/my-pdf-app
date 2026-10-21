/**
 * Single source of truth for advertising.
 *
 * Nothing here renders anything by itself: `ADS_ENABLED` defaults to `false`,
 * so a build without advertising environment variables ships zero ad markup,
 * zero Google requests and zero consent UI (docs/monetization.md §7 Step 2).
 * Ads light up per placement only when the flag *and* that placement's ad-unit
 * id are present.
 *
 * Env vars (all optional, inlined by `next build`):
 *
 * | Variable                  | Example                   | Meaning                                                        |
 * |---------------------------|---------------------------|----------------------------------------------------------------|
 * | `NEXT_PUBLIC_ADS_ENABLED` | `true`                    | Master switch; anything else = ads off                          |
 * | `NEXT_PUBLIC_ADS_CLIENT`  | `ca-pub-4891040014815847` | AdSense client; defaults to the id already in `public/ads.txt`   |
 * | `NEXT_PUBLIC_ADS_SLOT_P1` | `1234567890`              | Top banner ad unit                                             |
 * | `NEXT_PUBLIC_ADS_SLOT_P2` | `1234567891`              | Below-tool ad unit                                             |
 * | `NEXT_PUBLIC_ADS_SLOT_P3` | `1234567892`              | In-article ad unit (home page)                                 |
 * | `NEXT_PUBLIC_ADS_CMP`     | `google` \| `builtin`     | Who collects consent (default `google` = Funding Choices)       |
 * | `NEXT_PUBLIC_ADS_TEST`    | `true`                    | Adds `data-adtest="on"` so Google serves test ads               |
 *
 * Because they are `NEXT_PUBLIC_*`, they are inlined into the client bundle:
 * changing them requires a rebuild (on Cloudflare Pages: add them under
 * Settings → Environment variables, then redeploy).
 */

/** Publisher id that must also appear in `public/ads.txt`. */
export const ADS_PUBLISHER_ID = "pub-4891040014815847";

/** `ca-pub-…` client id; overridable, but it must match `ads.txt`. */
export const ADS_CLIENT = process.env.NEXT_PUBLIC_ADS_CLIENT || `ca-${ADS_PUBLISHER_ID}`;

/** Master switch. `false` (default) ⇒ no ad DOM, no ad script, no requests. */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

/** Ask Google for test ads (`data-adtest="on"`) instead of paid inventory. */
export const ADS_TEST_MODE = process.env.NEXT_PUBLIC_ADS_TEST === "true";

/**
 * Consent handling:
 * - `google`  — Google's certified CMP (AdSense → Privacy & messaging) gates the
 *               requests; we only render slots. Production default.
 * - `builtin` — we render `ConsentBanner` and keep the ad script unloaded until
 *               the visitor accepts. Useful before Funding Choices is set up and
 *               for manual checks; it is not a TCF-certified CMP, so EEA traffic
 *               must stay on `google`.
 */
export const ADS_CMP = process.env.NEXT_PUBLIC_ADS_CMP === "builtin" ? "builtin" : "google";

/** Where the consent choice is persisted in `builtin` mode. */
export const CONSENT_STORAGE_KEY = "reeff.ads.consent.v1";

export type AdConsent = "granted" | "denied" | "unknown";

/**
 * Placements from docs/monetization.md §2.
 *
 * `minHeightClass` reserves the space of the size group so a late ad cannot
 * shift the layout (CLS target < 0.1). The reserved space only exists on pages
 * where ads are actually enabled — with `ADS_ENABLED=false` the component
 * renders nothing at all.
 *
 * P4 (mobile anchor) is intentionally not implemented yet: §9 keeps it open
 * until the P1-vs-P4 A/B is decided, and AdSense "Auto ads" would inject
 * placements we cannot keep away from the export buttons.
 */
export const AD_PLACEMENTS = {
  /** P1 · 970×90 / 728×90 desktop, 320×100 mobile — above the tool workspace. */
  p1: {
    slot: process.env.NEXT_PUBLIC_ADS_SLOT_P1 ?? "",
    format: "horizontal",
    minHeightClass: "min-h-[100px] md:min-h-[90px]",
    layout: undefined as "in-article" | undefined,
  },
  /** P2 · 336×280 / 300×250 — between the tool card and the article prose. */
  p2: {
    slot: process.env.NEXT_PUBLIC_ADS_SLOT_P2 ?? "",
    format: "rectangle",
    minHeightClass: "min-h-[250px]",
    layout: undefined as "in-article" | undefined,
  },
  /** P3 · fluid in-article — one per content page, never on tool pages. */
  p3: {
    slot: process.env.NEXT_PUBLIC_ADS_SLOT_P3 ?? "",
    format: "fluid",
    minHeightClass: "min-h-[200px]",
    layout: "in-article" as "in-article" | undefined,
  },
} as const;

export type AdPlacement = keyof typeof AD_PLACEMENTS;

export type AdPlacementConfig = (typeof AD_PLACEMENTS)[AdPlacement];

/** Script URL — only ever injected when `isAdsConfigured()` is true. */
export const AD_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;

/**
 * True when ads can be served at all: switch on and client id present.
 * Independent of per-placement ids so the provider can load the script once.
 */
export function isAdsConfigured(): boolean {
  return ADS_ENABLED && ADS_CLIENT.length > 0;
}

/**
 * True when this placement has an ad unit id. Placements without an id stay
 * unmounted — that is how the integration ships before the ad units exist in
 * the AdSense dashboard.
 */
export function isPlacementReady(placement: AdPlacement): boolean {
  return isAdsConfigured() && AD_PLACEMENTS[placement].slot.length > 0;
}

declare global {
  interface Window {
    /** Queue that the AdSense script drains, or the loaded runtime itself. */
    adsbygoogle?: Array<Record<string, unknown>> & { loaded?: boolean };
  }
}

/**
 * Enqueue one ad request for the `<ins>` element that is already in the DOM.
 *
 * Must be called after the element is mounted (AdSense reads it synchronously).
 * Safe to call before the script has loaded: the array is the documented queue.
 * Returns `false` when the call threw (ad blocker, CSP, double push) so the
 * caller can collapse the container instead of leaving a blank box.
 */
export function pushAd(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const queue = (window.adsbygoogle = window.adsbygoogle || []);
    queue.push({});
    return true;
  } catch {
    return false;
  }
}
