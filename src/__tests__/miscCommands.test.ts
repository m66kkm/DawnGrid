import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMiscCommands } from '../shared/useMiscCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialDialogs = useDialogStore.getState()

function makeCtx(rangeOverrides: Record<string, unknown> = {}) {
  const r = {
    setBackground: vi.fn(),
    setFontColor: vi.fn(),
    setFontSize: vi.fn(),
    setFontWeight: vi.fn(),
    setFontLine: vi.fn(),
    setValue: vi.fn(),
    getRow: () => 1,
    getColumn: () => 2,
    getWidth: () => 2,
    getHeight: () => 3,
    ...rangeOverrides,
  }
  const sheetCells: Array<Record<string, ReturnType<typeof vi.fn>>> = []
  const worksheet = {
    setRowHeightsForced: vi.fn(),
    setColumnWidth: vi.fn(),
    getRange: vi.fn(() => {
      const cell = {
        setBackground: vi.fn(),
        setFontColor: vi.fn(),
        setFontWeight: vi.fn(),
      }
      sheetCells.push(cell)
      return cell
    }),
  }
  const ctx: CommandContext = {
    runtime: {} as never,
    workbook: {},
    worksheet,
    range: r,
  }
  return { ctx, r, worksheet, sheetCells }
}

const handle = useMiscCommands()
const status = () => useDocumentStore.getState().status
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
})

describe('catch-all', () => {
  // This handler runs last, so it claims everything: an unrecognised command is
  // reported rather than silently ignored.
  it('claims any command and reports it', () => {
    const { ctx } = makeCtx()
    expect(handle('totally-unknown', ctx)).toBe(true)
    expect(status()).toBe('执行: totally-unknown')
    expect(logSpy).toHaveBeenCalled()
  })

  it('logs the arguments alongside the command', () => {
    const { ctx } = makeCtx()
    handle('mystery', ctx, 'a', 1)
    expect(logSpy).toHaveBeenCalledWith('Ribbon command triggered:', 'mystery', ['a', 1])
  })
})

describe('legacy cell styles', () => {
  // Substring matching, so accent1-20 and heading1 both land here. These colours
  // differ from useHomeCommands' — the two paths are not interchangeable.
  it.each([
    ['cell-style:accent1-20', '#D9E1F2', '#002060'],
    ['cell-style:good-legacy', '#C6EFCE', '#006100'],
    ['cell-style:bad-legacy', '#FFC7CE', '#9C0006'],
    ['cell-style:neutral-legacy', '#FFEB9C', '#9C6500'],
  ])('%s applies its background and colour', (cmd, bg, fg) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx)
    expect(r.setBackground).toHaveBeenCalledWith(bg)
    expect(r.setFontColor).toHaveBeenCalledWith(fg)
  })

  it.each([
    ['cell-style:title-legacy', 18],
    ['cell-style:heading1', 15],
  ])('%s sets size %s with the legacy blue', (cmd, size) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(size)
    expect(r.setFontColor).toHaveBeenCalledWith('#1F497D')
  })

  it('total underlines rather than shading', () => {
    const { ctx, r } = makeCtx()
    handle('cell-style:total-legacy', ctx)
    expect(r.setFontWeight).toHaveBeenCalledWith('bold')
    expect(r.setFontLine).toHaveBeenCalledWith('underline')
    expect(r.setBackground).not.toHaveBeenCalled()
  })

  it('falls back to grey for an unrecognised style name', () => {
    const { ctx, r } = makeCtx()
    handle('cell-style:whatever', ctx)
    expect(r.setBackground).toHaveBeenCalledWith('#F2F2F2')
    expect(status()).toBe('已应用单元格样式: whatever')
  })
})

describe('format-as-table with a style suffix', () => {
  // Styles cell by cell, unlike the Home tab's bare format-as-table which works
  // by row range, and uses a different palette.
  it('styles the header and stripes the body cell by cell', () => {
    const { ctx, worksheet, sheetCells } = makeCtx({
      getRow: () => 0,
      getColumn: () => 0,
      getWidth: () => 2,
      getHeight: () => 3,
    })

    handle('format-as-table:TableStyleLight1', ctx)

    // 2 header cells + 2 rows x 2 columns
    expect(worksheet.getRange).toHaveBeenCalledTimes(6)
    expect(sheetCells[0]?.setBackground).toHaveBeenCalledWith('#4472C4')
    expect(sheetCells[0]?.setFontWeight).toHaveBeenCalledWith('bold')
    expect(sheetCells[2]?.setBackground).toHaveBeenCalledWith('#D9E1F2')
    expect(sheetCells[4]?.setBackground).toHaveBeenCalledWith('#FFFFFF')
    expect(status()).toBe('已套用表格样式: TableStyleLight1')
  })
})

describe('theme commands', () => {
  // Theme switching is not implemented; these only report.
  it.each(['theme:office', 'colors:blue', 'fonts:calibri', 'effects:subtle'])(
    '%s only reports',
    (cmd) => {
      const { ctx, r } = makeCtx()
      handle(cmd, ctx)
      expect(status()).toBe(`已切换主题方案: ${cmd}`)
      expect(r.setBackground).not.toHaveBeenCalled()
    },
  )
})

describe('fn-cat', () => {
  it.each([
    ['financial', '=PMT(0.05/12, 360, 1000000)'],
    ['logical', '=IF(A1>0, "Pass", "Fail")'],
    ['datetime', '=TODAY()'],
    ['math', '=ROUND(A1, 2)'],
  ])('%s inserts its sample formula', (cat, formula) => {
    const { ctx, r } = makeCtx()
    handle(`fn-cat:${cat}`, ctx)
    expect(r.setValue).toHaveBeenCalledWith(formula)
    expect(status()).toBe(`已插入 ${cat} 类别函数: ${formula}`)
  })

  it('falls back to SUM for an unknown category', () => {
    const { ctx, r } = makeCtx()
    handle('fn-cat:nonexistent', ctx)
    expect(r.setValue).toHaveBeenCalledWith('=SUM(A1:A10)')
  })
})

describe('what-if', () => {
  it('opens the goal-seek dialog', () => {
    const { ctx } = makeCtx()
    handle('what-if:goal-seek', ctx)
    expect(useDialogStore.getState().activeDialog).toBe('goal-seek')
  })

  it('only reports for the other scenarios', () => {
    const { ctx } = makeCtx()
    handle('what-if:data-table', ctx)
    expect(useDialogStore.getState().activeDialog).toBeNull()
    expect(status()).toBe('模拟分析: data-table')
  })
})

describe('row-height and col-width prefixes', () => {
  // Points to pixels at 96 DPI.
  it('converts points to pixels', () => {
    const { ctx, worksheet } = makeCtx({ getRow: () => 3 })
    handle('row-height:30', ctx)
    expect(worksheet.setRowHeightsForced).toHaveBeenCalledWith(3, 1, 40)
    expect(status()).toBe('行高已设置为: 30 磅')
  })

  it('converts characters to an approximate pixel width', () => {
    const { ctx, worksheet } = makeCtx({ getColumn: () => 1 })
    handle('col-width:10', ctx)
    expect(worksheet.setColumnWidth).toHaveBeenCalledWith(1, 80)
    expect(status()).toBe('列宽已设置为: 10 字符')
  })

  it.each([
    ['row-height:abc'],
    ['row-height:0'],
    ['row-height:-5'],
  ])('%s is ignored but still claimed', (cmd) => {
    const { ctx, worksheet } = makeCtx()
    expect(handle(cmd, ctx)).toBe(true)
    expect(worksheet.setRowHeightsForced).not.toHaveBeenCalled()
    expect(status()).toBe('就绪')
  })

  it.each([
    ['col-width:abc'],
    ['col-width:0'],
  ])('%s is ignored but still claimed', (cmd) => {
    const { ctx, worksheet } = makeCtx()
    expect(handle(cmd, ctx)).toBe(true)
    expect(worksheet.setColumnWidth).not.toHaveBeenCalled()
  })
})
