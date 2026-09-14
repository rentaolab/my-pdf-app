import { PDFDocument } from 'pdf-lib';

/**
 * 剔除指定的页码，将剩余页面合并导出为新的 PDF
 * @param file 源 PDF 文件
 * @param deletedPageIndices 需要删除的页码索引数组 (从 0 开始)
 */
export async function removePDFPages(
  file: File,
  deletedPageIndices: number[]
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = srcPdfDoc.getPageCount();

  // 创建全新的目标 PDF
  const outputPdfDoc = await PDFDocument.create();

  // 筛选出需要【保留】的页码索引
  const deletedSet = new Set(deletedPageIndices);
  const keepIndices: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    if (!deletedSet.has(i)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('无法导出空的 PDF 文档，请至少保留一页。');
  }

  // 从源文档批量复制保留的页面
  const copiedPages = await outputPdfDoc.copyPages(srcPdfDoc, keepIndices);
  copiedPages.forEach((page) => outputPdfDoc.addPage(page));

  return await outputPdfDoc.save();
}