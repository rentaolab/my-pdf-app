#!/usr/bin/env python3
"""Merge the localized SEO copy in `scripts/seo-copy/` into `src/messages/*.json`.

Why a script instead of hand-editing ten dictionaries:

* The copy is ~90 strings per locale (metadata, FAQ, use cases, home sections).
  Keeping it in one place per locale makes the review of a translation diff
  possible without scrolling through 700 lines of unrelated UI strings.
* `json.dump` preserves the existing 2-space / non-ASCII layout, so the resulting
  diff only contains added keys — no reformatting noise.
* Re-running is idempotent: keys are overwritten in place.

Usage:  python3 scripts/apply-seo-copy.py [locale ...]
"""

import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COPY_DIR = os.path.join(ROOT, "scripts", "seo-copy")
MESSAGES_DIR = os.path.join(ROOT, "src", "messages")

TOOL_KEYS = [
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
]


def load_copy(locale: str) -> dict:
    """Merge `<locale>.*.json` fragments into one dict (fragment order is stable)."""
    merged: dict = {}
    for path in sorted(glob.glob(os.path.join(COPY_DIR, f"{locale}.*.json"))):
        with open(path, encoding="utf8") as handle:
            merged.update(json.load(handle))
    if not merged:
        raise SystemExit(f"no copy fragments found for locale {locale!r}")
    return merged


def apply(locale: str) -> None:
    copy = load_copy(locale)
    message_path = os.path.join(MESSAGES_DIR, f"{locale}.json")
    with open(message_path, encoding="utf8") as handle:
        data = json.load(handle)

    tool_pages = copy.get("toolPages", {})
    missing = [key for key in TOOL_KEYS if key not in tool_pages]
    if missing:
        raise SystemExit(f"{locale}: missing seoTitle/seoDescription for {missing}")

    for key in TOOL_KEYS:
        entry = tool_pages[key]
        data["ToolPages"][key]["seoTitle"] = entry["seoTitle"]
        data["ToolPages"][key]["seoDescription"] = entry["seoDescription"]

    if "faq" in copy:
        data["Faq"] = copy["faq"]
    if "useCases" in copy:
        data["ToolContent"]["useCases"] = copy["useCases"]
    if "home" in copy:
        data["HomePage"].update(copy["home"])

    with open(message_path, "w", encoding="utf8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"{locale}: {len(TOOL_KEYS)} tool pages, faq={len(copy.get('faq', {}).get('tool', {}))}")


if __name__ == "__main__":
    available = sorted(
        os.path.basename(path).split(".")[0]
        for path in glob.glob(os.path.join(COPY_DIR, "*.json"))
    )
    locales = sys.argv[1:] or sorted(set(available))
    for code in locales:
        apply(code)
