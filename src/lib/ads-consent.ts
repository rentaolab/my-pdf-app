import { CONSENT_STORAGE_KEY, type AdConsent } from "@/lib/ads";

/**
 * Tiny external store for the visitor's ad-consent choice (`builtin` CMP mode).
 *
 * `useSyncExternalStore` is used instead of an effect + `setState` because the
 * value comes from localStorage: an effect would render twice, and reading
 * localStorage during render would desync prerendered HTML from the first
 * client render. Snapshots are cached so React gets a stable value per change.
 */

let snapshot: AdConsent | undefined;
const listeners = new Set<() => void>();

function readStorage(): AdConsent {
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unknown";
  } catch {
    // Storage disabled (private mode) → ask again rather than assume consent.
    return "unknown";
  }
}

export function getConsentSnapshot(): AdConsent {
  if (snapshot === undefined) snapshot = readStorage();
  return snapshot;
}

/** Server / hydration snapshot: no choice has been made yet. */
export function getConsentServerSnapshot(): AdConsent {
  return "unknown";
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab changed the choice → drop the cache and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
    snapshot = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persist the choice and notify the provider (best-effort persistence). */
export function writeConsent(next: Exclude<AdConsent, "unknown">): void {
  snapshot = next;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, next);
  } catch {
    // Private mode or quota: the current session still honours the choice.
  }
  listeners.forEach((listener) => listener());
}
