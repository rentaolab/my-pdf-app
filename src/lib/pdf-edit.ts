import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 PDF.js Worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * 渲染 PDF 页面为图片 DataURL 列表（用于网格预览）
 */
export async function renderPDFToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imageUrls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // 将 scale 从 0.3 提升到 0.8，保证原位放大和右侧栏预览时依然清晰且无需二次加载
    const viewport = page.getViewport({ scale: 0.8 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      imageUrls.push(canvas.toDataURL('image/png'));
    }
  }

  return imageUrls;
}
/**
 * 自由处理页面：挑选指定页导出、应用旋转
 */
export async function processPDFPages(
  file: File,
  pageIndices: number[],
  rotations: { [key: number]: number } = {}
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);

  copiedPages.forEach((page, idx) => {
    const originalPageIndex = pageIndices[idx];
    const rotationAngle = rotations[originalPageIndex] || 0;
    
    if (rotationAngle !== 0) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotationAngle) % 360));
    }
    
    newPdf.addPage(page);
  });

  return await newPdf.save();
}

/**
 * 按需渲染单个 PDF 页面为高分辨率图片 (用于大图预览)
 */
export async function renderSinglePDFPageHighRes(
  file: File,
  pageIndex: number
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageIndex + 1); // pdf.js 页面从 1 开始

  // 1.5 到 2.0 倍率在手机和电脑上显示都非常清晰
  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (context) {
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    return canvas.toDataURL('image/png');
  }

  throw new Error('Canvas context not available');
}