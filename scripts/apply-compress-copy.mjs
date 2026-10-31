#!/usr/bin/env node
/**
 * Merge the `/compress-pdf` copy in `scripts/compress-copy/<locale>.json` into
 * `src/messages/<locale>.json`.
 *
 * Same reasoning as `apply-content-depth.mjs`: the new tool adds ~30 strings per
 * locale, and keeping them in their own file makes the translation reviewable as
 * one diff instead of a needle in a 900-line dictionary. Keys are merged in
 * place, so re-running is idempotent and the resulting git diff contains added
 * keys only.
 *
 * This script owns everything that is *not* long-form prose:
 *
 * - `Tools.compress`, `ToolPages.compress`, `ToolContent.{intro,stepAction,useCases}`,
 *   `Faq.tool.compress` — the SEO and page scaffolding;
 * - `PdfCompress` — the workspace strings.
 *
 * `ToolContent.detail.compress` and `Faq.toolExtra.compress` live in
 * `scripts/content-depth/<locale>.json` instead, because the dictionary gate
 * treats them as the page's long-form body copy.
 *
 * Usage: node scripts/apply-compress-copy.mjs [locale ...]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_DIR = join(ROOT, "scripts", "compress-copy");
const MESSAGES_DIR = join(ROOT, "src", "messages");
const REFERENCE = "en";

/** Walk both trees and refuse a locale that dropped or invented a string. */
function leafPaths(value, prefix = "", out = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => leafPaths(item, `${prefix}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      leafPaths(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

function mergeInto(parent, key, source, trail, locale) {
  if (Array.isArray(source)) {
    if (!Array.isArray(parent[key])) parent[key] = [];
    parent[key] = source.map((item, index) => {
      if (typeof item !== "string" || item.trim() === "") {
        throw new Error(`${locale}: ${trail}[${index}] is empty`);
      }
      return item;
    });
    return;
  }

  if (source && typeof source === "object") {
    if (!parent[key] || typeof parent[key] !== "object" || Array.isArray(parent[key])) {
      parent[key] = {};
    }
    for (const child of Object.keys(source)) {
      mergeInto(parent[key], child, source[child], `${trail}.${child}`, locale);
    }
    return;
  }

  if (typeof source !== "string" || source.trim() === "") {
    throw new Error(`${locale}: ${trail} is empty`);
  }
  parent[key] = source;
}

const referenceCopy = JSON.parse(readFileSync(join(COPY_DIR, `${REFERENCE}.json`), "utf8"));
const referenceLeaves = leafPaths(referenceCopy);

const requested = process.argv.slice(2);
const available = readdirSync(COPY_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""))
  .sort();
const locales = requested.length > 0 ? requested : available;

for (const locale of locales) {
  const copy = JSON.parse(readFileSync(join(COPY_DIR, `${locale}.json`), "utf8"));
  const leaves = leafPaths(copy);

  const missing = [...referenceLeaves].filter((path) => !leaves.has(path));
  const extra = [...leaves].filter((path) => !referenceLeaves.has(path));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${locale}: structure differs from ${REFERENCE}.json — missing [${missing.join(", ")}], extra [${extra.join(", ")}]`,
    );
  }

  const messagePath = join(MESSAGES_DIR, `${locale}.json`);
  const messages = JSON.parse(readFileSync(messagePath, "utf8"));

  for (const key of Object.keys(copy)) {
    mergeInto(messages, key, copy[key], key, locale);
  }

  writeFileSync(messagePath, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`[compress-copy] ${locale}: ${leaves.size} strings merged`);
}
