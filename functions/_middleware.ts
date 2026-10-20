/**
 * Locale negotiation for the static export — Cloudflare Pages Functions.
 *
 * `src/proxy.ts` (next-intl middleware) cannot run against an exported site, so
 * production redirects live here while `proxy.ts` keeps `next dev` behaving the
 * same way. Keep `LOCALES` in sync with `src/i18n/routing.ts`.
 *
 * Responsibilities (mirrors `localePrefix: "always"`):
 *   1. Requests for static files (`/brand/…`, `/sitemap.xml`, `/icon.png`) pass through.
 *   2. Trailing slashes are stripped with a 301, so `/en/` and `/en/merge-pdf/`
 *      land on `out/en.html` and `out/en/merge-pdf.html`.
 *   3. Locale-prefixed paths are served as-is.
 *   4. Everything else (`/`, `/merge-pdf`) is negotiated from the `NEXT_LOCALE`
 *      cookie, then `Accept-Language`, then the default locale, and 302'd.
 *
 * Types are declared locally to avoid pulling in `@cloudflare/workers-types`,
 * which `tsconfig.json` would otherwise require (it includes `**\/*.ts`).
 */

const LOCALES = ["en", "zh", "ja", "ko", "hi", "ms", "es", "pt", "de", "fr"] as const;
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

type PagesContext = {
  request: Request;
  next: () => Promise<Response>;
};

const isLocale = (value: string): boolean => (LOCALES as readonly string[]).includes(value);

/** `zh-CN` → `zh`, `pt-BR` → `pt`; unknown tags → null. */
function matchLocale(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split("-")[0];
  return isLocale(primary) ? primary : null;
}

function fromCookie(header: string | null): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LOCALE_COOKIE) return matchLocale(decodeURIComponent(rest.join("=")));
  }

  return null;
}

/** Picks the highest-weighted supported language, e.g. `zh-CN,zh;q=0.9,en;q=0.8`. */
function fromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((chunk, index) => {
      const [tag, ...params] = chunk.trim().split(";");
      const weight = params.find((param) => param.trim().startsWith("q="));
      const q = weight ? Number.parseFloat(weight.trim().slice(2)) : 1;

      return { tag: tag.trim(), index, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const entry of ranked) {
    const locale = matchLocale(entry.tag);
    if (locale) return locale;
  }

  return null;
}

/** `/en/merge-pdf` → `en`; `/` → `""`. */
function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const { pathname } = url;

  // 1. Static files: never redirect (exports contain dot-suffixed files).
  if (pathname.includes(".") && !pathname.startsWith("/_next/")) return context.next();

  // 2. Canonical form has no trailing slash (`out/en.html`, not `out/en/index.html`).
  if (pathname !== "/" && pathname.endsWith("/")) {
    return Response.redirect(`${url.origin}${pathname.replace(/\/+$/, "")}${url.search}`, 301);
  }

  // 3. Already localized.
  if (isLocale(firstSegment(pathname))) return context.next();

  // 4. Negotiate and remember the choice (next-intl used to do both).
  const locale =
    fromCookie(context.request.headers.get("cookie")) ??
    fromAcceptLanguage(context.request.headers.get("accept-language")) ??
    DEFAULT_LOCALE;

  const target = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${target}${url.search}`,
      "Set-Cookie": `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
    },
  });
};
