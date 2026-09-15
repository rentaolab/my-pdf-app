'use client';

import type { ChangeEvent } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';

/** Language names written in their own language (endonyms). */
const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ms: 'Bahasa Melayu',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  fr: 'Français',
};

type Props = {
  /** Stretch the control to the full width of its container (e.g. mobile drawer). */
  fullWidth?: boolean;
};

export default function LanguageSwitcher({ fullWidth = false }: Props) {
  const t = useTranslations('LanguageSwitcher');
  const activeLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;

    // `pathname` from `@/i18n/navigation` is locale-free (e.g. `/merge-pdf`),
    // so combining it with `locale` yields the target URL directly
    // (e.g. `/zh/merge-pdf`) instead of going through an extra redirect.
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div
      className={`relative inline-flex items-center ${fullWidth ? 'w-full' : ''}`}
    >
      <Globe
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400"
      />
      <select
        aria-label={t('label')}
        value={activeLocale}
        onChange={handleChange}
        className={`appearance-none cursor-pointer rounded-xl border border-slate-200/80 bg-white/70 py-2 pl-8 pr-7 text-xs font-bold text-slate-600 transition-all hover:border-red-500/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
          fullWidth ? 'w-full' : ''
        }`}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400"
      />
    </div>
  );
}
