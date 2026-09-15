import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { routing } from './routing';

/**
 * Request-scoped i18n configuration.
 *
 * The active locale is read from the `[locale]` root param (Next.js 16.3+
 * `next/root-params` API, the recommended replacement for the deprecated
 * `requestLocale`). Unknown locales result in a 404.
 */
export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();

    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
