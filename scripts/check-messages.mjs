#!/usr/bin/env node
/**
 * Dictionary gate. Fails the build when a locale drifts from the English
 * reference: missing or extra keys, a metadata description that is too short to
 * be useful in a SERP, or an incomplete FAQ / use-case block.
 *
 * Run with `npm run check:messages` (part of `npm run check`).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "src");
const MESSAGES_DIR = join(SRC_DIR, "messages");

/** Locales served by the app, in the same order as `src/i18n/routing.ts`. */
const LOCALES = ["en", "zh", "ja", "ko", "hi", "ms", "es", "pt", "de", "fr"];
const REFERENCE = "en";

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
];

/** SEO budget. Title stays under ~60 chars, description in the 90–165 range. */
const TITLE_MAX = 70;
const DESCRIPTION_MIN = 60;
const DESCRIPTION_MAX = 200;

/**
 * CJK text carries roughly twice the information per character, so the Latin
 * length budgets would reject perfectly good Chinese, Japanese and Korean copy.
 * Thresholds are scaled per script family instead of being one global number.
 */
const CJK_LOCALES = new Set(["zh", "ja", "ko"]);

/** Minimum characters for an FAQ answer and for a use-case bullet. */
const MIN_ANSWER_LENGTH = 30;
const MIN_USE_CASE_LENGTH = 15;

const problems = [];

function readDictionary(locale) {
  try {
    return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"));
  } catch (error) {
    problems.push(`${locale}.json is not valid JSON: ${error.message}`);
    return null;
  }
}

/** Flatten to `a.b[0].c` → value so two dictionaries can be compared key by key. */
function flatten(value, prefix = "", out = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

const dictionaries = Object.fromEntries(LOCALES.map((locale) => [locale, readDictionary(locale)]));
const reference = dictionaries[REFERENCE];

if (!reference) {
  console.error("✗ src/messages/en.json is missing — cannot validate the other locales.");
  process.exit(1);
}

const referenceKeys = flatten(reference);

/**
 * Client components resolve translations from the dictionary the locale layout
 * forwards to `NextIntlClientProvider` — i.e. only `CLIENT_NAMESPACES`. A
 * `"use client"` file calling `useTranslations("X")` with an `X` outside that list
 * still prerenders fine (the server holds the full dictionary) and only fails in
 * the browser with MISSING_MESSAGE, so the mismatch is caught here instead.
 */
function checkClientNamespaces() {
  const layoutPath = join(SRC_DIR, "app", "[locale]", "layout.tsx");
  const layout = readFileSync(layoutPath, "utf8");
  const list = layout.match(/const CLIENT_NAMESPACES = \[([\s\S]*?)\] as const/);
  if (!list) {
    problems.push("layout.tsx: CLIENT_NAMESPACES array not found");
    return;
  }

  const forwarded = new Set([...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const topLevel = new Set(Object.keys(reference));
  const used = new Map();

  for (const file of readdirSync(SRC_DIR, { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(join(SRC_DIR, file), "utf8");
    if (!/^\s*["']use client["']/.test(source)) continue;

    for (const match of source.matchAll(/useTranslations\(\s*["']([^"']+)["']\s*\)/g)) {
      used.set(match[1], file);
    }
    // A bare `useTranslations()` resolves from the root, e.g. `t("Tools.merge.name")`.
    if (/useTranslations\(\s*\)/.test(source)) {
      for (const match of source.matchAll(/\bt\(\s*[`'"]([A-Za-z]+)\./g)) {
        used.set(match[1], file);
      }
    }
  }

  for (const [namespace, file] of used) {
    if (topLevel.has(namespace) && !forwarded.has(namespace)) {
      problems.push(
        `src/${file}: useTranslations("${namespace}") is missing from CLIENT_NAMESPACES in layout.tsx`,
      );
    }
  }
}

checkClientNamespaces();

for (const locale of LOCALES) {
  const dictionary = dictionaries[locale];
  if (!dictionary) continue;

  const keys = flatten(dictionary);
  const isCjk = CJK_LOCALES.has(locale);
  const descriptionMin = isCjk ? Math.round(DESCRIPTION_MIN * 0.75) : DESCRIPTION_MIN;
  const answerMin = isCjk ? Math.round(MIN_ANSWER_LENGTH * 0.5) : MIN_ANSWER_LENGTH;
  const useCaseMin = isCjk ? Math.round(MIN_USE_CASE_LENGTH * 0.65) : MIN_USE_CASE_LENGTH;

  for (const key of referenceKeys.keys()) {
    if (!keys.has(key)) problems.push(`${locale}: missing key "${key}"`);
  }
  for (const key of keys.keys()) {
    if (!referenceKeys.has(key)) problems.push(`${locale}: key "${key}" does not exist in ${REFERENCE}`);
  }

  for (const tool of TOOL_KEYS) {
    const page = dictionary.ToolPages?.[tool];
    if (!page) {
      problems.push(`${locale}: ToolPages.${tool} is missing`);
      continue;
    }
    if (!page.seoTitle) problems.push(`${locale}: ToolPages.${tool}.seoTitle is empty`);
    else if (page.seoTitle.length > TITLE_MAX) {
      problems.push(`${locale}: ToolPages.${tool}.seoTitle is ${page.seoTitle.length} chars (max ${TITLE_MAX})`);
    }

    if (!page.seoDescription) problems.push(`${locale}: ToolPages.${tool}.seoDescription is empty`);
    else if (page.seoDescription.length < descriptionMin) {
      problems.push(
        `${locale}: ToolPages.${tool}.seoDescription is only ${page.seoDescription.length} chars (min ${descriptionMin})`,
      );
    } else if (page.seoDescription.length > DESCRIPTION_MAX) {
      problems.push(
        `${locale}: ToolPages.${tool}.seoDescription is ${page.seoDescription.length} chars (max ${DESCRIPTION_MAX})`,
      );
    }

    const faq = dictionary.Faq?.tool?.[tool];
    if (!faq?.q || !faq?.a) problems.push(`${locale}: Faq.tool.${tool} needs both q and a`);
    else if (faq.a.length < answerMin) {
      problems.push(`${locale}: Faq.tool.${tool}.a is too short (${faq.a.length} chars)`);
    }

    const useCases = dictionary.ToolContent?.useCases?.[tool];
    if (!Array.isArray(useCases) || useCases.length < 3) {
      problems.push(`${locale}: ToolContent.useCases.${tool} needs at least 3 entries`);
    } else {
      useCases.forEach((entry, index) => {
        if (typeof entry !== "string" || entry.length < useCaseMin) {
          problems.push(`${locale}: ToolContent.useCases.${tool}[${index}] is too short`);
        }
      });
    }
  }

  for (const key of ["free", "privacy", "sizeLimit", "mobile"]) {
    if (!dictionary.Faq?.common?.[key]?.q || !dictionary.Faq?.common?.[key]?.a) {
      problems.push(`${locale}: Faq.common.${key} needs both q and a`);
    }
  }

  if (!dictionary.Faq?.heading) problems.push(`${locale}: Faq.heading is missing`);

  // Legal pages are indexed (low priority) and shown in the language switcher,
  // so a missing or stub description hurts the ad-network review as well.
  for (const doc of ["privacy", "terms"]) {
    const page = dictionary.Legal?.[doc];
    if (!page?.title || !page?.description) {
      problems.push(`${locale}: Legal.${doc} needs both title and description`);
    } else if (page.description.length < descriptionMin) {
      problems.push(
        `${locale}: Legal.${doc}.description is only ${page.description.length} chars (min ${descriptionMin})`,
      );
    }
  }
  if (!Array.isArray(dictionary.HomePage?.why) || dictionary.HomePage.why.length < 3) {
    problems.push(`${locale}: HomePage.why needs at least 3 items`);
  }
  for (const group of ["organize", "convert", "edit"]) {
    if (!dictionary.HomePage?.groups?.[group]?.title || !dictionary.HomePage?.groups?.[group]?.body) {
      problems.push(`${locale}: HomePage.groups.${group} needs title and body`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} message problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`✓ ${LOCALES.length} locales, ${referenceKeys.size} keys each — structure and SEO copy match ${REFERENCE}.`);
