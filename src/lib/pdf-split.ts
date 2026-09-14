import { PDFDocument } from 'pdf-lib';

/**
 * 根据拆分断点数组，将单个 PDF 切分为多个独立的 PDF 字节数据
 * @param file 原始 PDF 文件
 * @param splitPoints 拆分断点索引数组（例如：在第 2 页后切开，传入 [1]）
 * @returns 拆分后的 PDF Uint8Array 数组
 */
export async function splitPDFByPoints(
  file: File,
  splitPoints: number[]
): Promise<Uint8Array[]> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = srcDoc.getPageCount();

  // 排序并过滤掉无效的切分点
  const validPoints = Array.from(
    new Set(splitPoints.filter((p) => p >= 0 && p < totalPages - 1))
  ).sort((a, b) => a - b);

  // 计算每一个切分区间 [start, end]
  const ranges: { start: number; end: number }[] = [];
  let currentStart = 0;

  for (const point of validPoints) {
    ranges.push({ start: currentStart, end: point });
    currentStart = point + 1;
  }
  ranges.push({ start: currentStart, end: totalPages - 1 });

  // 根据区间生成多个新的 PDF 文档
  const resultPdfs: Uint8Array[] = [];

  for (const range of ranges) {
    const newDoc = await PDFDocument.create();
    const pageIndices: number[] = [];
    for (let i = range.start; i <= range.end; i++) {
      pageIndices.push(i);
    }
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));
    
    const pdfBytes = await newDoc.save();
    resultPdfs.push(pdfBytes);
  }

  return resultPdfs;
}