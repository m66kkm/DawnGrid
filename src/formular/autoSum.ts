import { getColumnName } from "./types";

export interface AutoSumResult {
  readonly success: boolean;
  readonly fn: string;
  readonly formula: string;
  readonly targetAddress: string;
  readonly message: string;
}

/**
 * Intelligent AutoSum implementation matching Excel behavior:
 * 1. Multi-row selection: sums each column and writes formula to the bottom.
 * 2. Multi-column single-row selection: sums horizontally and writes to the right.
 * 3. Single cell selection: scans vertically upwards for numeric data; if none,
 *    scans horizontally to the left; if none, inserts standard formula.
 */
export function applyAutoSum(
  worksheet: any,
  range: any,
  fnName: string = "SUM"
): AutoSumResult {
  if (!worksheet || !range) {
    return {
      success: false,
      fn: fnName,
      formula: "",
      targetAddress: "",
      message: "未获取到活动工作表或单元格区域",
    };
  }

  const fn = fnName.trim().toUpperCase() || "SUM";
  const startRow = range.getRow();
  const startCol = range.getColumn();
  const height = range.getHeight();
  const width = range.getWidth();
  const lastRow = startRow + height - 1;
  const lastCol = startCol + width - 1;

  // Case 1: Multi-row selection (height >= 2)
  if (height >= 2) {
    // Check if the last row of the selection is completely blank
    let lastRowBlank = true;
    for (let c = startCol; c <= lastCol; c++) {
      const val = worksheet.getRange(lastRow, c, 1, 1).getValue();
      if (val != null && String(val).trim() !== "") {
        lastRowBlank = false;
        break;
      }
    }

    const dataStartRow = startRow;
    const dataEndRow = lastRowBlank ? lastRow - 1 : lastRow;
    const targetRow = lastRowBlank ? lastRow : lastRow + 1;

    let appliedFormula = "";
    for (let c = startCol; c <= lastCol; c++) {
      const letter = getColumnName(c);
      const formula = `=${fn}(${letter}${dataStartRow + 1}:${letter}${dataEndRow + 1})`;
      worksheet.getRange(targetRow, c, 1, 1).setFormula(formula);
      if (!appliedFormula) appliedFormula = formula;
    }

    try {
      worksheet.getRange(targetRow, startCol, 1, width).activate();
    } catch {}

    const targetAddr = `${getColumnName(startCol)}${targetRow + 1}${
      width > 1 ? `:${getColumnName(lastCol)}${targetRow + 1}` : ""
    }`;

    return {
      success: true,
      fn,
      formula: appliedFormula,
      targetAddress: targetAddr,
      message: `已自动生成 ${fn} 公式: ${appliedFormula} (目标: ${targetAddr})`,
    };
  }

  // Case 2: Horizontal multi-column selection (height === 1 && width >= 2)
  if (height === 1 && width >= 2) {
    const endVal = worksheet.getRange(startRow, lastCol, 1, 1).getValue();
    const lastColBlank = endVal == null || String(endVal).trim() === "";

    const dataStartCol = startCol;
    const dataEndCol = lastColBlank ? lastCol - 1 : lastCol;
    const targetCol = lastColBlank ? lastCol : lastCol + 1;

    const startLetter = getColumnName(dataStartCol);
    const endLetter = getColumnName(dataEndCol);
    const formula = `=${fn}(${startLetter}${startRow + 1}:${endLetter}${startRow + 1})`;

    worksheet.getRange(startRow, targetCol, 1, 1).setFormula(formula);

    try {
      worksheet.getRange(startRow, targetCol, 1, 1).activate();
    } catch {}

    const targetAddr = `${getColumnName(targetCol)}${startRow + 1}`;
    return {
      success: true,
      fn,
      formula,
      targetAddress: targetAddr,
      message: `已自动生成 ${fn} 公式: ${formula} (目标: ${targetAddr})`,
    };
  }

  // Case 3: Single cell selected (height === 1 && width === 1)
  const r = startRow;
  const c = startCol;
  const curColLetter = getColumnName(c);

  // 1) Scan vertically upwards from r - 1
  let topScanRow = r - 1;
  while (topScanRow >= 0) {
    const val = worksheet.getRange(topScanRow, c, 1, 1).getValue();
    if (val == null || String(val).trim() === "") {
      break;
    }
    topScanRow--;
  }
  const upwardDataStartRow = topScanRow + 1;

  if (upwardDataStartRow <= r - 1 && r > 0) {
    // Found consecutive non-empty cells above
    const formula = `=${fn}(${curColLetter}${upwardDataStartRow + 1}:${curColLetter}${r})`;
    worksheet.getRange(r, c, 1, 1).setFormula(formula);
    const targetAddr = `${curColLetter}${r + 1}`;
    return {
      success: true,
      fn,
      formula,
      targetAddress: targetAddr,
      message: `已自动求和上方区域: ${formula} (目标: ${targetAddr})`,
    };
  }

  // 2) Scan horizontally to the left from c - 1
  let leftScanCol = c - 1;
  while (leftScanCol >= 0) {
    const val = worksheet.getRange(r, leftScanCol, 1, 1).getValue();
    if (val == null || String(val).trim() === "") {
      break;
    }
    leftScanCol--;
  }
  const leftDataStartCol = leftScanCol + 1;

  if (leftDataStartCol <= c - 1 && c > 0) {
    // Found consecutive non-empty cells to the left
    const leftStartLetter = getColumnName(leftDataStartCol);
    const leftEndLetter = getColumnName(c - 1);
    const formula = `=${fn}(${leftStartLetter}${r + 1}:${leftEndLetter}${r + 1})`;
    worksheet.getRange(r, c, 1, 1).setFormula(formula);
    const targetAddr = `${curColLetter}${r + 1}`;
    return {
      success: true,
      fn,
      formula,
      targetAddress: targetAddr,
      message: `已自动求和左侧区域: ${formula} (目标: ${targetAddr})`,
    };
  }

  // 3) Neither above nor left has non-empty contiguous cells: insert default reference
  const defaultStartRow = r > 0 ? 1 : 1;
  const defaultEndRow = Math.max(1, r);
  const defaultFormula =
    r === 0
      ? `=${fn}()`
      : `=${fn}(${curColLetter}${defaultStartRow}:${curColLetter}${defaultEndRow})`;

  worksheet.getRange(r, c, 1, 1).setFormula(defaultFormula);
  const targetAddr = `${curColLetter}${r + 1}`;
  return {
    success: true,
    fn,
    formula: defaultFormula,
    targetAddress: targetAddr,
    message: `已插入公式: ${defaultFormula} (目标: ${targetAddr})`,
  };
}
