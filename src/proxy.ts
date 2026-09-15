import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale negotiation + redirect/rewrite handling.
 *
 * Note: `middleware.ts` was renamed to `proxy.ts` in Next.js 16. This file is
 * the direct replacement and is picked up automatically by the framework.
 */
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
