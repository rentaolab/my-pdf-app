import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware wrappers around Next.js' navigation APIs.
 *
 * Import `Link`, `useRouter`, `usePathname`, `redirect` and `getPathname`
 * from here (instead of `next/link` / `next/navigation`) when you want
 * hrefs to automatically carry the active locale prefix.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
