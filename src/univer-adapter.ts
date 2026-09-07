import { invoke } from '@tauri-apps/api/core'
import {
  BooleanNumber,
  CellValueType,
  type ICellData,
  type IStyleData,
} from '@univerjs/core'
import type { UniverRuntime } from './create-univer'
import type { RangeResult, SheetMetadata, WorkbookMetadata } from './types'
import { COLOR_PALETTES } from './charts/types'

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

  // Apply row heights if any.
  //
  // Heights come from the source file, so they are authoritative — Univer must not
  // re-derive them. The facade's per-row setters each dispatch a synchronous command,
  // so applying N rows costs N command round-trips and blocks the main thread for
  // seconds on a real workbook.
  //
  // SetWorksheetRowHeightMutation accepts a row->height map, so every row is applied
  // in a single mutation regardless of whether heights happen to be equal. The paired
  // SetWorksheetRowIsAutoHeightMutation pins ia=FALSE so Univer does not recompute
  // heights it was just given (this mirrors what SetRowHeightCommand does internally).
  const rowHeight: Record<number, number> = {}
  const autoHeightInfo: Record<number, number> = {}
  let minRow = Number.POSITIVE_INFINITY
  let maxRow = -1

  for (const rowProp of result.rows) {
    if (rowProp.height) {
      const px = Math.round((rowProp.height * 96) / 72)
      rowHeight[rowProp.row] = px
      autoHeightInfo[rowProp.row] = 0 // BooleanNumber.FALSE
      if (rowProp.row < minRow) minRow = rowProp.row
      if (rowProp.row > maxRow) maxRow = rowProp.row
    }
  }

  if (maxRow >= 0) {
    const ranges = [{ startRow: minRow, endRow: maxRow, startColumn: 0, endColumn: columns - 1 }]
    const unitId = workbook.getId()
    try {
      await runtime.univerAPI.executeCommand('sheet.mutation.set-worksheet-row-height', {
        unitId,
        subUnitId: sheetId,
        ranges,
        rowHeight,
      })
      await runtime.univerAPI.executeCommand('sheet.mutation.set-worksheet-row-is-auto-height', {
        unitId,
        subUnitId: sheetId,
        ranges,
        autoHeightInfo,
      })
    } catch {
      // ignore row height errors
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
  if (sheet.rowCount === 0 || sheet.columnCount === 0) {
    loadedSheetIds.add(sheet.id)
    return
  }

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

  loadedSheetIds.add(sheet.id)
}

export interface SaveCellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  fontSize?: number
  fontFamily?: string
  fontColor?: string
  bgColor?: string
  numFormat?: string
  wrapText?: boolean
  alignH?: string
  alignV?: string
}

export interface SaveMergeRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface SaveColWidth {
  col: number
  width: number
}

export interface SaveRowHeight {
  row: number
  height: number
}

export interface SaveFreeze {
  row: number
  col: number
}

export interface SaveCellData {
  r: number
  c: number
  v?: unknown
  f?: string
  style?: SaveCellStyle
}

export interface SavePointColor {
  index: number
  color: string
}

export interface SaveChartSeries {
  name?: string
  valuesRef?: string
  categoriesRef?: string
  values?: number[]
  categories?: string[]
  color?: string
  pointColors?: SavePointColor[]
  explosionPct?: number
}

export interface SaveChartValueAxis {
  min?: number | null
  max?: number | null
}

export interface SaveChartData {
  id: string
  title?: string
  chartType: string
  barDirection?: string
  grouping?: string
  sheetId: string
  sheetName?: string
  x: number
  y: number
  width: number
  height: number
  legend?: string
  dataLabels?: string
  dataLabelPosition?: string
  dataLabelFormat?: string
  gridlines?: boolean
  valueAxis?: SaveChartValueAxis
  holeSizePct?: number
  gapWidthPct?: number
  series: SaveChartSeries[]
}

export interface SaveSheetData {
  name: string
  showGridLines?: boolean
  freeze?: SaveFreeze
  colWidths: SaveColWidth[]
  rowHeights: SaveRowHeight[]
  merges: SaveMergeRange[]
  cells: SaveCellData[]
  charts?: SaveChartData[]
}

export interface SaveWorkbookPayload {
  path: string
  sheets: SaveSheetData[]
}

export async function saveWorkbookToDisk(
  runtime: UniverRuntime,
  filePath: string,
  currentMeta?: WorkbookMetadata | null,
  loadedSheetIds?: Set<string>,
  onStatus?: (text: string) => void,
  charts?: any[],
): Promise<void> {
  const activeWorkbook = runtime.univerAPI.getActiveWorkbook()
  if (!activeWorkbook) {
    throw new Error('未找到当前活动工作簿')
  }

  // Authoritative live worksheets from Univer
  const liveWorksheets = (activeWorkbook.getSheets?.() || []).filter(Boolean)
  const liveSheetIds = new Set<string>(liveWorksheets.map((ws: any) => ws.getSheetId()))

  const getSnapshotCellCount = (sData: any): number => {
    if (!sData?.cellData) return 0
    let matrix = sData.cellData
    if (matrix && typeof matrix.getMatrix === 'function') matrix = matrix.getMatrix()
    else if (matrix && typeof matrix.getData === 'function') matrix = matrix.getData()
    if (!matrix) return 0
    let count = 0
    for (const r in matrix) {
      const row = matrix[r]
      if (!row) continue
      for (const c in row) {
        const cell = row[c]
        if (cell && (cell.v !== undefined && cell.v !== null || cell.f || cell.s)) {
          count++
        }
      }
    }
    return count
  }

  // If opening from an existing file, ensure all LIVE worksheets have their cells populated
  if (currentMeta) {
    const tempSnapshot = activeWorkbook.getSnapshot() as any
    for (const sheet of currentMeta.sheets) {
      if (liveSheetIds.has(sheet.id) && sheet.rowCount > 0) {
        const sData = tempSnapshot?.sheets?.[sheet.id]
        const count = getSnapshotCellCount(sData)
        if (count === 0 || !loadedSheetIds?.has(sheet.id)) {
          onStatus?.(`正在加载工作表: ${sheet.name} 数据以供保存...`)
          loadedSheetIds?.delete(sheet.id)
          await loadWorksheetData(runtime, currentMeta, sheet, loadedSheetIds || new Set(), onStatus)
        }
      }
    }
  }

  const snapshot = activeWorkbook.getSnapshot() as any
  if (!snapshot || !snapshot.sheets) {
    throw new Error('工作簿数据快照获取失败')
  }

  const stylesPool = snapshot.styles || {}
  const rawSheetOrder: string[] =
    snapshot.sheetOrder && snapshot.sheetOrder.length > 0
      ? snapshot.sheetOrder
      : Object.keys(snapshot.sheets)

  // Strictly filter sheetOrder to only sheets that are in liveSheetIds and exist in snapshot.sheets
  const sheetOrder: string[] = rawSheetOrder.filter(
    (sheetId) => liveSheetIds.has(sheetId) && Boolean(snapshot.sheets[sheetId])
  )

  // In case liveWorksheets has a newly added sheet not yet present in rawSheetOrder
  for (const ws of liveWorksheets) {
    const sid = ws.getSheetId()
    if (snapshot.sheets[sid] && !sheetOrder.includes(sid)) {
      sheetOrder.push(sid)
    }
  }

  if (sheetOrder.length === 0) {
    throw new Error('当前工作簿中没有有效的工作表，无法保存')
  }

  const sheetsPayload: SaveSheetData[] = []

  for (const sheetId of sheetOrder) {
    const sheetData = snapshot.sheets[sheetId]
    if (!sheetData) continue

    const sheetName: string = sheetData.name || 'Sheet'
    const showGridLines = sheetData.showGridlines !== 0

    let freeze: SaveFreeze | undefined
    if (sheetData.freeze && (sheetData.freeze.ySplit || sheetData.freeze.xSplit)) {
      freeze = {
        row: sheetData.freeze.ySplit || 0,
        col: sheetData.freeze.xSplit || 0,
      }
    }

    // Column widths
    const colWidths: SaveColWidth[] = []
    if (sheetData.columnData) {
      for (const [colStr, colObj] of Object.entries(sheetData.columnData as Record<string, any>)) {
        const c = Number(colStr)
        if (!isNaN(c) && colObj && typeof colObj.w === 'number' && colObj.w > 0) {
          colWidths.push({
            col: c,
            width: Math.max(1, +(colObj.w / 8).toFixed(1)),
          })
        }
      }
    }
    if (colWidths.length === 0 && currentMeta) {
      const metaSheet = currentMeta.sheets.find((s) => s.id === sheetId || s.name === sheetName)
      if (metaSheet?.columnWidths) {
        for (const col of metaSheet.columnWidths) {
          if (col.width) {
            for (let c = col.startColumn; c <= col.endColumn; c++) {
              colWidths.push({ col: c, width: Math.max(1, +(col.width).toFixed(1)) })
            }
          }
        }
      }
    }

    // Row heights
    const rowHeights: SaveRowHeight[] = []
    if (sheetData.rowData) {
      for (const [rowStr, rowObj] of Object.entries(sheetData.rowData as Record<string, any>)) {
        const r = Number(rowStr)
        if (!isNaN(r) && rowObj && typeof rowObj.h === 'number' && rowObj.h > 0) {
          rowHeights.push({
            row: r,
            height: Math.max(1, +(rowObj.h * 72 / 96).toFixed(1)),
          })
        }
      }
    }

    // Merges
    const merges: SaveMergeRange[] = []
    if (Array.isArray(sheetData.mergeData)) {
      for (const m of sheetData.mergeData) {
        if (m && typeof m.startRow === 'number') {
          merges.push({
            startRow: m.startRow,
            endRow: m.endRow,
            startCol: m.startColumn,
            endCol: m.endColumn,
          })
        }
      }
    }

    // Cells
    const cells: SaveCellData[] = []
    let matrix = sheetData.cellData
    if (matrix && typeof matrix.getMatrix === 'function') {
      matrix = matrix.getMatrix()
    } else if (matrix && typeof matrix.getData === 'function') {
      matrix = matrix.getData()
    }

    if (matrix) {
      for (const [rowStr, colMap] of Object.entries(matrix as Record<string, any>)) {
        const r = Number(rowStr)
        if (isNaN(r) || !colMap) continue

        for (const [colStr, cell] of Object.entries(colMap as Record<string, any>)) {
          const c = Number(colStr)
          if (isNaN(c) || !cell) continue

          let rawStyle: any = undefined
          if (typeof cell.s === 'string') {
            rawStyle = stylesPool[cell.s]
          } else if (cell.s && typeof cell.s === 'object') {
            rawStyle = cell.s
          }

          let style: SaveCellStyle | undefined
          if (rawStyle) {
            style = {}
            if (rawStyle.bl) style.bold = true
            if (rawStyle.it) style.italic = true
            if (rawStyle.ul?.s) style.underline = true
            if (rawStyle.st?.s) style.strike = true
            if (typeof rawStyle.fs === 'number') style.fontSize = rawStyle.fs
            if (rawStyle.ff) style.fontFamily = rawStyle.ff
            if (rawStyle.cl?.rgb) style.fontColor = rawStyle.cl.rgb
            if (rawStyle.bg?.rgb) style.bgColor = rawStyle.bg.rgb
            if (rawStyle.n?.pattern) style.numFormat = rawStyle.n.pattern
            if (rawStyle.tb === 3) style.wrapText = true
            if (rawStyle.ht === 1) style.alignH = 'left'
            else if (rawStyle.ht === 2) style.alignH = 'center'
            else if (rawStyle.ht === 3) style.alignH = 'right'
            if (rawStyle.vt === 1) style.alignV = 'top'
            else if (rawStyle.vt === 2) style.alignV = 'center'
            else if (rawStyle.vt === 3) style.alignV = 'bottom'

            if (Object.keys(style).length === 0) {
              style = undefined
            }
          }

          let v = cell.v
          if (v === undefined && cell.p?.body?.dataStream) {
            v = cell.p.body.dataStream.replace(/\r?\n$/, '')
          }

          const hasVal = v !== undefined && v !== null
          const hasFormula = Boolean(cell.f)

          if (hasVal || hasFormula || style) {
            cells.push({
              r,
              c,
              v: hasVal ? v : null,
              f: hasFormula ? cell.f : undefined,
              style,
            })
          }
        }
      }
    }

    // Fail-safe: If cells is empty but currentMeta has this sheet with rowCount > 0,
    // read directly from xlsx-engine session so we never lose cell data on save
    if (cells.length === 0 && currentMeta) {
      const metaSheet = currentMeta.sheets.find(
        (s) => s.id === sheetId || s.name === sheetName
      )
      if (metaSheet && metaSheet.rowCount > 0 && metaSheet.columnCount > 0) {
        try {
          const totalRows = metaSheet.rowCount
          const maxCol = metaSheet.columnCount - 1
          const batchRows = Math.max(10, Math.min(2000, Math.floor(50000 / Math.max(1, metaSheet.columnCount))))
          for (let r = 0; r < totalRows; r += batchRows) {
            const batchEnd = Math.min(r + batchRows - 1, totalRows - 1)
            const result = await readWorkbookRange(
              currentMeta.sessionId,
              metaSheet.id,
              r,
              batchEnd,
              0,
              maxCol,
            )
            for (const cell of result.cells) {
              if ((cell.value !== undefined && cell.value !== null) || cell.formula) {
                const styleObj = cell.styleIndex !== undefined ? currentMeta.styles[cell.styleIndex] : undefined
                let style: SaveCellStyle | undefined
                if (styleObj) {
                  style = {}
                  if (styleObj.bold) style.bold = true
                  if (styleObj.italic) style.italic = true
                  if (styleObj.underline) style.underline = true
                  if (styleObj.strikethrough) style.strike = true
                  if (styleObj.fontSize) style.fontSize = styleObj.fontSize
                  if (styleObj.fontFamily) style.fontFamily = styleObj.fontFamily
                  if (styleObj.fontColor) style.fontColor = styleObj.fontColor
                  if (styleObj.fillColor) style.bgColor = styleObj.fillColor
                  if (styleObj.numberFormat) style.numFormat = styleObj.numberFormat
                  if (styleObj.wrapText) style.wrapText = true
                  if (styleObj.horizontalAlignment) style.alignH = styleObj.horizontalAlignment
                  if (styleObj.verticalAlignment) style.alignV = styleObj.verticalAlignment
                  if (Object.keys(style).length === 0) style = undefined
                }
                cells.push({
                  r: cell.row,
                  c: cell.column,
                  v: cell.value !== undefined && cell.value !== null ? cell.value : null,
                  f: cell.formula,
                  style,
                })
              }
            }
          }
        } catch (err) {
          console.warn(`Direct read fallback for sheet ${sheetName} failed:`, err)
        }
      }
    }

    // Charts for this sheet
    const sheetCharts: SaveChartData[] = []
    if (Array.isArray(charts)) {
      for (const c of charts) {
        if (!c || (c.kind !== 'chart' && !c.chart)) continue
        const matchesSheet =
          c.sheetId === sheetId ||
          c.sheetId === sheetName ||
          (currentMeta?.sheets?.some(
            (s) => (s.id === c.sheetId || s.name === c.sheetId) && (s.id === sheetId || s.name === sheetName)
          )) ||
          (!c.sheetId && (sheetOrder[0] === sheetId || sheetOrder.length === 1));

        if (matchesSheet) {
          const primaryType = c.chart?.chartTypes?.[0] || '';
          let chartType = 'column';
          if (c.chart?.barDirection === 'bar' || primaryType === 'bar' || (primaryType === 'barChart' && c.chart?.barDirection === 'bar')) {
            chartType = 'bar';
          } else if (primaryType === 'pie' || primaryType === 'pieChart') {
            chartType = 'pie';
          } else if (primaryType === 'doughnut' || primaryType === 'doughnutChart') {
            chartType = 'doughnut';
          } else if (primaryType === 'line' || primaryType === 'lineChart') {
            chartType = 'line';
          } else if (primaryType === 'area' || primaryType === 'areaChart') {
            chartType = 'area';
          } else if (primaryType === 'scatter' || primaryType === 'scatterChart') {
            chartType = 'scatter';
          } else if (primaryType === 'radar' || primaryType === 'radarChart') {
            chartType = 'radar';
          } else {
            chartType = 'column';
          }

          const isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';
          const paletteColors = COLOR_PALETTES[c.chart?.palette || 'office'] || COLOR_PALETTES.office;

          const series: SaveChartSeries[] = (c.chart?.series || []).map((s: any, sIdx: number) => {
            let pointColors: SavePointColor[] = [];
            if (Array.isArray(s.pointColors) && s.pointColors.length > 0) {
              pointColors = s.pointColors.map((p: any) => ({ index: p.index, color: p.color }));
            } else if (isPieOrDoughnut && sIdx === 0) {
              // Automatically assign palette colors to pie slices if not explicitly set
              const count = Math.max(s.values?.length || 0, s.categories?.length || 0, 1);
              pointColors = Array.from({ length: count }, (_, i) => ({
                index: i,
                color: paletteColors[i % paletteColors.length],
              }));
            }

            return {
              name: s.name,
              valuesRef: s.valuesRef,
              categoriesRef: s.categoriesRef,
              values: Array.isArray(s.values) ? s.values : [],
              categories: Array.isArray(s.categories) ? s.categories.map(String) : [],
              color: s.color,
              pointColors,
              explosionPct: s.explosionPct,
            };
          });

          sheetCharts.push({
            id: c.id,
            title: c.chart?.title,
            chartType,
            barDirection: c.chart?.barDirection,
            grouping: c.chart?.grouping,
            sheetId,
            sheetName,
            x: c.pos?.x ?? 80,
            y: c.pos?.y ?? 40,
            width: c.pos?.width ?? 520,
            height: c.pos?.height ?? 340,
            legend: c.chart?.legend,
            dataLabels: c.chart?.dataLabels,
            dataLabelPosition: c.chart?.dataLabelPosition,
            dataLabelFormat: c.chart?.dataLabelFormat,
            gridlines: c.chart?.gridlines,
            valueAxis: c.chart?.valueAxis
              ? {
                  min: typeof c.chart.valueAxis.min === 'number' ? c.chart.valueAxis.min : null,
                  max: typeof c.chart.valueAxis.max === 'number' ? c.chart.valueAxis.max : null,
                }
              : undefined,
            holeSizePct: c.chart?.holeSizePct,
            gapWidthPct: c.chart?.gapWidthPct,
            series,
          });
        }
      }
    }

    sheetsPayload.push({
      name: sheetName,
      showGridLines,
      freeze,
      colWidths,
      rowHeights,
      merges,
      cells,
      charts: sheetCharts,
    })
  }

  await invoke('save_workbook', {
    payload: {
      path: filePath,
      sheets: sheetsPayload,
    },
  })

  // Synchronize currentMeta sheets to only live sheets
  if (currentMeta) {
    currentMeta.sheets = currentMeta.sheets.filter((s) => liveSheetIds.has(s.id))
  }
}


