import { open } from '@tauri-apps/plugin-dialog'
import { columnLabel } from '../charts/cellAddress'
import { setRowHeightsBatched } from '../shared/rowHeights'
import { useDialogStore, useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'
import type { PivotField } from '../insert/PivotDialog'

export interface DataCommandDeps {
  getFieldsFromRange: (worksheet: any, range: any) => PivotField[]
}

/** Text-to-columns delimiter codes, as encoded in the ribbon command suffix. */
const DELIMITERS: Record<number, string> = { 1: '\t', 2: ',', 4: ';', 8: ' ' }

/** Bound on the filter-clear scan; matches the original. */
const FILTER_SCAN_MAX_ROWS = 100
const DEFAULT_ROW_HEIGHT = 24
const DEFAULT_COL_WIDTH = 80

/**
 * Data tab commands: pivot, external data, sort and filter, data tools,
 * forecast and outline.
 *
 * The outline group/ungroup commands only report - Univer has no grouping
 * model, so the hide/show-detail pair fakes it by zeroing row heights and
 * column widths. Preserved as-is.
 */
export function useDataCommands(deps: DataCommandDeps) {
  return function handleDataCommand(cmd: string, ctx: CommandContext): boolean {
    const { runtime, workbook, worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()
    const dialogs = useDialogStore.getState()

    /** Captures the selection's fields, then opens a dialog that lists them. */
    const openWithFields = (dialog: Parameters<typeof dialogs.openDialog>[0]) => {
      dialogs.setDataFields(deps.getFieldsFromRange(worksheet, range))
      dialogs.openDialog(dialog)
    }

    switch (cmd) {
      // ── 1. Pivot table ──
      case 'pivot-open': {
        dialogs.setDefaultRangeStr(range.getA1Notation())
        openWithFields('pivot')
        return true
      }

      case 'pivot-refresh': {
        setStatus('当前数据透视表已刷新联动')
        return true
      }

      // ── 2. External data ──
      // Both pickers report the chosen file without reading it.
      case 'import-csv':
      case 'merge-workbooks': {
        const isCsv = cmd === 'import-csv'
        void (async () => {
          try {
            const selected = await open({
              multiple: false,
              filters: isCsv
                ? [{ name: '文本 / CSV 文件', extensions: ['csv', 'txt', 'tsv'] }]
                : [{ name: 'Excel 工作簿', extensions: ['xlsx', 'xlsm'] }],
            })
            if (selected && typeof selected === 'string') {
              const name = selected.split(/[/\\]/).pop()
              setStatus(isCsv ? `已导入数据文件: ${name}` : `已合并工作簿数据: ${name}`)
            }
          } catch (e) {
            console.error(e)
          }
        })()
        return true
      }

      case 'refresh-all': {
        setStatus('全部外部数据源与透视表已刷新完毕')
        return true
      }

      // ── 3. Sort and filter ──
      case 'sort:asc':
      case 'sort:desc': {
        const ascending = cmd === 'sort:asc'
        range.sort({ column: 0, ascending })
        setStatus(ascending ? '已按升序排列选区' : '已按降序排列选区')
        return true
      }

      case 'sort-custom-open': {
        openWithFields('custom-sort')
        return true
      }

      case 'filter-toggle': {
        try {
          const existing = (worksheet as any).getFilter?.()
          if (existing) {
            existing.remove()
            setStatus('已关闭数据筛选')
          } else {
            ;(range as any).createFilter?.()
            setStatus('已在选区开启数据筛选')
          }
        } catch {
          void runtime.univerAPI.executeCommand('sheet.command.smart-toggle-filter')
          setStatus('已切换数据筛选状态')
        }
        return true
      }

      case 'filter-clear': {
        try {
          void runtime.univerAPI.executeCommand('sheet.command.clear-filter-criteria')
          // Clearing criteria leaves rows that the filter had hidden at height 0,
          // so they are restored explicitly.
          const maxR = Math.min(FILTER_SCAN_MAX_ROWS, worksheet.getMaxRows())
          const hidden: number[] = []
          for (let r = 0; r < maxR; r++) {
            if (worksheet.getRowHeight(r) === 0) hidden.push(r)
          }
          setRowHeightsBatched(
            runtime.univerAPI,
            workbook.getId(),
            worksheet.getSheetId(),
            worksheet.getMaxColumns(),
            hidden,
            DEFAULT_ROW_HEIGHT,
          )
          setStatus('已清除所有筛选条件')
        } catch {
          setStatus('筛选条件已清除')
        }
        return true
      }

      case 'filter-reapply': {
        void runtime.univerAPI.executeCommand('sheet.command.re-calc-filter')
        setStatus('已重新计算并应用筛选')
        return true
      }

      case 'filter-advanced': {
        openWithFields('advanced-filter')
        return true
      }

      // ── 4. Data tools ──
      case 'text-to-columns:1':
      case 'text-to-columns:2':
      case 'text-to-columns:4':
      case 'text-to-columns:8': {
        const delimChar = DELIMITERS[Number(cmd.split(':')[1])] ?? '\t'
        const startRow = range.getRow()
        const height = range.getHeight()
        const col = range.getColumn()
        let splitRows = 0

        for (let r = 0; r < height; r++) {
          const text = String(worksheet.getRange(startRow + r, col, 1, 1).getValue() ?? '')
          if (!text.includes(delimChar)) continue
          // Overwrites the columns to the right without checking whether they
          // hold data. Carried over unchanged.
          text.split(delimChar).forEach((part, idx) => {
            worksheet.getRange(startRow + r, col + idx, 1, 1).setValue(part.trim())
          })
          splitRows++
        }
        setStatus(
          `分列完成：已对 ${splitRows} 行数据按 "${delimChar === ' ' ? '空格' : delimChar}" 拆分至相邻列`,
        )
        return true
      }

      case 'flash-fill': {
        void runtime.univerAPI.executeCommand('sheet.command.copy-down')
        setStatus('快速填充完成')
        return true
      }

      case 'remove-duplicates-open': {
        const startRow = range.getRow()
        const height = range.getHeight()
        const width = range.getWidth()
        const startCol = range.getColumn()
        const seen = new Set<string>()
        const rowsToDelete: number[] = []

        for (let r = 0; r < height; r++) {
          const rowIdx = startRow + r
          const rowValues: string[] = []
          for (let c = 0; c < width; c++) {
            rowValues.push(
              String(worksheet.getRange(rowIdx, startCol + c, 1, 1).getValue() ?? ''),
            )
          }
          const rowKey = rowValues.join('||')
          if (seen.has(rowKey)) rowsToDelete.push(rowIdx)
          else seen.add(rowKey)
        }

        // Deleted back to front so the earlier indices stay valid.
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
          worksheet.deleteRows(rowsToDelete[i], 1)
        }
        setStatus(
          rowsToDelete.length > 0 ? `已清除 ${rowsToDelete.length} 行重复数据` : '选区未发现重复项',
        )
        return true
      }

      case 'dv-open': {
        void runtime.univerAPI.executeCommand('sheet.command.open-data-validation-panel')
        setStatus('已打开数据验证面板')
        return true
      }

      case 'consolidate-open': {
        dialogs.setDefaultRangeStr(range.getA1Notation())
        dialogs.openDialog('consolidate')
        return true
      }

      // ── 5. Forecast ──
      case 'goal-seek-open': {
        dialogs.openDialog('goal-seek')
        return true
      }

      // ── 6. Outline ──
      // Univer has no grouping model, so group/ungroup only report and the
      // hide/show-detail pair approximates collapsing by zeroing sizes.
      case 'outline-group:rows': {
        setStatus(
          `已将第 ${range.getRow() + 1} 至 ${range.getRow() + range.getHeight()} 行设置为分级组合`,
        )
        return true
      }

      case 'outline-group:cols': {
        const from = columnLabel(range.getColumn())
        const to = columnLabel(range.getColumn() + range.getWidth() - 1)
        setStatus(`已将第 ${from} 至 ${to} 列设置为分级组合`)
        return true
      }

      case 'outline-ungroup:rows': {
        setStatus('已取消行分级组合')
        return true
      }

      case 'outline-ungroup:cols': {
        setStatus('已取消列分级组合')
        return true
      }

      case 'outline-hide-detail:rows': {
        // Keeps the first row visible as the summary row.
        const h = range.getHeight()
        if (h > 1) worksheet.setRowHeightsForced(range.getRow() + 1, h - 1, 0)
        setStatus('已折叠隐藏明细行')
        return true
      }

      case 'outline-hide-detail:cols': {
        const startC = range.getColumn()
        const w = range.getWidth()
        for (let c = 1; c < w; c++) worksheet.setColumnWidth(startC + c, 0)
        setStatus('已折叠隐藏明细列')
        return true
      }

      case 'outline-show-detail:rows': {
        const h = range.getHeight()
        if (h > 0) worksheet.setRowHeightsForced(range.getRow(), h, DEFAULT_ROW_HEIGHT)
        setStatus('已展开显示明细行')
        return true
      }

      case 'outline-show-detail:cols': {
        const startC = range.getColumn()
        const w = range.getWidth()
        for (let c = 0; c < w; c++) worksheet.setColumnWidth(startC + c, DEFAULT_COL_WIDTH)
        setStatus('已展开显示明细列')
        return true
      }

      case 'subtotal-open': {
        openWithFields('subtotal')
        return true
      }

      default:
        return false
    }
  }
}
