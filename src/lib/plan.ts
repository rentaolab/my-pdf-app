/**
 * Single source of truth for plan entitlements.
 *
 * Phase 0 keeps the active plan in local component state (there is no license
 * or account yet). When the signed-license flow lands, only the entitlement
 * *source* changes: every quota is already read from this file, so the tools
 * themselves do not need to be touched again.
 */
export type Plan = 'free' | 'pro';

export type PlanLimits = {
  /** Maximum number of PDF files the merge tool accepts in a single run. */
  mergeMaxFiles: number;
  /** Maximum number of break points the split tool accepts. */
  splitMaxBreaks: number;
  /** Highest export resolution offered by the PDF-to-image tool. */
  pdfToImageMaxDpi: number;
  /** Whether the tool may export a ZIP of single pages. */
  zipExport: boolean;
};

/**
 * `Infinity` marks an unlimited quota. Render it through `isUnlimited()` so the
 * UI can print a localized "unlimited" label instead of the raw value.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    mergeMaxFiles: 2,
    splitMaxBreaks: 1,
    pdfToImageMaxDpi: 150,
    zipExport: false,
  },
  pro: {
    mergeMaxFiles: Infinity,
    splitMaxBreaks: Infinity,
    pdfToImageMaxDpi: 300,
    zipExport: true,
  },
};

/** Plan assumed until a real entitlement source is wired up. */
export const DEFAULT_PLAN: Plan = 'free';

/** True when a quota is unlimited, so callers can swap in a localized label. */
export function isUnlimited(value: number): boolean {
  return value === Infinity;
}
