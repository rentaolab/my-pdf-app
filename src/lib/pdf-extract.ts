import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * 模式 A：将提取的多个页面合并导出为一个全新的 PDF
 */
export async function extractPagesToMergedPDF(
  file: File,
  selectedPageIndices: number[]
): Promise<Uint8Array> {
  if (selectedPageIndices.length === 0) {
    throw new Error('请至少选择一个需要提取的页面。');
  }

  const arrayBuffer = await file.arrayBuffer();
  const srcPdfDoc = await PDFDocument.load(arrayBuffer);
  const outputPdfDoc = await PDFDocument.create();

  // 复制并添加选中的页面
  const copiedPages = await outputPdfDoc.copyPages(srcPdfDoc, selectedPageIndices);
  copiedPages.forEach((page) => outputPdfDoc.addPage(page));

  return await outputPdfDoc.save();
}

/**
 * 模式 B：将提取的页面按单页拆分，打包生成 ZIP 压缩包下载
 */
export async function extractPagesToZip(
  file: File,
  selectedPageIndices: number[]
): Promise<Blob> {
  if (selectedPageIndices.length === 0) {
    throw new Error('请至少选择一个需要提取的页面。');
  }

  const arrayBuffer = await file.arrayBuffer();
  const srcPdfDoc = await PDFDocument.load(arrayBuffer);
  const zip = new JSZip();
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (const pageIndex of selectedPageIndices) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcPdfDoc, [pageIndex]);
    singleDoc.addPage(copiedPage);

    const pdfBytes = await singleDoc.save();
    // 放入 Zip 档案，名称格式如：Document_page_1.pdf
    zip.file(`${baseName}_page_${pageIndex + 1}.pdf`, pdfBytes);
  }

  return await zip.generateAsync({ type: 'blob' });
}