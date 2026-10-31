#!/usr/bin/env node
/**
 * Merge the standalone pages (`/about`, `/how-it-works`) and the badge labels in
 * `scripts/info-pages/<locale>.json` into `src/messages/<locale>.json`.
 *
 * Same reasoning as `apply-content-depth.mjs`: the prose is reviewed as its own
 * per-locale file instead of inside a ~1000-line UI dictionary, and
 * `JSON.stringify(data, null, 2)` round-trips the dictionaries byte for byte, so
 * the resulting diff contains the two new top-level namespaces and nothing else.
 * Re-running is idempotent — both namespaces are replaced wholesale.
 *
 * `InfoPages` holds one entry per static page; `Badges` is the vocabulary the
 * tool pages and the how-it-works legend share (see `docs/brand-brief.md` §7).
 *
 * Usage: node scripts/apply-info-pages.mjs [locale ...]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_DIR = join(ROOT, "scripts", "info-pages");
const MESSAGES_DIR = join(ROOT, "src", "messages");

/** Pages that must exist in every locale, with the shape each one needs. */
const PAGES = {
  about: { sections: 4, steps: 0 },
  howItWorks: { sections: 3, steps: 3 },
};

const BADGE_KEYS = [
  "legendHeading",
  "runsLocally",
  "needsInternet",
  "beta",
  "runsLocallyMeaning",
  "needsInternetMeaning",
  "betaMeaning",
];

const requested = process.argv.slice(2);
const available = readdirSync(COPY_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));
const locales = requested.length > 0 ? requested : available.sort();

for (const locale of locales) {
  const copy = JSON.parse(readFileSync(join(COPY_DIR, `${locale}.json`), "utf8"));

  for (const [pageKey, shape] of Object.entries(PAGES)) {
    const page = copy.InfoPages?.[pageKey];
    if (!page?.title || !page?.description || !page?.intro) {
      throw new Error(`${locale}: InfoPages.${pageKey} needs title, description and intro`);
    }
    // `about` has no numbered steps; `howItWorks` is built around them, so the
    // count is asserted per page rather than "at least one".
    const sections = Array.isArray(page.sections) ? page.sections.length : 0;
    const steps = Array.isArray(page.steps) ? page.steps.length : 0;
    if (sections !== shape.sections || steps !== shape.steps) {
      throw new Error(
        `${locale}: InfoPages.${pageKey} has ${sections} sections / ${steps} steps (expected ${shape.sections} / ${shape.steps})`,
      );
    }
  }

  // Both pages share one contact line, so it sits at the namespace root.
  if (!copy.InfoPages?.contactLabel) {
    throw new Error(`${locale}: InfoPages.contactLabel is missing`);
  }

  const missingBadges = BADGE_KEYS.filter((key) => typeof copy.Badges?.[key] !== "string");
  if (missingBadges.length > 0) {
    throw new Error(`${locale}: Badges is missing ${missingBadges.join(", ")}`);
  }

  const messagePath = join(MESSAGES_DIR, `${locale}.json`);
  const messages = JSON.parse(readFileSync(messagePath, "utf8"));

  // Appending after the existing namespaces keeps the diff to two additions.
  messages.InfoPages = copy.InfoPages;
  messages.Badges = copy.Badges;

  writeFileSync(messagePath, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`[info-pages] ${locale}: ${Object.keys(PAGES).length} pages + ${BADGE_KEYS.length} badge strings`);
}
