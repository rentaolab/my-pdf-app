import { PDFDocument } from "pdf-lib";
import { getPdfjs } from "@/lib/pdfjs";

/**
 * Compression levels exposed by `/compress-pdf`.
 *
 * `light` only rewrites the file structure, so the document stays a normal
 * text PDF. The other two render every page to a JPEG and rebuild the document
 * from those images — that is what actually shrinks a scan, and also what makes
 * the text stop being text.
 */
export type CompressLevel = "light" | "balanced" | "strong";

export interface CompressResult {
  bytes: Uint8Array;
  level: CompressLevel;
  pageCount: number;
  /** `true` when the pages were rasterised, i.e. text is no longer selectable. */
  rasterized: boolean;
}

/** Thrown when the visitor presses cancel, so the UI can stay quiet about it. */
export class CompressionCancelled extends Error {
  constructor() {
    super("Compression cancelled");
    this.name = "CompressionCancelled";
  }
}

/**
 * Image presets. 150 DPI is the point where a scan still reads well on screen
 * and in print; 110 DPI is deliberately below that, for the case where the size
 * limit matters more than crispness.
 *
 * The values mirror `PdfToImageTool`'s choices so the two tools cannot drift
 * into different ideas of what "high" resolution means.
 */
const RASTER_PRESETS = {
  balanced: { dpi: 150, quality: 0.8 },
  strong: { dpi: 110, quality: 0.65 },
} as const;

/** Narrowing helper: `light` is the only level that keeps text as text. */
export function isRasterLevel(level: CompressLevel): level is "balanced" | "strong" {
  return level !== "light";
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas-encode-failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Lossless pass: repack the document with object streams.
 *
 * This is the only lever `pdf-lib` offers without decoding page content, and it
 * is honest about its limits — a PDF exported by any recent tool already uses
 * object streams, so the gain is usually a few percent, occasionally a few
 * hundred KB on files that came out of older software. `updateMetadata: false`
 * keeps pdf-lib from writing a fresh `Producer` / `ModDate`, which would add
 * bytes instead of removing them.
 */
export async function compressLossless(file: File): Promise<CompressResult> {
  const source = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(source, {
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });

  return { bytes, level: "light", pageCount: doc.getPageCount(), rasterized: false };
}

/**
 * Image pass: render every page with pdf.js and rebuild the PDF from JPEGs.
 *
 * Pages are handled one at a time and each canvas is released right after it is
 * encoded, because a 100-page A4 document at 150 DPI is ~2 GB of pixels if the
 * bitmaps are all held at once. `shouldCancel` is polled between pages, which
 * keeps a cancel click responsive without aborting a render mid-frame.
 *
 * Rotation is folded into the rendered image (`getViewport` already applies the
 * page's `/Rotate`), so the rebuilt page uses the width/height of the rotated
 * viewport and reads upright everywhere.
 */
export async function compressByRasterizing(
  file: File,
  level: "balanced" | "strong",
  options: {
    onProgress?: (done: number, total: number) => void;
    shouldCancel?: () => boolean;
  } = {},
): Promise<CompressResult> {
  const { onProgress, shouldCancel } = options;
  const preset = RASTER_PRESETS[level];

  const pdfjsLib = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const out = await PDFDocument.create();
    const total = pdf.numPages;

    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      if (shouldCancel?.()) throw new CompressionCancelled();

      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: preset.dpi / 72 });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas-2d-unavailable");

      // PDF has no background colour: without a white fill, transparent areas
      // come out black once the page is encoded as JPEG.
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport, canvas }).promise;
      page.cleanup();

      const blob = await canvasToJpeg(canvas, preset.quality);
      canvas.width = 0;
      canvas.height = 0;

      const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const pdfPage = out.addPage([base.width, base.height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });

      onProgress?.(pageNumber, total);
    }

    if (shouldCancel?.()) throw new CompressionCancelled();

    const bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return { bytes, level, pageCount: total, rasterized: true };
  } finally {
    await loadingTask.destroy();
  }
}

/** Dispatcher used by the component so the level is the only thing that varies. */
export function compressPdf(
  file: File,
  level: CompressLevel,
  options: {
    onProgress?: (done: number, total: number) => void;
    shouldCancel?: () => boolean;
  } = {},
): Promise<CompressResult> {
  return isRasterLevel(level)
    ? compressByRasterizing(file, level, options)
    : compressLossless(file);
}
