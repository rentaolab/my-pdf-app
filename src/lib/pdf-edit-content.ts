import { PDFDocument } from 'pdf-lib';

export interface FabricCanvasJSON {
  version: string;
  objects: any[];
  pageSize?: { width: number; height: number };
  canvasDataUrl?: string; // 页面专属透明 PNG 蒙版 (Base64)
}

/**
 * 💡 精准适配 CropBox 裁切框的透明 PNG 蒙版烘焙引擎
 */
export async function bakeEditsToPDF(
  file: File,
  pageFabricMap: { [pageIndex: number]: FabricCanvasJSON }
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (let idx = 0; idx < pages.length; idx++) {
    const pageJson = pageFabricMap[idx];
    if (!pageJson || !pageJson.canvasDataUrl) continue;

    const page = pages[idx];

    // 💡 1. 提取 CropBox (裁切框) 的精准几何边界
    // 如果没有明确定义 CropBox，则退回到 MediaBox
    const cropBox = page.getCropBox() || page.getMediaBox();
    
    // 提取裁切框的绝对坐标与尺寸
    const cropX = cropBox.x;
    const cropY = cropBox.y;
    const cropWidth = cropBox.width;
    const cropHeight = cropBox.height;

    // 💡 2. 将透明蒙版图层精确覆盖在 CropBox 范围内，解决裁剪页定位偏移问题
    try {
      const overlayImg = await pdfDoc.embedPng(pageJson.canvasDataUrl);

      page.drawImage(overlayImg, {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      });
    } catch (e) {
      console.error(`P.${idx + 1} 嵌入透明蒙版图层失败:`, e);
    }
  }

  return await pdfDoc.save();
}