#!/usr/bin/env node
/**
 * Content-depth gate for pdf.reeff.app.
 *
 * AdSense rejected both sites for "low value content". The root domain was
 * fixed by adding guides. The tool subdomain needed a different fix, because
 * its tool pages *are* the product and cannot be dropped: the problem there is
 * not that one page is short in isolation, it is that every page came from one
 * template, so two tools read as the same document with the nouns swapped.
 *
 * Two properties are therefore measured on the built export:
 *
 * - words per tool page after nav, footer and scripts are stripped — the text a
 *   reviewer actually sees, not the RSC payload;
 * - five-word shingle overlap between every pair of tool pages. That is the
 *   number that catches template drift. It fell from 38.6% to 29.5% when the
 *   `intro` and `detail` copy grew (see `scripts/content-depth/`), and it is
 *   what regresses when someone adds a thirteenth tool by copying an existing
 *   one.
 *
 * Thresholds sit below the current values so ordinary copy edits do not trip
 * the build while a copy-pasted page does.
 *
 * Only the reference locale is measured for depth: `check-messages.mjs`
 * already forces all ten dictionaries to share the same keys and length
 * floors, so a translation cannot fall behind structurally. The remaining
 * locales are still checked for page parity, so no locale can ship fewer tool
 * pages than English.
 *
 * Wired into `postbuild` (so `npm run build` fails) and into `npm run check`.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "out");

const LOCALES = ["en", "zh", "ja", "ko", "hi", "ms", "es", "pt", "de", "fr"];
const REFERENCE_LOCALE = "en";

/** Shells rendered by `InfoPageShell` / `LegalPageShell`, not tool pages. */
const NON_TOOL_PAGES = new Set([
  "index",
  "about",
  "how-it-works",
  "contact",
  "privacy",
  "terms",
  "404",
  "500",
  "_not-found",
]);

/**
 * Current floor is 520 words (`split-pdf`, the thinnest page). The threshold
 * is set 40 words lower so a trimmed paragraph does not fail the build, while
 * a page that loses its long-form block does.
 */
const MIN_TOOL_WORDS = 480;

/** Current peak is 29.5% (`crop-pdf` vs `edit-pdf`). */
const MAX_SHINGLE_OVERLAP = 0.33;
const SHINGLE_SIZE = 5;

const problems = [];

/** Visible text of a page: markup, scripts, nav, footer and header removed. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word tokens, lowercased, punctuation dropped — the shingle alphabet. */
function words(text) {
  return text.toLowerCase().match(/[a-z0-9'-]+/g) ?? [];
}

function shingles(tokens) {
  const set = new Set();
  for (let i = 0; i + SHINGLE_SIZE <= tokens.length; i += 1) {
    set.add(tokens.slice(i, i + SHINGLE_SIZE).join(" "));
  }
  return set;
}

/** Tool page slug for every `.html` file a locale exported, minus the shells. */
function toolSlugs(locale) {
  const dir = join(OUT_DIR, locale);
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => name.slice(0, -".html".length))
    .filter((slug) => !NON_TOOL_PAGES.has(slug))
    .sort();
}

const referenceSlugs = toolSlugs(REFERENCE_LOCALE);
if (!referenceSlugs) {
  console.error(`✗ ${join(OUT_DIR, REFERENCE_LOCALE)} not found — run \`npm run build\` first.`);
  process.exit(1);
}
if (referenceSlugs.length === 0) {
  console.error("✗ No tool pages found in the export.");
  process.exit(1);
}

// Page parity: every locale must export the same tool pages as the reference.
for (const locale of LOCALES) {
  if (locale === REFERENCE_LOCALE) continue;
  const localesSlugs = toolSlugs(locale);
  if (!localesSlugs) {
    problems.push(`${locale}: no export directory`);
    continue;
  }
  const missing = referenceSlugs.filter((slug) => !localesSlugs.includes(slug));
  const extra = localesSlugs.filter((slug) => !referenceSlugs.includes(slug));
  if (missing.length > 0) problems.push(`${locale}: missing tool page(s) ${missing.join(", ")}`);
  if (extra.length > 0) problems.push(`${locale}: unexpected page(s) ${extra.join(", ")}`);
}

// Content depth in the reference locale.
const shingleSets = new Map();
const wordCounts = new Map();

for (const slug of referenceSlugs) {
  const html = readFileSync(join(OUT_DIR, REFERENCE_LOCALE, `${slug}.html`), "utf8");
  const tokens = words(visibleText(html));
  wordCounts.set(slug, tokens.length);
  shingleSets.set(slug, shingles(tokens));

  if (tokens.length < MIN_TOOL_WORDS) {
    problems.push(`${REFERENCE_LOCALE}/${slug}: ${tokens.length} words, minimum ${MIN_TOOL_WORDS}`);
  }
}

// Template overlap between every pair of tool pages in the same language.
let worstPair = { overlap: 0, a: "", b: "" };
const slugs = [...shingleSets.keys()];
for (let i = 0; i < slugs.length; i += 1) {
  for (let j = i + 1; j < slugs.length; j += 1) {
    const a = shingleSets.get(slugs[i]);
    const b = shingleSets.get(slugs[j]);
    const smaller = Math.min(a.size, b.size);
    if (smaller === 0) continue;

    let shared = 0;
    for (const shingle of a) if (b.has(shingle)) shared += 1;
    const overlap = shared / smaller;

    if (overlap > worstPair.overlap) worstPair = { overlap, a: slugs[i], b: slugs[j] };
    if (overlap > MAX_SHINGLE_OVERLAP) {
      problems.push(
        `${slugs[i]} vs ${slugs[j]}: ${(overlap * 100).toFixed(1)}% shared ${SHINGLE_SIZE}-grams, maximum ${(MAX_SHINGLE_OVERLAP * 100).toFixed(0)}%`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} content problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const counts = [...wordCounts.values()];
const thinnest = [...wordCounts.entries()].sort((x, y) => x[1] - y[1])[0];
console.log(
  `✓ ${slugs.length} tool pages × ${LOCALES.length} locales — ${Math.min(...counts)}–${Math.max(...counts)} words (thinnest: ${thinnest[0]})`,
);
console.log(
  `  Peak ${SHINGLE_SIZE}-gram overlap ${(worstPair.overlap * 100).toFixed(1)}% (${worstPair.a} vs ${worstPair.b}).`,
);
