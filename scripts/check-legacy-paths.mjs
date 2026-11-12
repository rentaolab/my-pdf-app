#!/usr/bin/env node
/**
 * Path-drift gate for pdf.reeff.app.
 *
 * `functions/_middleware.ts` has to repeat the page list by hand: it runs on
 * Cloudflare Pages, outside the app's `@/` alias resolution, so it cannot import
 * `src/lib/seo.ts`. The file itself carries a "keep in sync" comment, which is a
 * promise no compiler checks.
 *
 * That is exactly how `/compress-pdf` shipped as a 404 — it was added to `TOOLS`
 * (and therefore to the sitemap) but never to `LEGACY_PATHS`, so
 * `pdf.reeff.app/compress-pdf` fell through to the static export instead of
 * 301-ing to `/en/compress-pdf`. `check-seo.mjs` could not catch it: that script
 * audits `out/`, and the missing entry only exists in a Pages Function.
 *
 * This gate compares the two lists as text and fails the build when they
 * disagree, so the next tool cannot ship half-wired. It also checks the locale
 * list and default locale against `src/i18n/routing.ts`, which carries the same
 * kind of hand-sync promise.
 *
 * Wired into `postbuild` (so `npm run build` fails) and into `npm run check`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SEO = "src/lib/seo.ts";
const MIDDLEWARE = "functions/_middleware.ts";
const ROUTING = "src/i18n/routing.ts";

const problems = [];
const fail = (message) => problems.push(message);

const read = (relPath) => readFileSync(path.join(ROOT, relPath), "utf8");

/** Every quoted string inside `pattern`'s first capture group, in source order. */
function quoted(source, pattern, label) {
  const block = source.match(pattern);
  if (!block) {
    fail(`${label}: could not locate the declaration`);
    return null;
  }
  return [...block[1].matchAll(/["']([^"']+)["']/g)].map(([, value]) => value);
}

const seo = read(SEO);
const middleware = read(MIDDLEWARE);
const routing = read(ROUTING);

// 1. Every locale-free tool path must be a legacy path, or it 404s on the way in.
//
// `TOOLS` entries look like `{ key: "compress", path: "/compress-pdf" }`, so the
// block also contains the `key` values — read only the `path:` fields.
const toolsBlock = seo.match(/export const TOOLS = \[([\s\S]*?)\] as const;/);
if (!toolsBlock) fail(`${SEO}: could not locate \`TOOLS\``);
const toolPaths = toolsBlock ? [...toolsBlock[1].matchAll(/path:\s*["']([^"']+)["']/g)].map(([, value]) => value) : null;

const legalPaths = quoted(seo, /export const LEGAL_PATHS = \[([\s\S]*?)\] as const;/, `${SEO}: \`LEGAL_PATHS\``);
const legacyPaths = quoted(middleware, /const LEGACY_PATHS = new Set\(\[([\s\S]*?)\]\);/, `${MIDDLEWARE}: \`LEGACY_PATHS\``);

if (toolPaths && legalPaths && legacyPaths) {
  const expected = new Set([...toolPaths, ...legalPaths]);
  const actual = new Set(legacyPaths);

  for (const entry of expected) {
    if (!actual.has(entry)) fail(`${MIDDLEWARE}: \`LEGACY_PATHS\` is missing "${entry}" — ${entry} would 404 instead of 301 to /en${entry}`);
  }
  for (const entry of actual) {
    if (!expected.has(entry)) fail(`${MIDDLEWARE}: \`LEGACY_PATHS\` has "${entry}", which is not a tool or legal path in ${SEO}`);
  }

  if (problems.length === 0) {
    console.log(`  ${expected.size} legacy path(s) match ${SEO} (${toolPaths.length} tools + ${legalPaths.length} legal).`);
  }
}

// 2. Locale list and default locale must match the app's routing config.
const middlewareLocales = quoted(middleware, /const LOCALES = \[([\s\S]*?)\] as const;/, `${MIDDLEWARE}: \`LOCALES\``);
const routingLocales = quoted(routing, /export const locales = \[([\s\S]*?)\] as const;/, `${ROUTING}: \`locales\``);

if (middlewareLocales && routingLocales && middlewareLocales.join(",") !== routingLocales.join(",")) {
  fail(
    `${MIDDLEWARE}: \`LOCALES\` (${middlewareLocales.join(", ")}) does not match ${ROUTING} (${routingLocales.join(", ")})`,
  );
}

const middlewareDefault = middleware.match(/const DEFAULT_LOCALE = ["']([^"']+)["']/);
const routingDefault = routing.match(/export const defaultLocale[^=]*=\s*["']([^"']+)["']/);

if (!middlewareDefault) fail(`${MIDDLEWARE}: could not locate \`DEFAULT_LOCALE\``);
if (!routingDefault) fail(`${ROUTING}: could not locate \`defaultLocale\``);

if (middlewareDefault && routingDefault && middlewareDefault[1] !== routingDefault[1]) {
  fail(`${MIDDLEWARE}: \`DEFAULT_LOCALE\` ("${middlewareDefault[1]}") does not match ${ROUTING} ("${routingDefault[1]}")`);
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} path drift problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\n  Add the missing path to `LEGACY_PATHS` in functions/_middleware.ts; it is what makes");
  console.error("  the old un-prefixed URL 301 to /en<path> instead of returning 404.");
  process.exit(1);
}

console.log(`✓ Locale negotiation paths are in sync — no legacy URL can silently 404.`);
