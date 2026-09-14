import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface CropRect {
  x: number;      // 裁剪框左下角 X 坐标 (PDF 坐标系)
  y: number;      // 裁剪框左下角 Y 坐标
  width: number;  // 裁剪框宽度
  height: number; // 裁剪框高度
}

/**
 * 1. 导出为单个合并后的 PDF 文档（应用逐页独立裁剪框）
 */
export async function cropPDFPagesCustom(
  file: File,
  pageCropMap: { [pageIndex: number]: CropRect }
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  pages.forEach((page, idx) => {
    const cropRect = pageCropMap[idx];
    if (cropRect) {
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const safeX = Math.max(0, Math.min(cropRect.x, pageWidth));
      const safeY = Math.max(0, Math.min(cropRect.y, pageHeight));
      const safeWidth = Math.min(cropRect.width, pageWidth - safeX);
      const safeHeight = Math.min(cropRect.height, pageHeight - safeY);

      page.setCropBox(safeX, safeY, safeWidth, safeHeight);
    }
  });

  return await pdfDoc.save();
}

/**
 * 2. 将裁剪后的每个页面独立拆分，打包为 ZIP 压缩包
 */
export async function cropPDFPagesToZip(
  file: File,
  pageCropMap: { [pageIndex: number]: CropRect }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = srcPdfDoc.getPages();
  const zip = new JSZip();
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let idx = 0; idx < pages.length; idx++) {
    const cropRect = pageCropMap[idx];
    if (!cropRect) continue;

    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcPdfDoc, [idx]);
    
    const { width: pageWidth, height: pageHeight } = copiedPage.getSize();
    const safeX = Math.max(0, Math.min(cropRect.x, pageWidth));
    const safeY = Math.max(0, Math.min(cropRect.y, pageHeight));
    const safeWidth = Math.min(cropRect.width, pageWidth - safeX);
    const safeHeight = Math.min(cropRect.height, pageHeight - safeY);

    copiedPage.setCropBox(safeX, safeY, safeWidth, safeHeight);
    singleDoc.addPage(copiedPage);

    const pdfBytes = await singleDoc.save();
    zip.file(`${baseName}_page_${idx + 1}.pdf`, pdfBytes);
  }

  return await zip.generateAsync({ type: 'blob' });
}