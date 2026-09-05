import { invoke } from '@tauri-apps/api/core'
import {
  BooleanNumber,
  CellValueType,
  type ICellData,
  type IStyleData,
} from '@univerjs/core'
import type { UniverRuntime } from './create-univer'
import type { RangeResult, SheetMetadata, WorkbookMetadata } from './types'

export async function openWorkbookFile(path: string): Promise<WorkbookMetadata> {
  return await invoke<WorkbookMetadata>('open_workbook', { path })
}

export async function readWorkbookRange(
  sessionId: string,
  sheetId: string,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
): Promise<RangeResult> {
  return await invoke<RangeResult>('read_range', {
    sessionId,
    sheetId,
    startRow,
    endRow,
    startColumn,
    endColumn,
  })
}

export function loadWorkbookSkeleton(runtime: UniverRuntime, meta: WorkbookMetadata): void {
  const activeWorkbook = runtime.univerAPI.getActiveWorkbook()
  if (activeWorkbook) {
    runtime.univerAPI.disposeUnit(activeWorkbook.getId())
  }

  runtime.univerAPI.createWorkbook({
    id: `wb-${meta.sessionId}`,
    name: meta.name,
    sheetOrder: meta.sheets.map((sheet) => sheet.id),
    sheets: Object.fromEntries(
      meta.sheets.map((sheet) => {
        const columnData: Record<number, { w?: number; hd?: BooleanNumber }> = {}
        for (const col of sheet.columnWidths) {
          const pixelWidth = col.width ? Math.floor(col.width * 8) + 5 : undefined
          for (let c = col.startColumn; c <= col.endColumn; c++) {
            columnData[c] = {
              ...(pixelWidth !== undefined ? { w: pixelWidth } : {}),
              ...(col.hidden ? { hd: BooleanNumber.TRUE } : {}),
            }
          }
        }

        return [
          sheet.id,
          {
            id: sheet.id,
            name: sheet.name,
            rowCount: Math.max(100, sheet.rowCount),
            columnCount: Math.max(30, sheet.columnCount),
            hidden: sheet.hidden ? BooleanNumber.TRUE : BooleanNumber.FALSE,
            showGridlines: sheet.showGridLines ? BooleanNumber.TRUE : BooleanNumber.FALSE,
            ...(sheet.freeze
              ? {
                  freeze: {
                    xSplit: sheet.freeze.frozenColumns,
                    ySplit: sheet.freeze.frozenRows,
                    startRow: sheet.freeze.frozenRows,
                    startColumn: sheet.freeze.frozenColumns,
                  },
                }
              : {}),
            columnData,
            cellData: {},
          },
        ]
      }),
    ),
  })

  // Set active sheet
  const created = runtime.univerAPI.getActiveWorkbook()
  if (created && meta.sheets[meta.activeTab]) {
    const activeSheet = created.getSheetBySheetId(meta.sheets[meta.activeTab].id)
    if (activeSheet) created.setActiveSheet(activeSheet)
  }
}

export async function populateSheetRange(
  runtime: UniverRuntime,
  sessionId: string,
  sheetId: string,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  styles: WorkbookMetadata['styles'],
): Promise<void> {
  const workbook = runtime.univerAPI.getActiveWorkbook()
  if (!workbook) return
  const worksheet = workbook.getSheetBySheetId(sheetId)
  if (!worksheet) return

  if (startRow > endRow || startColumn > endColumn) return

  const result = await readWorkbookRange(
    sessionId,
    sheetId,
    startRow,
    endRow,
    startColumn,
    endColumn,
  )

  const rows = endRow - startRow + 1
  const columns = endColumn - startColumn + 1

  // Ensure worksheet dimensions accommodate the range
  const currentMaxRows = worksheet.getMaxRows()
  const currentMaxCols = worksheet.getMaxColumns()
  if (startRow + rows > currentMaxRows) {
    worksheet.setRowCount(startRow + rows)
  }
  if (startColumn + columns > currentMaxCols) {
    worksheet.setColumnCount(startColumn + columns)
  }

  const matrix: ICellData[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({})),
  )

  for (const cell of result.cells) {
    if (
      cell.row < startRow ||
      cell.row > endRow ||
      cell.column < startColumn ||
      cell.column > endColumn
    ) {
      continue
    }

    const targetRow = matrix[cell.row - startRow]
    if (!targetRow) continue

    const style = cell.styleIndex !== undefined ? styles[cell.styleIndex] : undefined
    const uStyle: IStyleData = {}
    if (style) {
      if (style.bold) uStyle.bl = BooleanNumber.TRUE
      if (style.italic) uStyle.it = BooleanNumber.TRUE
      if (style.underline) uStyle.ul = { s: BooleanNumber.TRUE }
      if (style.strikethrough) uStyle.st = { s: BooleanNumber.TRUE }
      if (style.fontColor) uStyle.cl = { rgb: style.fontColor }
      if (style.fillColor) uStyle.bg = { rgb: style.fillColor }
      if (style.fontSize) uStyle.fs = style.fontSize
      if (style.fontFamily) uStyle.ff = style.fontFamily
      if (style.numberFormat) uStyle.n = { pattern: style.numberFormat }
      if (style.wrapText) uStyle.tb = 3
      if (style.horizontalAlignment) {
        if (style.horizontalAlignment === 'center') uStyle.ht = 2
        else if (style.horizontalAlignment === 'right') uStyle.ht = 3
        else if (style.horizontalAlignment === 'left') uStyle.ht = 1
      }
      if (style.verticalAlignment) {
        if (style.verticalAlignment === 'center') uStyle.vt = 2
        else if (style.verticalAlignment === 'top') uStyle.vt = 1
        else if (style.verticalAlignment === 'bottom') uStyle.vt = 3
      }
    }

    const cellData: ICellData = {
      ...(Object.keys(uStyle).length > 0 ? { s: uStyle } : {}),
    }

    if (cell.formula) {
      cellData.f = cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`
      if (cell.value !== undefined && cell.value !== null) {
        cellData.v = cell.value
        if (typeof cell.value === 'string') cellData.t = CellValueType.STRING
        else if (typeof cell.value === 'number') cellData.t = CellValueType.NUMBER
        else if (typeof cell.value === 'boolean') cellData.t = CellValueType.BOOLEAN
      }
    } else if (cell.value !== undefined && cell.value !== null) {
      cellData.v = cell.value
      if (typeof cell.value === 'string') cellData.t = CellValueType.STRING
      else if (typeof cell.value === 'number') cellData.t = CellValueType.NUMBER
      else if (typeof cell.value === 'boolean') cellData.t = CellValueType.BOOLEAN
    }

    targetRow[cell.column - startColumn] = cellData
  }

  worksheet.getRange(startRow, startColumn, rows, columns).setValues(matrix)

  // Apply row heights if any
  for (const rowProp of result.rows) {
    if (rowProp.height) {
      worksheet.setRowHeights(rowProp.row, 1, Math.round((rowProp.height * 96) / 72))
    }
  }

  // Apply merges
  for (const merge of result.merges) {
    try {
      worksheet
        .getRange(
          merge.startRow,
          merge.startColumn,
          merge.endRow - merge.startRow + 1,
          merge.endColumn - merge.startColumn + 1,
        )
        .merge()
    } catch {
      // ignore merge overlaps
    }
  }
}

export async function loadWorksheetData(
  runtime: UniverRuntime,
  meta: WorkbookMetadata,
  sheet: SheetMetadata,
  loadedSheetIds: Set<string>,
  onStatus?: (text: string) => void,
): Promise<void> {
  if (loadedSheetIds.has(sheet.id)) return
  loadedSheetIds.add(sheet.id)

  if (sheet.rowCount === 0 || sheet.columnCount === 0) return

  onStatus?.(`正在加载工作表: ${sheet.name}...`)

  const totalRows = sheet.rowCount
  const maxCol = sheet.columnCount - 1
  const batchRows = Math.max(10, Math.min(2000, Math.floor(50000 / Math.max(1, sheet.columnCount))))

  for (let r = 0; r < totalRows; r += batchRows) {
    const batchEnd = Math.min(r + batchRows - 1, totalRows - 1)
    await populateSheetRange(
      runtime,
      meta.sessionId,
      sheet.id,
      r,
      batchEnd,
      0,
      maxCol,
      meta.styles,
    )
  }
}

