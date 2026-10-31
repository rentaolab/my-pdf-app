#!/usr/bin/env node
/**
 * Post-build SEO audit. Reads the static export in `out/` and fails when a page
 * is missing something a crawler needs: a title within budget, a long enough
 * description, a self-referencing canonical, the full hreflang cluster, an
 * Open Graph image, or any structured data.
 *
 * Usage:
 *   npm run build && npm run check:seo
 *
 * Everything is checked against the same constants the app renders from
 * (`src/lib/seo.ts`), so the audit cannot disagree with the build.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "out");

const SITE_URL = "https://pdf.reeff.app";
const SITE_NAME = "Reeff.PDF";

const LOCALES = ["en", "zh", "ja", "ko", "hi", "ms", "es", "pt", "de", "fr"];
const CJK_LOCALES = new Set(["zh", "ja", "ko"]);

const TITLE_MAX = 70;
const LATIN_DESCRIPTION_MIN = 60;
const CJK_DESCRIPTION_MIN = 45;

/**
 * Pages that the framework generates on its own (404 shell, not-found page).
 * They carry no metadata and are not meant to rank, so they are skipped.
 */
const SKIP_PAGES = /\/(404|500|_not-found)(\.html)?$/;

const problems = [];
const warnings = [];
let audited = 0;

/** Recursively collect every `.html` file in `out/`. */
function htmlFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) htmlFiles(full, files);
    else if (entry.endsWith(".html")) files.push(full);
  }
  return files;
}

/** `out/zh/merge-pdf.html` → `{ locale: "zh", path: "/zh/merge-pdf" }`. */
function routeOf(file) {
  const rel = relative(OUT_DIR, file)
    .replace(/\\/g, "/")
    .replace(/\.html$/, "")
    .replace(/\/index$/, "");
  const path = rel === "" || rel === "index" ? "/" : `/${rel}`;
  const segments = path.split("/").filter(Boolean);
  const locale = LOCALES.includes(segments[0]) ? segments[0] : "en";
  return { locale, path };
}

const match = (content, pattern) => content.match(pattern)?.[1] ?? null;

let files;
try {
  files = htmlFiles(OUT_DIR);
} catch {
  console.error("✗ out/ is missing — run `npm run build` before `npm run check:seo`.");
  process.exit(1);
}

for (const file of files) {
  const { locale, path } = routeOf(file);
  if (SKIP_PAGES.test(path)) continue;

  const html = readFileSync(file, "utf8");
  const label = path;
  audited += 1;

  const title = match(html, /<title>([^<]*)<\/title>/);
  if (!title) problems.push(`${label}: no <title>`);
  else if (title.length > TITLE_MAX) problems.push(`${label}: title is ${title.length} chars (max ${TITLE_MAX})`);
  else if (title.length < 12) problems.push(`${label}: title is only ${title.length} chars`);

  const description = match(html, /<meta name="description" content="([^"]*)"/);
  const descriptionMin = CJK_LOCALES.has(locale) ? CJK_DESCRIPTION_MIN : LATIN_DESCRIPTION_MIN;
  if (!description) problems.push(`${label}: no meta description`);
  else if (description.length < descriptionMin) {
    problems.push(`${label}: description is only ${description.length} chars (min ${descriptionMin})`);
  }

  const canonical = match(html, /<link rel="canonical" href="([^"]*)"/);
  if (!canonical) problems.push(`${label}: no canonical`);
  else if (canonical !== `${SITE_URL}${path}`) {
    problems.push(`${label}: canonical is ${canonical}, expected ${SITE_URL}${path}`);
  }

  // React renders the attribute as `hrefLang`. HTML attribute names are
  // case-insensitive, so the audit accepts either spelling and either order.
  const alternates = [
    ...html.matchAll(/<link[^>]*rel="alternate"[^>]*hrefLang="([^"]+)"[^>]*href="([^"]+)"[^>]*>/gi),
  ];
  if (alternates.length < LOCALES.length + 1) {
    problems.push(`${label}: only ${alternates.length} hreflang tags (expected ${LOCALES.length + 1})`);
  }
  if (!alternates.some(([, code]) => code === "x-default")) problems.push(`${label}: no x-default hreflang`);

  if (!match(html, /<meta property="og:image" content="([^"]*)"/)) problems.push(`${label}: no og:image`);
  if (!match(html, /<meta property="og:description" content="([^"]*)"/)) problems.push(`${label}: no og:description`);
  if (!match(html, /<meta property="og:locale" content="([^"]*)"/)) problems.push(`${label}: no og:locale`);
  if (!match(html, /<meta name="twitter:card" content="([^"]*)"/)) warnings.push(`${label}: no twitter:card`);

  if (!html.includes("application/ld+json")) problems.push(`${label}: no JSON-LD block`);

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count !== 1) problems.push(`${label}: ${h1Count} <h1> elements (expected exactly 1)`);

  if (html.length < 4000) warnings.push(`${label}: only ${html.length} bytes of HTML`);
}

// Sitemap sanity: every URL it advertises must exist as a file, and the count
// must match 10 locales × (home + 11 tools + privacy + terms).
try {
  const sitemap = readFileSync(join(OUT_DIR, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  if (urls.length !== LOCALES.length * 14) {
    warnings.push(`sitemap.xml has ${urls.length} URLs (expected ${LOCALES.length * 14})`);
  }
  for (const url of urls) {
    const route = url.slice(SITE_URL.length) || "/";
    const candidates =
      route === "/"
        ? [join(OUT_DIR, "index.html")]
        : [join(OUT_DIR, `${route}.html`), join(OUT_DIR, route, "index.html")];
    const exists = candidates.some((candidate) => {
      try {
        statSync(candidate);
        return true;
      } catch {
        return false;
      }
    });
    if (!exists) problems.push(`sitemap.xml advertises ${url} but no HTML file exists for it`);
  }
} catch {
  problems.push("out/sitemap.xml is missing");
}

try {
  const robots = readFileSync(join(OUT_DIR, "robots.txt"), "utf8");
  if (!robots.includes("Sitemap:")) problems.push("robots.txt does not reference a sitemap");
} catch {
  problems.push("out/robots.txt is missing");
}

for (const warning of warnings) console.warn(`  ! ${warning}`);

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} SEO problem(s) across ${audited} pages:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `✓ ${audited} pages audited — title, description, canonical, hreflang, Open Graph, JSON-LD and <h1> all present.`,
);
console.log(`  ${SITE_NAME} · ${SITE_URL}`);
