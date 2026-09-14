import { PDFDocument, degrees } from 'pdf-lib';

export interface PageTransformState {
  rotation: number;     // 旋转角度: 0, 90, 180, 270
  flipH: boolean;       // 水平镜像
  flipV: boolean;       // 垂直镜像
}

/**
 * 批量对 PDF 的指定页面进行旋转与水平/垂直镜像变换
 */
export async function processPDFTransformations(
  file: File,
  transforms: { [pageIndex: number]: PageTransformState }
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  pages.forEach((page, index) => {
    const transform = transforms[index];
    if (!transform) return;

    const { rotation, flipH, flipV } = transform;

    // 1. 应用旋转角度
    if (rotation !== 0) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotation) % 360));
    }

    // 2. 应用水平 / 垂直镜像翻转
    if (flipH || flipV) {
      const { width, height } = page.getSize();
      
      // 使用 scale 改变坐标轴方向
      page.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      
      // 💡 修复关键点：使用 moveTo 修正因轴反转而移出视口的原点
      page.moveTo(
        flipH ? -width : 0,
        flipV ? -height : 0
      );
    }
  });

  return await pdfDoc.save();
}