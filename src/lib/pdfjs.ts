import type * as PdfjsModule from "pdfjs-dist";

/**
 * Lazy loader for pdf.js.
 *
 * `pdfjs-dist@6` runs side effects at module scope (it polyfills
 * `Iterator.prototype.join` and touches `GlobalWorkerOptions`). Because client
 * components are also evaluated on the server while prerendering, a top-level
 * `import * as pdfjsLib from "pdfjs-dist"` makes the **build** depend on the
 * Node version of the build machine (Node < 22.13 has no global `Iterator` and
 * crashes with `ReferenceError: Iterator is not defined`).
 *
 * Importing lazily keeps pdf.js out of the prerender path and out of the
 * initial client bundle: the ~400 KB library is only fetched when a tool
 * actually opens a PDF.
 */
let pdfjsPromise: Promise<typeof PdfjsModule> | null = null;

/** Load pdf.js in the browser (cached) and make sure the worker path is set. */
export function getPdfjs(): Promise<typeof PdfjsModule> {
  if (typeof window === "undefined") {
    // Every caller works on canvas / File objects, so this is only reachable
    // if a tool is rendered on the server by mistake.
    return Promise.reject(new Error("pdf.js 只能在浏览器中加载。"));
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      // Self-hosted worker (copied into `public/` by
      // `scripts/sync-pdf-worker.mjs`, run from `predev`/`prebuild`).
      // Same origin means no third-party CDN can block page rendering, and the
      // version in the file name always matches this module's `mod.version` —
      // pdf.js throws "API version does not match the Worker version" otherwise.
      mod.GlobalWorkerOptions.workerSrc = `/pdf.worker.${mod.version}.min.mjs`;
      return mod;
    });
  }

  return pdfjsPromise;
}
