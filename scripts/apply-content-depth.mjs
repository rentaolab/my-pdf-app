#!/usr/bin/env node
/**
 * Merge the long-form tool copy in `scripts/content-depth/<locale>.json` into
 * `src/messages/<locale>.json`.
 *
 * Why a script instead of hand-editing ten dictionaries:
 *
 * - the copy is ~30 strings per locale (one "when to use it" paragraph plus two
 *   extra Q&A pairs per tool). Kept per locale, the translation can be reviewed
 *   as its own diff instead of inside 900 lines of UI strings;
 * - `JSON.stringify(data, null, 2)` round-trips the existing dictionaries byte
 *   for byte (verified for en/zh/ja), so the resulting diff contains added keys
 *   only — no reformatting noise;
 * - re-running is idempotent: keys are overwritten in place.
 *
 * The copy deliberately avoids repeating `intro` and `useCases`: the paragraph
 * explains *when* the tool is the right one and where its limits are, which is
 * what long-tail queries actually ask. Both FAQ sets merge into the same
 * `faqItems` array in `ToolPageShell`, so the visible list and the FAQPage
 * JSON-LD stay in sync automatically.
 *
 * Usage: node scripts/apply-content-depth.mjs [locale ...]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_DIR = join(ROOT, "scripts", "content-depth");
const MESSAGES_DIR = join(ROOT, "src", "messages");

const TOOL_KEYS = [
  "organize",
  "merge",
  "split",
  "rotate",
  "reorderPages",
  "deletePages",
  "extractPages",
  "crop",
  "edit",
  "pdfToImage",
  "imageToPdf",
  "compress",
];

/** Extra questions each locale has to provide per tool. */
const EXTRA_FAQ_COUNT = 2;

const requested = process.argv.slice(2);
const available = readdirSync(COPY_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));
const locales = requested.length > 0 ? requested : available.sort();

for (const locale of locales) {
  const copy = JSON.parse(readFileSync(join(COPY_DIR, `${locale}.json`), "utf8"));

  const missing = TOOL_KEYS.filter(
    (key) =>
      typeof copy.detail?.[key] !== "string" ||
      !Array.isArray(copy.faqExtra?.[key]) ||
      copy.faqExtra[key].length < EXTRA_FAQ_COUNT,
  );
  if (!copy.detailHeading || missing.length > 0) {
    throw new Error(
      `${locale}: detailHeading missing or detail/faqExtra incomplete for ${missing.join(", ") || "(all tools)"}`,
    );
  }

  const messagePath = join(MESSAGES_DIR, `${locale}.json`);
  const messages = JSON.parse(readFileSync(messagePath, "utf8"));

  messages.ToolContent.detailHeading = copy.detailHeading;
  messages.ToolContent.detail = copy.detail;
  messages.Faq.toolExtra = copy.faqExtra;

  writeFileSync(messagePath, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(
    `[content-depth] ${locale}: ${TOOL_KEYS.length} paragraphs + ${TOOL_KEYS.length * EXTRA_FAQ_COUNT} extra Q&A`,
  );
}
