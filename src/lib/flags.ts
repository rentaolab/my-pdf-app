/**
 * Build-time feature flags.
 *
 * `NEXT_PUBLIC_*` values are inlined by the bundler, so the developer-only UI
 * below is stripped from production builds unless the variable is explicitly
 * set (e.g. `NEXT_PUBLIC_SHOW_DEV_BAR=1` in `.env.local`).
 */
export const SHOW_DEV_BAR = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === '1';
