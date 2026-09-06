import { DefinedNameRow, getColumnName } from "./types";

export interface CreateNamesResult {
  readonly success: boolean;
  readonly createdCount: number;
  readonly createdNames: string[];
  readonly updatedList: DefinedNameRow[];
  readonly message: string;
}

/**
 * Creates defined names from selection, mirroring Excel's "Create from Selection".
 * - "top": Header is on the first row of selection; data is the column beneath.
 * - "left": Header is on the leftmost column of selection; data is the row to the right.
 */
export function createNamesFromSelection(
  worksheet: any,
  range: any,
  direction: "top" | "left",
  currentNames: readonly DefinedNameRow[]
): CreateNamesResult {
  if (!worksheet || !range) {
    return {
      success: false,
      createdCount: 0,
      createdNames: [],
      updatedList: [...currentNames],
      message: "未获取到活动工作表或单元格区域",
    };
  }

  const startRow = range.getRow();
  const startCol = range.getColumn();
  const height = range.getHeight();
  const width = range.getWidth();
  const sheetName = worksheet.getSheetName ? worksheet.getSheetName() : "Sheet1";

  if (direction === "top") {
    if (height < 2) {
      return {
        success: false,
        createdCount: 0,
        createdNames: [],
        updatedList: [...currentNames],
        message: "根据顶端行创建名称至少需要选中 2 行（标题行与数据行）",
      };
    }

    const dataStartRow = startRow + 1;
    const dataHeight = height - 1;
    const newItems: DefinedNameRow[] = [];
    const createdNames: string[] = [];

    for (let c = startCol; c < startCol + width; c++) {
      const headerVal = worksheet.getRange(startRow, c, 1, 1).getValue();
      const rawText = String(headerVal ?? "").trim();
      const cleanName = rawText.replace(/[^\p{L}\p{N}_]/gu, "") || `Col_${getColumnName(c)}`;
      const colLetter = getColumnName(c);
      const refStr = `=${sheetName}!$${colLetter}$${dataStartRow + 1}:$${colLetter}$${
        dataStartRow + dataHeight
      }`;

      newItems.push({
        name: cleanName,
        ref: refStr,
        scope: "工作簿",
      });
      createdNames.push(cleanName);
    }

    const existingFiltered = currentNames.filter(
      (item) => !createdNames.includes(item.name)
    );
    const updatedList = [...existingFiltered, ...newItems];

    return {
      success: true,
      createdCount: createdNames.length,
      createdNames,
      updatedList,
      message: `已根据顶端行创建 ${createdNames.length} 个名称: ${createdNames.join(", ")}`,
    };
  } else {
    // direction === "left"
    if (width < 2) {
      return {
        success: false,
        createdCount: 0,
        createdNames: [],
        updatedList: [...currentNames],
        message: "根据最左列创建名称至少需要选中 2 列（名称列与数据列）",
      };
    }

    const dataStartCol = startCol + 1;
    const dataWidth = width - 1;
    const newItems: DefinedNameRow[] = [];
    const createdNames: string[] = [];

    for (let r = startRow; r < startRow + height; r++) {
      const headerVal = worksheet.getRange(r, startCol, 1, 1).getValue();
      const rawText = String(headerVal ?? "").trim();
      const cleanName = rawText.replace(/[^\p{L}\p{N}_]/gu, "") || `Row_${r + 1}`;
      const startLetter = getColumnName(dataStartCol);
      const endLetter = getColumnName(dataStartCol + dataWidth - 1);
      const refStr = `=${sheetName}!$${startLetter}$${r + 1}:$${endLetter}$${r + 1}`;

      newItems.push({
        name: cleanName,
        ref: refStr,
        scope: "工作簿",
      });
      createdNames.push(cleanName);
    }

    const existingFiltered = currentNames.filter(
      (item) => !createdNames.includes(item.name)
    );
    const updatedList = [...existingFiltered, ...newItems];

    return {
      success: true,
      createdCount: createdNames.length,
      createdNames,
      updatedList,
      message: `已根据最左列创建 ${createdNames.length} 个名称: ${createdNames.join(", ")}`,
    };
  }
}

/**
 * Inserts or appends a defined name into the active cell formula.
 */
export function insertDefinedNameIntoFormula(range: any, name: string): string {
  if (!range) return "";
  const curFormula = range.getFormula?.() || "";
  let finalFormula = "";
  if (curFormula && curFormula.startsWith("=")) {
    // If formula is incomplete like `=SUM(` or `=A1+`, append name
    if (/[(=,+\-*/]\s*$/.test(curFormula)) {
      finalFormula = `${curFormula}${name}`;
    } else {
      finalFormula = `${curFormula} + ${name}`;
    }
  } else {
    finalFormula = `=${name}`;
  }
  range.setFormula(finalFormula);
  return finalFormula;
}
