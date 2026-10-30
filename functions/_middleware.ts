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
 *   4. Legacy un-prefixed paths (`/merge-pdf`, the pre-i18n URL shape) are 301'd
 *      to `/{default}{path}`. The target deliberately ignores `Accept-Language`:
 *      a cached 301 would otherwise pin every later visitor to the locale of
 *      whichever client filled the cache first.
 *   5. The root `/` is negotiated from the `NEXT_LOCALE` cookie, then
 *      `Accept-Language`, then the default locale, and 302'd — temporary on
 *      purpose, because the same URL resolves to different locales.
 *   6. Framework error routes (`/404`, `/_not-found`) are never negotiated, and
 *      their status is forced back to 404 — Cloudflare otherwise serves the
 *      exported `404.html` with status 200, which is a soft 404.
 *   7. Any host that is not the production domain gets `X-Robots-Tag: noindex`
 *      so `*.pages.dev` / staging previews never compete with pdf.reeff.app.
 *
 * Types are declared locally to avoid pulling in `@cloudflare/workers-types`,
 * which `tsconfig.json` would otherwise require (it includes `**\/*.ts`).
 */

const LOCALES = ["en", "zh", "ja", "ko", "hi", "ms", "es", "pt", "de", "fr"] as const;
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

/** Hosts allowed to be indexed. Everything else (pages.dev, staging, localhost) is not. */
const PRODUCTION_HOSTS = ["pdf.reeff.app"];

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

/**
 * Framework error routes. Cloudflare serves the exported `404.html` at `/404`
 * (and `_not-found.html` at `/_not-found`) with status 200, so these are passed
 * through and then forced back to 404 by `handleRequest`.
 */
const UNLOCALIZED_PATHS = ["/404", "/_not-found"] as const;

/**
 * Paths that existed before the i18n migration, when the site served them
 * without a locale prefix. Only these get a 301; unknown paths fall through to
 * a real 404 instead of a redirect that dead-ends one hop later.
 *
 * Keep in sync with `PAGE_PATHS` + `LEGAL_PATHS` in `src/lib/seo.ts`.
 */
const LEGACY_PATHS = new Set([
  "/organize-pdf",
  "/merge-pdf",
  "/split-pdf",
  "/rotate-pdf",
  "/reorder-pdf-pages",
  "/delete-pdf-pages",
  "/extract-pdf-pages",
  "/crop-pdf",
  "/edit-pdf",
  "/pdf-to-image",
  "/image-to-pdf",
  "/privacy",
  "/terms",
]);

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const response = await handleRequest(context);
  const { hostname } = new URL(context.request.url);

  if (PRODUCTION_HOSTS.includes(hostname)) return response;

  // Preview / staging hosts: keep them out of search results. Canonical and
  // hreflang already point at pdf.reeff.app, this is the belt to that braces.
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

async function handleRequest(context: PagesContext): Promise<Response> {
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

  // 4. Framework error routes must reach the export as-is. Cloudflare serves
  //    `out/404.html` at `/404` (and `out/_not-found.html` at `/_not-found`)
  //    with status 200, which is a soft 404 — keep the branded body but force
  //    the status back to 404.
  if ((UNLOCALIZED_PATHS as readonly string[]).includes(pathname)) {
    const response = await context.next();

    if (response.status !== 200) return response;

    return new Response(response.body, {
      status: 404,
      statusText: "Not Found",
      headers: response.headers,
    });
  }

  // 5. Legacy un-prefixed paths are a permanent move, so 301 — but always to the
  //    default locale. Picking the locale per request here would make the 301
  //    target vary with `Accept-Language`, and a cached 301 would then lock every
  //    later visitor into whichever locale reached the edge first.
  if (LEGACY_PATHS.has(pathname)) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `/${DEFAULT_LOCALE}${pathname}${url.search}`,
        Vary: "Accept-Language, Cookie",
      },
    });
  }

  // 6. Anything else does not exist. Serving it as-is produces a real 404;
  //    redirecting to `/en{path}` would add a hop that still ends in 404.
  if (pathname !== "/") return context.next();

  // 7. Root: negotiate and remember the choice (next-intl used to do both).
  const locale =
    fromCookie(context.request.headers.get("cookie")) ??
    fromAcceptLanguage(context.request.headers.get("accept-language")) ??
    DEFAULT_LOCALE;

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${locale}${url.search}`,
      Vary: "Accept-Language, Cookie",
      "Set-Cookie": `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
    },
  });
}
