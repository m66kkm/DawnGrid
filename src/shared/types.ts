export interface WorkbookMetadata {
  sessionId: string;
  name: string;
  entryCount: number;
  sheets: SheetMetadata[];
  activeTab: number;
  styles: CellStyle[];
  dxfStyles: CellStyle[];
  themeColors?: string[];
  date1904: boolean;
  shortDateFormat?: string;
  visuals?: any[];
}

export interface SheetMetadata {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columnWidths: ColumnWidth[];
  defaultRowHeight?: number | null;
  defaultColumnWidth?: number | null;
  freeze?: {
    frozenColumns: number;
    frozenRows: number;
  } | null;
  hidden: boolean;
  tabColor?: string | null;
  showGridLines: boolean;
  showFormulas: boolean;
  rightToLeft: boolean;
}

export interface ColumnWidth {
  startColumn: number;
  endColumn: number;
  width?: number;
  hidden: boolean;
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fillColor?: string;
  numberFormat?: string;
  horizontalAlignment?: string;
  verticalAlignment?: string;
  wrapText?: boolean;
}

export interface RangeResult {
  cells: CellRecord[];
  rows: RowProperty[];
  merges: MergedRange[];
  indexingComplete: boolean;
}

export interface CellRecord {
  row: number;
  column: number;
  value?: string | number | boolean | null;
  formula?: string;
  styleIndex?: number;
}

export interface RowProperty {
  row: number;
  height?: number;
  hidden: boolean;
}

export interface MergedRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}
