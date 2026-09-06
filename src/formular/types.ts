export interface FunctionSpec {
  readonly name: string;
  readonly category: string;
  readonly syntax: string;
  readonly desc: string;
  readonly isCommon?: boolean;
}

export interface DefinedNameRow {
  name: string;
  ref: string;
  scope: string;
  scopeSheetId?: string | null;
}

export interface WatchCellItem {
  id: string;
  workbookName: string;
  sheetName: string;
  cellAddress: string;
  value: any;
  formula: string;
}

export type AutoFnType = "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN";

export interface FormulaErrorItem {
  cellAddress: string;
  row: number;
  col: number;
  errorType: string;
  rawFormula: string;
  description: string;
  fixTip: string;
}

export interface PrecedentResult {
  sourceAddress: string;
  formula: string;
  precedentAddresses: string[];
  message: string;
}

export interface DependentResult {
  sourceAddress: string;
  dependentAddresses: string[];
  message: string;
}

export function getColumnName(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function parseColumnName(colName: string): number {
  let col = 0;
  const upper = colName.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function parseA1Notation(a1: string): { row: number; col: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(a1.trim());
  if (!match) return null;
  return {
    col: parseColumnName(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}
