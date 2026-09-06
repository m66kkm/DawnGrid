import { FormulaErrorItem, PrecedentResult, DependentResult, parseA1Notation } from "./types";

// Memory of highlighted audit cells to restore cleanly upon "移去追踪箭头"
interface SavedCellState {
  row: number;
  col: number;
  bg?: string | null;
}

let savedHighlightedCells: SavedCellState[] = [];

/**
 * Extracts cell and range references from a formula string.
 * Examples matched: A1, $A$1, B2:D10, Sheet1!A1:B5
 */
export function extractCellReferencesFromFormula(formula: string): string[] {
  if (!formula) return [];
  // Remove string literals like "hello"
  const clean = formula.replace(/"[^"]*"/g, "");
  const pattern = /(?:(?:[A-Za-z0-9_\u4e00-\u9fa5]+|'[^']+')!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(clean)) !== null) {
    const full = match[0];
    // Exclude uppercase function names followed by (
    if (formula.slice(match.index + full.length).trim().startsWith("(")) {
      continue;
    }
    if (!results.includes(full)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Trace Precedents: analyzes the active cell's formula, finds referenced cells,
 * and visually highlights them.
 */
export function tracePrecedents(worksheet: any, range: any): PrecedentResult {
  if (!worksheet || !range) {
    return {
      sourceAddress: "",
      formula: "",
      precedentAddresses: [],
      message: "未获取到活动工作表或单元格区域",
    };
  }

  const formula = range.getFormula?.() || "";
  const sourceAddr = range.getA1Notation?.() || "A1";

  if (!formula || !formula.startsWith("=")) {
    return {
      sourceAddress: sourceAddr,
      formula: "",
      precedentAddresses: [],
      message: `追踪引用：单元格 ${sourceAddr} 未包含公式（当前为静态值），无前置引用。`,
    };
  }

  clearAuditHighlights(worksheet);

  const refs = extractCellReferencesFromFormula(formula);
  if (refs.length === 0) {
    return {
      sourceAddress: sourceAddr,
      formula,
      precedentAddresses: [],
      message: `追踪引用：公式 ${formula} 未包含对其他单元格的显式引用。`,
    };
  }

  // Highlight precedent cells
  for (const ref of refs) {
    // Handle single cell or range
    const cleanRef = ref.includes("!") ? ref.split("!")[1] : ref;
    const parts = cleanRef.split(":");
    if (parts.length === 1) {
      const pos = parseA1Notation(parts[0]);
      if (pos) {
        const cell = worksheet.getRange(pos.row, pos.col, 1, 1);
        const oldBg = cell.getBackground?.();
        savedHighlightedCells.push({ row: pos.row, col: pos.col, bg: oldBg });
        cell.setBackground("#dbeafe"); // Soft sky blue
      }
    } else if (parts.length === 2) {
      const pos1 = parseA1Notation(parts[0]);
      const pos2 = parseA1Notation(parts[1]);
      if (pos1 && pos2) {
        const minR = Math.min(pos1.row, pos2.row);
        const maxR = Math.max(pos1.row, pos2.row);
        const minC = Math.min(pos1.col, pos2.col);
        const maxC = Math.max(pos1.col, pos2.col);
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const cell = worksheet.getRange(r, c, 1, 1);
            const oldBg = cell.getBackground?.();
            savedHighlightedCells.push({ row: r, col: c, bg: oldBg });
            cell.setBackground("#dbeafe");
          }
        }
      }
    }
  }

  return {
    sourceAddress: sourceAddr,
    formula,
    precedentAddresses: refs,
    message: `追踪引用：${sourceAddr} [${formula}] 引用了: ${refs.join(", ")} (已高亮标注)`,
  };
}

/**
 * Trace Dependents: scans the worksheet to find all formulas that reference the active cell.
 */
export function traceDependents(worksheet: any, range: any): DependentResult {
  if (!worksheet || !range) {
    return {
      sourceAddress: "",
      dependentAddresses: [],
      message: "未获取到活动工作表或单元格区域",
    };
  }

  const sourceAddr = range.getA1Notation?.() || "A1";
  const sourcePos = parseA1Notation(sourceAddr);
  if (!sourcePos) {
    return {
      sourceAddress: sourceAddr,
      dependentAddresses: [],
      message: `无法解析当前单元格地址: ${sourceAddr}`,
    };
  }

  clearAuditHighlights(worksheet);

  const dependentAddrs: string[] = [];
  const maxR = Math.min(60, worksheet.getMaxRows?.() || 50);
  const maxC = Math.min(26, worksheet.getMaxColumns?.() || 20);

  for (let r = 0; r < maxR; r++) {
    for (let c = 0; c < maxC; c++) {
      if (r === sourcePos.row && c === sourcePos.col) continue;
      const cell = worksheet.getRange(r, c, 1, 1);
      const formula = cell.getFormula?.();
      if (formula && formula.startsWith("=")) {
        const refs = extractCellReferencesFromFormula(formula);
        let referencesSource = false;
        for (const ref of refs) {
          const cleanRef = ref.includes("!") ? ref.split("!")[1] : ref;
          const parts = cleanRef.split(":");
          if (parts.length === 1) {
            const p = parseA1Notation(parts[0]);
            if (p && p.row === sourcePos.row && p.col === sourcePos.col) {
              referencesSource = true;
              break;
            }
          } else if (parts.length === 2) {
            const p1 = parseA1Notation(parts[0]);
            const p2 = parseA1Notation(parts[1]);
            if (p1 && p2) {
              const minR = Math.min(p1.row, p2.row);
              const maxR = Math.max(p1.row, p2.row);
              const minC = Math.min(p1.col, p2.col);
              const maxC = Math.max(p1.col, p2.col);
              if (
                sourcePos.row >= minR &&
                sourcePos.row <= maxR &&
                sourcePos.col >= minC &&
                sourcePos.col <= maxC
              ) {
                referencesSource = true;
                break;
              }
            }
          }
        }

        if (referencesSource) {
          const addr = cell.getA1Notation?.() || `R${r + 1}C${c + 1}`;
          dependentAddrs.push(addr);
          const oldBg = cell.getBackground?.();
          savedHighlightedCells.push({ row: r, col: c, bg: oldBg });
          cell.setBackground("#dcfce7"); // Soft green
        }
      }
    }
  }

  if (dependentAddrs.length === 0) {
    return {
      sourceAddress: sourceAddr,
      dependentAddresses: [],
      message: `追踪从属：未发现引用单元格 ${sourceAddr} 的公式。`,
    };
  }

  return {
    sourceAddress: sourceAddr,
    dependentAddresses: dependentAddrs,
    message: `追踪从属：单元格 ${sourceAddr} 被以下单元格引用: ${dependentAddrs.join(", ")} (已高亮标注)`,
  };
}

/**
 * Remove Arrows / Clear Highlights: restores all cells highlighted by auditing.
 */
export function clearAuditHighlights(worksheet: any): void {
  if (!worksheet || savedHighlightedCells.length === 0) return;
  for (const item of savedHighlightedCells) {
    try {
      worksheet.getRange(item.row, item.col, 1, 1).setBackground(item.bg || null);
    } catch {}
  }
  savedHighlightedCells = [];
}

/**
 * Error Checking: scans the worksheet for formula calculation errors and returns diagnostic advice.
 */
export function checkFormulaErrors(worksheet: any): {
  readonly errors: FormulaErrorItem[];
  readonly message: string;
} {
  if (!worksheet) {
    return { errors: [], message: "未获取到活动工作表" };
  }

  const errors: FormulaErrorItem[] = [];
  const maxR = Math.min(80, worksheet.getMaxRows?.() || 60);
  const maxC = Math.min(30, worksheet.getMaxColumns?.() || 26);

  const errorSpecs: Record<string, { desc: string; fix: string }> = {
    "#DIV/0!": {
      desc: "除零错误：公式中除数为 0 或引用了空单元格。",
      fix: "请使用 IF 或 IFERROR 判断除数是否为 0，例如 =IF(B1=0, 0, A1/B1)。",
    },
    "#REF!": {
      desc: "无效单元格引用：公式引用的单元格已被删除或超出边界。",
      fix: "请检查公式中的单元格引用地址，重新选择有效数据源。",
    },
    "#VALUE!": {
      desc: "数据类型错误：数学运算符操作了文本或非数值内容。",
      fix: "请确保参与运算的单元格均为数值格式，或使用 VALUE() 转换。",
    },
    "#N/A": {
      desc: "未找到值：查找函数（VLOOKUP、MATCH 等）未匹配到结果。",
      fix: "请检查查找值和数据表首列是否匹配，或使用 IFERROR 包裹备用值。",
    },
    "#NAME?": {
      desc: "未识别名称：函数名称拼写错误或引用了未定义的名称。",
      fix: "请检查函数名称拼写是否正确，或在名称管理器中确认该名称已存在。",
    },
    "#NUM!": {
      desc: "无效数值：公式参数超出了数学允许的定义域（如负数开平方根）。",
      fix: "请检查函数输入参数是否处于合法数学区间。",
    },
    "#NULL!": {
      desc: "交叉运算符错误：两个区域未产生交集。",
      fix: "请检查区域分隔符，区域求并应使用逗号分隔而不是空格。",
    },
  };

  for (let r = 0; r < maxR; r++) {
    for (let c = 0; c < maxC; c++) {
      const cell = worksheet.getRange(r, c, 1, 1);
      const valStr = String(cell.getValue?.() ?? "");
      for (const [errTag, info] of Object.entries(errorSpecs)) {
        if (valStr.includes(errTag)) {
          const addr = cell.getA1Notation?.() || `R${r + 1}C${c + 1}`;
          const rawFormula = cell.getFormula?.() || "";
          errors.push({
            cellAddress: addr,
            row: r,
            col: c,
            errorType: errTag,
            rawFormula,
            description: info.desc,
            fixTip: info.fix,
          });
          break;
        }
      }
    }
  }

  if (errors.length === 0) {
    return {
      errors: [],
      message: "错误检查完成：当前工作表中未检测到任何公式计算错误。",
    };
  }

  // Activate the first error cell to guide the user
  const first = errors[0];
  try {
    worksheet.getRange(first.row, first.col, 1, 1).activate();
  } catch {}

  return {
    errors,
    message: `错误检查：在 ${first.cellAddress} 发现 ${first.errorType} 错误（共 ${errors.length} 处错误）。建议：${first.fixTip}`,
  };
}
