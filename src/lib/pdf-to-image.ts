import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// 设置 PDF.js Worker 路径（与 pdf-edit.ts 保持一致，浏览器端零上传）
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/** 支持的导出图片格式 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/** PDF 转图片的统一渲染参数 */
export interface PdfImageRenderOptions {
  /** 输出格式 */
  format: ImageFormat;
  /** 图片质量 0 ~ 1，仅对 JPEG / WebP 生效（PNG 无损，忽略该值） */
  quality: number;
  /** 导出分辨率（DPI），PDF 原生坐标系为 72 DPI */
  dpi: number;
}

const MIME_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const FILE_EXTENSIONS: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

export function getImageExtension(format: ImageFormat): string {
  return FILE_EXTENSIONS[format];
}

/** 去掉 .pdf 后缀，得到导出文件名前缀 */
export function getBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '');
}

/** 将 canvas 编码为 Blob（PNG 会忽略 quality 参数） */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('无法将画布编码为图片。'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * 渲染单个 PDF 页到 canvas。
 * 先用白色打底，保证导出 JPG / WebP 时透明区域不会变成黑色。
 */
async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  dpi: number
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前环境不支持 Canvas 2D。');
  }
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  page.cleanup();

  return canvas;
}

/**
 * 渲染单个 PDF 页面并导出为图片 Blob（单页下载）
 * @param file 原始 PDF 文件
 * @param pageIndex 页面索引（从 0 开始）
 */
export async function renderPDFPageToImageBlob(
  file: File,
  pageIndex: number,
  options: PdfImageRenderOptions
): Promise<Blob> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const canvas = await renderPageToCanvas(pdf, pageIndex + 1, options.dpi);
    const blob = await canvasToBlob(
      canvas,
      MIME_TYPES[options.format],
      options.quality
    );
    // 主动释放画布占用的内存
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * 逐页渲染选中的 PDF 页面，并按 PNG / JPG / WebP 打包为 ZIP（全页下载）
 * @param onProgress 进度回调 (已完成页数, 总页数)
 */
export async function renderPDFPagesToZip(
  file: File,
  pageIndices: number[],
  options: PdfImageRenderOptions,
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  if (pageIndices.length === 0) {
    throw new Error('请至少选择一页进行导出。');
  }

  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const zip = new JSZip();
  const baseName = getBaseName(file.name);
  const extension = FILE_EXTENSIONS[options.format];

  try {
    for (let i = 0; i < pageIndices.length; i++) {
      const pageIndex = pageIndices[i];
      const canvas = await renderPageToCanvas(pdf, pageIndex + 1, options.dpi);
      const blob = await canvasToBlob(
        canvas,
        MIME_TYPES[options.format],
        options.quality
      );

      zip.file(`${baseName}_page_${pageIndex + 1}.${extension}`, blob);

      canvas.width = 0;
      canvas.height = 0;
      onProgress?.(i + 1, pageIndices.length);
    }

    return await zip.generateAsync({ type: 'blob' });
  } finally {
    await loadingTask.destroy();
  }
}
