import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored / generated: static assets are not source. `public/` now holds a
    // 1.2 MB minified pdf.js worker (copied by scripts/sync-pdf-worker.mjs) and
    // linting it produced ~1.6k meaningless warnings.
    "public/**",
  ]),
]);

export default eslintConfig;
