import { defineRouting } from 'next-intl/routing';

/**
 * All locales supported by the app (first-class citizens).
 * Keep this list in sync with the JSON dictionaries in `src/messages`.
 */
export const locales = [
  'en',
  'zh',
  'ja',
  'ko',
  'hi',
  'ms',
  'es',
  'pt',
  'de',
  'fr',
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/**
 * Centralized routing configuration for next-intl.
 * `localePrefix: 'always'` means every path is prefixed (e.g. `/en/merge-pdf`,
 * `/zh/merge-pdf`). Switch to `'as-needed'` if the default locale should be
 * served without a prefix (e.g. `/merge-pdf` for English).
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
