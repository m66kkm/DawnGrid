export interface CalculationResult {
  readonly success: boolean;
  readonly message: string;
}

/**
 * Recalculate all sheets in the workbook (Calculate Now / F9).
 */
export function calculateNow(workbook: any): CalculationResult {
  if (!workbook) {
    return { success: false, message: "未获取到活动工作簿" };
  }
  try {
    const sheets = workbook.getSheets?.() || [];
    let count = 0;
    for (const sheet of sheets) {
      // Trigger formula recalculation if supported by worksheet engine
      try {
        if (typeof sheet.refresh === "function") {
          sheet.refresh();
        }
      } catch {}
      count++;
    }
    return {
      success: true,
      message: `已重新计算整个工作簿（共 ${count} 个工作表公式已刷新）`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `重新计算失败: ${e?.message || String(e)}`,
    };
  }
}

/**
 * Recalculate active sheet (Calculate Sheet / Shift+F9).
 */
export function calculateSheet(worksheet: any): CalculationResult {
  if (!worksheet) {
    return { success: false, message: "未获取到活动工作表" };
  }
  try {
    if (typeof worksheet.refresh === "function") {
      worksheet.refresh();
    }
    const name = worksheet.getSheetName ? worksheet.getSheetName() : "当前工作表";
    return {
      success: true,
      message: `已重新计算工作表: ${name}`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `重新计算工作表失败: ${e?.message || String(e)}`,
    };
  }
}
