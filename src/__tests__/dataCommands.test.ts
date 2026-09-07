import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDataCommands } from '../data/useDataCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }))
vi.mock('../shared/rowHeights', () => ({ setRowHeightsBatched: vi.fn() }))

const { setRowHeightsBatched } = await import('../shared/rowHeights')
const initialDialogs = useDialogStore.getState()

interface SheetOpts {
  grid?: unknown[][]
  maxRows?: number
  rowHeights?: Record<number, number>
  filter?: { remove: () => void } | null
}

function makeCtx(sheet: SheetOpts = {}, rangeOverrides: Record<string, unknown> = {}) {
  const grid = sheet.grid ?? []
  const writes: Array<[number, number, unknown]> = []
  const deleteRows = vi.fn()
  const setColumnWidth = vi.fn()
  const setRowHeightsForced = vi.fn()
  const executeCommand = vi.fn()
  const sort = vi.fn()
  const createFilter = vi.fn()
  const removeFilter = vi.fn()

  const ctx: CommandContext = {
    runtime: { univerAPI: { executeCommand } } as never,
    workbook: { getId: () => 'unit-1' },
    worksheet: {
      getSheetId: () => 'sheet-1',
      getMaxRows: () => sheet.maxRows ?? grid.length,
      getMaxColumns: () => 30,
      getRowHeight: (r: number) => sheet.rowHeights?.[r] ?? 24,
      getRange: (r: number, c: number) => ({
        getValue: () => grid[r]?.[c] ?? null,
        setValue: (v: unknown) => writes.push([r, c, v]),
      }),
      getFilter: () => (sheet.filter === undefined ? null : sheet.filter),
      deleteRows,
      setColumnWidth,
      setRowHeightsForced,
    },
    range: {
      getA1Notation: () => 'B2:D5',
      getRow: () => 0,
      getColumn: () => 0,
      getWidth: () => 2,
      getHeight: () => grid.length || 1,
      sort,
      createFilter,
      ...rangeOverrides,
    },
  }
  return { ctx, writes, deleteRows, setColumnWidth, setRowHeightsForced, executeCommand, sort, createFilter, removeFilter }
}

const deps = { getFieldsFromRange: vi.fn(() => [{ name: 'A', colIndex: 0 } as never]) }
const handle = useDataCommands(deps)
const status = () => useDocumentStore.getState().status

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('data command routing', () => {
  it('claims every data command', () => {
    const commands = [
      'pivot-open', 'pivot-refresh',
      'import-csv', 'merge-workbooks', 'refresh-all',
      'sort:asc', 'sort:desc', 'sort-custom-open',
      'filter-toggle', 'filter-clear', 'filter-reapply', 'filter-advanced',
      'text-to-columns:1', 'text-to-columns:2', 'text-to-columns:4', 'text-to-columns:8',
      'flash-fill', 'remove-duplicates-open', 'dv-open', 'consolidate-open',
      'goal-seek-open',
      'outline-group:rows', 'outline-group:cols',
      'outline-ungroup:rows', 'outline-ungroup:cols',
      'outline-hide-detail:rows', 'outline-hide-detail:cols',
      'outline-show-detail:rows', 'outline-show-detail:cols',
      'subtotal-open',
    ]
    for (const cmd of commands) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'zoom-in', 'sort', 'text-to-columns', '']) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })
})

describe('dialogs that list selection fields', () => {
  it.each([
    ['pivot-open', 'pivot'],
    ['sort-custom-open', 'custom-sort'],
    ['filter-advanced', 'advanced-filter'],
    ['subtotal-open', 'subtotal'],
  ])('%s captures the fields and opens %s', (cmd, dialog) => {
    const { ctx } = makeCtx()
    handle(cmd, ctx)
    expect(deps.getFieldsFromRange).toHaveBeenCalled()
    expect(useDialogStore.getState().dataFields).toEqual([{ name: 'A', colIndex: 0 }])
    expect(useDialogStore.getState().activeDialog).toBe(dialog)
  })

  it.each([
    ['pivot-open'],
    ['consolidate-open'],
  ])('%s also records the selection reference', (cmd) => {
    const { ctx } = makeCtx({}, { getA1Notation: () => 'A1:C9' })
    handle(cmd, ctx)
    expect(useDialogStore.getState().defaultRangeStr).toBe('A1:C9')
  })

  it('goal-seek-open opens without capturing fields', () => {
    const { ctx } = makeCtx()
    handle('goal-seek-open', ctx)
    expect(deps.getFieldsFromRange).not.toHaveBeenCalled()
    expect(useDialogStore.getState().activeDialog).toBe('goal-seek')
  })
})

describe('sort', () => {
  it.each([
    ['sort:asc', true, '已按升序排列选区'],
    ['sort:desc', false, '已按降序排列选区'],
  ])('%s sorts on the first column', (cmd, ascending, message) => {
    const { ctx, sort } = makeCtx()
    handle(cmd, ctx)
    expect(sort).toHaveBeenCalledWith({ column: 0, ascending })
    expect(status()).toBe(message)
  })
})

describe('filter', () => {
  it('filter-toggle removes an existing filter', () => {
    const remove = vi.fn()
    const { ctx, createFilter } = makeCtx({ filter: { remove } })

    handle('filter-toggle', ctx)

    expect(remove).toHaveBeenCalled()
    expect(createFilter).not.toHaveBeenCalled()
    expect(status()).toBe('已关闭数据筛选')
  })

  it('filter-toggle creates one when absent', () => {
    const { ctx, createFilter } = makeCtx({ filter: null })
    handle('filter-toggle', ctx)
    expect(createFilter).toHaveBeenCalled()
    expect(status()).toBe('已在选区开启数据筛选')
  })

  it('filter-toggle falls back to the Univer command when the facade throws', () => {
    const { ctx, executeCommand } = makeCtx({ filter: null }, {
      createFilter: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })

    handle('filter-toggle', ctx)

    expect(executeCommand).toHaveBeenCalledWith('sheet.command.smart-toggle-filter')
    expect(status()).toBe('已切换数据筛选状态')
  })

  // Clearing criteria leaves rows the filter had hidden at height 0, so they are
  // restored explicitly.
  it('filter-clear restores rows the filter had collapsed', () => {
    const { ctx, executeCommand } = makeCtx({ maxRows: 5, rowHeights: { 1: 0, 3: 0 } })

    handle('filter-clear', ctx)

    expect(executeCommand).toHaveBeenCalledWith('sheet.command.clear-filter-criteria')
    expect(setRowHeightsBatched).toHaveBeenCalledWith(
      expect.anything(), 'unit-1', 'sheet-1', 30, [1, 3], 24,
    )
    expect(status()).toBe('已清除所有筛选条件')
  })

  it('filter-clear scans at most 100 rows', () => {
    const hidden: Record<number, number> = {}
    for (let r = 0; r < 200; r++) hidden[r] = 0
    const { ctx } = makeCtx({ maxRows: 200, rowHeights: hidden })

    handle('filter-clear', ctx)

    const rows = vi.mocked(setRowHeightsBatched).mock.calls[0]?.[4] as number[]
    expect(rows).toHaveLength(100)
  })

  it('filter-reapply issues the recalc command', () => {
    const { ctx, executeCommand } = makeCtx()
    handle('filter-reapply', ctx)
    expect(executeCommand).toHaveBeenCalledWith('sheet.command.re-calc-filter')
  })
})

describe('text-to-columns', () => {
  it.each([
    ['text-to-columns:2', ',', 'a,b'],
    ['text-to-columns:4', ';', 'a;b'],
    ['text-to-columns:8', ' ', 'a b'],
    ['text-to-columns:1', '\t', 'a\tb'],
  ])('%s splits on its delimiter', (cmd, _delim, text) => {
    const { ctx, writes } = makeCtx({ grid: [[text]] })
    handle(cmd, ctx)
    expect(writes).toEqual([
      [0, 0, 'a'],
      [0, 1, 'b'],
    ])
  })

  it('trims each part', () => {
    const { ctx, writes } = makeCtx({ grid: [[' a , b ']] })
    handle('text-to-columns:2', ctx)
    expect(writes).toEqual([
      [0, 0, 'a'],
      [0, 1, 'b'],
    ])
  })

  it('leaves rows without the delimiter alone and counts only those split', () => {
    const { ctx, writes } = makeCtx({ grid: [['a,b'], ['plain'], ['c,d']] })
    handle('text-to-columns:2', ctx)
    expect(writes).toHaveLength(4)
    expect(status()).toContain('已对 2 行数据')
  })

  it('names the space delimiter in the message', () => {
    const { ctx } = makeCtx({ grid: [['a b']] })
    handle('text-to-columns:8', ctx)
    expect(status()).toContain('按 "空格"')
  })
})

describe('remove-duplicates', () => {
  // Deleted back to front so the earlier indices stay valid.
  it('deletes later duplicate rows, highest index first', () => {
    const { ctx, deleteRows } = makeCtx({
      grid: [
        ['a', '1'],
        ['b', '2'],
        ['a', '1'],
        ['b', '2'],
      ],
    })

    handle('remove-duplicates-open', ctx)

    expect(deleteRows.mock.calls).toEqual([[3, 1], [2, 1]])
    expect(status()).toBe('已清除 2 行重复数据')
  })

  it('treats a row as duplicate only when every cell matches', () => {
    const { ctx, deleteRows } = makeCtx({
      grid: [
        ['a', '1'],
        ['a', '2'],
      ],
    })

    handle('remove-duplicates-open', ctx)

    expect(deleteRows).not.toHaveBeenCalled()
    expect(status()).toBe('选区未发现重复项')
  })
})

describe('outline', () => {
  // Univer has no grouping model: group/ungroup only report, and the
  // hide/show-detail pair approximates collapsing by zeroing sizes.
  it.each([
    ['outline-ungroup:rows', '已取消行分级组合'],
    ['outline-ungroup:cols', '已取消列分级组合'],
  ])('%s only reports', (cmd, message) => {
    const { ctx, setRowHeightsForced, setColumnWidth } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
    expect(setRowHeightsForced).not.toHaveBeenCalled()
    expect(setColumnWidth).not.toHaveBeenCalled()
  })

  it('outline-group:rows reports a 1-based row span', () => {
    const { ctx } = makeCtx({}, { getRow: () => 2, getHeight: () => 3 })
    handle('outline-group:rows', ctx)
    expect(status()).toBe('已将第 3 至 5 行设置为分级组合')
  })

  it('outline-group:cols reports column letters', () => {
    const { ctx } = makeCtx({}, { getColumn: () => 1, getWidth: () => 3 })
    handle('outline-group:cols', ctx)
    expect(status()).toBe('已将第 B 至 D 列设置为分级组合')
  })

  // Keeps the first row visible as the summary row.
  it('hide-detail:rows collapses all but the first row', () => {
    const { ctx, setRowHeightsForced } = makeCtx({}, { getRow: () => 2, getHeight: () => 4 })
    handle('outline-hide-detail:rows', ctx)
    expect(setRowHeightsForced).toHaveBeenCalledWith(3, 3, 0)
  })

  it('hide-detail:rows does nothing for a single row', () => {
    const { ctx, setRowHeightsForced } = makeCtx({}, { getHeight: () => 1 })
    handle('outline-hide-detail:rows', ctx)
    expect(setRowHeightsForced).not.toHaveBeenCalled()
  })

  it('show-detail:rows restores the whole span', () => {
    const { ctx, setRowHeightsForced } = makeCtx({}, { getRow: () => 2, getHeight: () => 4 })
    handle('outline-show-detail:rows', ctx)
    expect(setRowHeightsForced).toHaveBeenCalledWith(2, 4, 24)
  })

  it('hide-detail:cols collapses all but the first column', () => {
    const { ctx, setColumnWidth } = makeCtx({}, { getColumn: () => 1, getWidth: () => 3 })
    handle('outline-hide-detail:cols', ctx)
    expect(setColumnWidth.mock.calls).toEqual([[2, 0], [3, 0]])
  })

  it('show-detail:cols restores the whole span', () => {
    const { ctx, setColumnWidth } = makeCtx({}, { getColumn: () => 1, getWidth: () => 2 })
    handle('outline-show-detail:cols', ctx)
    expect(setColumnWidth.mock.calls).toEqual([[1, 80], [2, 80]])
  })
})

describe('report-only commands', () => {
  it.each([
    ['pivot-refresh', '当前数据透视表已刷新联动'],
    ['refresh-all', '全部外部数据源与透视表已刷新完毕'],
  ])('%s reports without touching the sheet', (cmd, message) => {
    const { ctx, executeCommand } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it.each([
    ['flash-fill', 'sheet.command.copy-down'],
    ['dv-open', 'sheet.command.open-data-validation-panel'],
  ])('%s delegates to %s', (cmd, univerCmd) => {
    const { ctx, executeCommand } = makeCtx()
    handle(cmd, ctx)
    expect(executeCommand).toHaveBeenCalledWith(univerCmd)
  })
})
