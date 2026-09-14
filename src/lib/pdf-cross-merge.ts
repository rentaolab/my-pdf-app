import { PDFDocument, degrees } from 'pdf-lib';

export interface SelectedPageItem {
  id: string; // 唯一标识符 (例如: 'file-0-page-2-1710000000')
  fileIndex: number; // 属于哪个源文件
  originalPageIndex: number; // 源文件中的原始页码 (0-based)
  rotation: number; // 该页施加的旋转角度 (0, 90, 180, 270)
  thumbnailSrc: string; // 缩略图 DataURL (用于暂存篮展示)
  fileName: string; // 源文件名
}

/**
 * 交叉提取并合并来自不同 PDF 文件的指定页面
 * @param sourceFiles 用户上传的全部源 File 数组
 * @param selectedItems 暂存篮中已排好序的页面卡片数组
 * @returns 最终合成的 PDF Uint8Array 字节流
 */
export async function crossMergePDFPages(
  files: File[],
  basketItems: SelectedPageItem[]
): Promise<Uint8Array> {
  // 1. 创建全新的 PDF 文档
  const mergedPdf = await PDFDocument.create();

  // 2. 缓存已加载过的 PDFDocument，避免重复解析同一个大文件
  const pdfDocCache: { [fileIndex: number]: PDFDocument } = {};

  for (const item of basketItems) {
    // 💡 修复关键点：判断是否为插入的空白页 (fileIndex === -1 或 originalPageIndex === -1)
    if (item.fileIndex === -1 || item.originalPageIndex === -1) {
      // 直接添加一张 A4 尺寸的空白页 (595.28 x 841.89 pt)
      const blankPage = mergedPdf.addPage([595.28, 841.89]);
      
      // 如果空白页也有旋转角度，进行旋转
      if (item.rotation) {
        blankPage.setRotation(degrees(item.rotation));
      }
      continue; // 跳过后续的源文件提取逻辑
    }

    // 校验源文件是否存在，防止越界访问
    const sourceFile = files[item.fileIndex];
    if (!sourceFile) {
      console.warn(`未找到索引为 ${item.fileIndex} 的源文件`);
      continue;
    }

    // 3. 延迟加载并缓存源 PDF 文件
    if (!pdfDocCache[item.fileIndex]) {
      const arrayBuffer = await sourceFile.arrayBuffer(); // 👈 之前错误发生在这里
      pdfDocCache[item.fileIndex] = await PDFDocument.load(arrayBuffer);
    }

    const srcPdfDoc = pdfDocCache[item.fileIndex];

    // 4. 从源文档复制指定页码
    const [copiedPage] = await mergedPdf.copyPages(srcPdfDoc, [
      item.originalPageIndex,
    ]);

    // 5. 应用累加旋转角度
    if (item.rotation) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
    }

    // 6. 将页面加入合成文档
    mergedPdf.addPage(copiedPage);
  }

  // 7. 导出字节数组
  return await mergedPdf.save();
}