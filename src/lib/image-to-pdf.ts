import { PDFDocument, type PDFImage } from 'pdf-lib';

/** 目标纸张：fit = 贴合图片尺寸，a4 / letter = 标准纸张 */
export type PdfPageSize = 'fit' | 'a4' | 'letter';

/** 页面方向：auto = 根据图片横竖自动判断 */
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export interface ImageToPdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  /** 页边距，单位 pt（1 pt = 1/72 inch） */
  margin: number;
}

/** 常用纸张尺寸（单位：pt） */
const PAGE_SIZES: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** fit 模式下页面最长边的上限（等同于 A4 长边），避免超大图片生成巨型页面 */
const MAX_FIT_EDGE = 841.89;

/** 支持的文件类型判断 */
export function isSupportedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  return (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  );
}

/** 加载图片为 HTMLImageElement（WebP 等格式先转成 canvas 可绘制的位图） */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取该图片文件。'));
    image.src = url;
  });
}

/** 将浏览器可解码、但 pdf-lib 不支持的图片（如 WebP）转换为 PNG 字节 */
async function convertImageToPngBytes(file: File): Promise<Uint8Array> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error('该图片没有有效的尺寸信息。');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('当前环境不支持 Canvas 2D。');
    }
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) {
      throw new Error('无法将图片转换为 PNG。');
    }

    canvas.width = 0;
    canvas.height = 0;

    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 将图片嵌入 PDF。
 * pdf-lib 原生只支持 PNG / JPEG，其余格式（WebP）先在 canvas 中转换为 PNG。
 */
async function embedImage(
  pdfDoc: PDFDocument,
  file: File
): Promise<PDFImage> {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  const looksLikePng = type === 'image/png' || name.endsWith('.png');
  const looksLikeJpeg =
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg');

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (looksLikePng) {
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      // 扩展名与实际内容不符时，回退到 canvas 转换
    }
  } else if (looksLikeJpeg) {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      // 同上
    }
  }

  return await pdfDoc.embedPng(await convertImageToPngBytes(file));
}

interface ImagePlacement {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 根据纸张、方向与页边距计算图片在页面中的位置与缩放 */
function computePlacement(
  imageWidth: number,
  imageHeight: number,
  options: ImageToPdfOptions
): ImagePlacement {
  const margin = Math.max(0, options.margin);

  if (options.pageSize === 'fit') {
    // 贴合图片：1px 按 1pt 处理，超大图片按 A4 长边等比缩小
    const longestEdge = Math.max(imageWidth, imageHeight);
    const shrink = longestEdge > MAX_FIT_EDGE ? MAX_FIT_EDGE / longestEdge : 1;
    const width = imageWidth * shrink;
    const height = imageHeight * shrink;

    return {
      pageWidth: width + margin * 2,
      pageHeight: height + margin * 2,
      x: margin,
      y: margin,
      width,
      height,
    };
  }

  const [baseWidth, baseHeight] = PAGE_SIZES[options.pageSize];
  const isLandscape =
    options.orientation === 'landscape' ||
    (options.orientation === 'auto' && imageWidth > imageHeight);

  const pageWidth = isLandscape ? baseHeight : baseWidth;
  const pageHeight = isLandscape ? baseWidth : baseHeight;

  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(
    availableWidth / imageWidth,
    availableHeight / imageHeight
  );

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

/**
 * 将多张图片按给定顺序合成为一个标准 PDF（浏览器端零上传）
 * @param files 已排序的图片文件列表
 * @param options 纸张 / 方向 / 页边距设置
 */
export async function imagesToPDF(
  files: File[],
  options: ImageToPdfOptions
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('请至少上传一张图片。');
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer('Reeff.PDF');
  pdfDoc.setCreator('Reeff.PDF');

  for (const file of files) {
    const image = await embedImage(pdfDoc, file);
    const placement = computePlacement(image.width, image.height, options);
    const page = pdfDoc.addPage([placement.pageWidth, placement.pageHeight]);

    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
  }

  return await pdfDoc.save();
}
