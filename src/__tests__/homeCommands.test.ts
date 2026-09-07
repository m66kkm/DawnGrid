import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomeCommands } from '../home/useHomeCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialDialogs = useDialogStore.getState()

let promptResult: string | null = null
const originalPrompt = window.prompt

function makeCtx(rangeOverrides: Record<string, unknown> = {}, sheetOverrides: Record<string, unknown> = {}) {
  const r = {
    setFontWeight: vi.fn(),
    setFontStyle: vi.fn(),
    setFontLine: vi.fn(),
    setFontFamily: vi.fn(),
    setFontSize: vi.fn(),
    setFontColor: vi.fn(),
    setBackground: vi.fn(),
    setBorder: vi.fn(),
    setValue: vi.fn(),
    setHorizontalAlignment: vi.fn(),
    setVerticalAlignment: vi.fn(),
    setWrap: vi.fn(),
    setTextRotation: vi.fn(),
    setNumberFormat: vi.fn(),
    merge: vi.fn(),
    mergeAcross: vi.fn(),
    breakApart: vi.fn(),
    clear: vi.fn(),
    getCellStyleData: () => ({}),
    getFontSize: () => 11,
    getWrap: () => false,
    getRow: () => 2,
    getColumn: () => 1,
    getWidth: () => 2,
    getHeight: () => 3,
    ...rangeOverrides,
  }
  const executeCommand = vi.fn()
  const sheetRanges: Array<Record<string, ReturnType<typeof vi.fn>>> = []
  const worksheet = {
    getRowHeight: () => 24,
    getColumnWidth: () => 80,
    setRowHeightsForced: vi.fn(),
    setColumnWidth: vi.fn(),
    insertRowsBefore: vi.fn(),
    deleteRows: vi.fn(),
    insertColumnsBefore: vi.fn(),
    deleteColumns: vi.fn(),
    getRange: vi.fn(() => {
      const sub = {
        setBackground: vi.fn(),
        setFontColor: vi.fn(),
        setFontWeight: vi.fn(),
      }
      sheetRanges.push(sub)
      return sub
    }),
    ...sheetOverrides,
  }
  const ctx: CommandContext = {
    runtime: { univerAPI: { executeCommand, Enum: undefined } } as never,
    workbook: {},
    worksheet,
    range: r,
  }
  return { ctx, r, worksheet, executeCommand, sheetRanges }
}

const handle = useHomeCommands()
const status = () => useDocumentStore.getState().status

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  promptResult = null
  ;(window as unknown as { prompt: () => string | null }).prompt = () => promptResult
})

afterEach(() => {
  ;(window as unknown as { prompt: typeof originalPrompt }).prompt = originalPrompt
})

describe('home command routing', () => {
  it('claims every home command', () => {
    const commands = [
      'bold', 'italic', 'underline', 'underline:double', 'strike',
      'font-family', 'font-size', 'font-color', 'fill', 'border',
      'font-size-inc', 'font-size-dec',
      'align', 'valign', 'wrap', 'rotate', 'merge',
      'format', 'decimal-inc', 'decimal-dec',
      'cf-open', 'format-as-table',
      'paste', 'cut', 'copy', 'format-painter',
      'clear-all', 'clear-formats', 'clear-contents',
      'fill-down', 'fill-right', 'find', 'replace', 'goto-open',
      'format-cells', 'format-menu', 'row-height-open', 'col-width-open',
      'insert-row-here', 'delete-row-here', 'insert-col-here', 'delete-col-here',
      'hide-row', 'unhide-row',
      'paste-special:value', 'cell-style:good',
    ]
    for (const cmd of commands) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx, 'arg'), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['zoom-in', 'insert-chart:pie', 'ai-chat', '']) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })

  // Unknown suffixes fall through so App's legacy fallback still sees them.
  it('passes on unknown cell-style and paste-special suffixes', () => {
    const { ctx } = makeCtx()
    expect(handle('cell-style:heading1', ctx)).toBe(false)
    expect(handle('paste-special:nonexistent', ctx)).toBe(false)
  })
})

describe('font toggles', () => {
  // These read the current style back from the cell rather than tracking it.
  it.each([
    ['bold', { bl: 1 }, 'setFontWeight', '已取消加粗'],
    ['italic', { it: 1 }, 'setFontStyle', '已取消斜体'],
    ['underline', { ul: { s: 1 } }, 'setFontLine', '已取消下划线'],
  ])('%s clears the style when already applied', (cmd, style, setter, message) => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => style })
    handle(cmd, ctx)
    expect(r[setter as keyof typeof r]).toHaveBeenCalledWith(null)
    expect(status()).toBe(message)
  })

  it.each([
    ['bold', 'setFontWeight', 'bold', '已设置加粗'],
    ['italic', 'setFontStyle', 'italic', '已设置斜体'],
    ['underline', 'setFontLine', 'underline', '已设置下划线'],
  ])('%s applies the style when absent', (cmd, setter, value, message) => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({}) })
    handle(cmd, ctx)
    expect(r[setter as keyof typeof r]).toHaveBeenCalledWith(value)
    expect(status()).toBe(message)
  })

  it('strike toggles through setValue', () => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({ st: { s: 1 } }) })
    handle('strike', ctx)
    expect(r.setValue).toHaveBeenCalledWith({ s: { st: null } })
    expect(status()).toBe('已取消删除线')
  })

  // Unlike the single variant, double underline only ever sets.
  it('underline:double always applies', () => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({ ul: { s: 1 } }) })
    handle('underline:double', ctx)
    expect(r.setValue).toHaveBeenCalledWith({ s: { ul: { s: 1, t: 10 } } })
  })
})

describe('font size stepping', () => {
  it('increments from the current size', () => {
    const { ctx, r } = makeCtx({ getFontSize: () => 12 })
    handle('font-size-inc', ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(13)
    expect(status()).toBe('字号已增大至: 13pt')
  })

  it('decrements from the current size', () => {
    const { ctx, r } = makeCtx({ getFontSize: () => 12 })
    handle('font-size-dec', ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(11)
  })

  it('clamps the decrement at 8pt', () => {
    const { ctx, r } = makeCtx({ getFontSize: () => 8 })
    handle('font-size-dec', ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(8)
  })

  it('treats a missing size as 11pt', () => {
    const { ctx, r } = makeCtx({ getFontSize: () => 0 })
    handle('font-size-inc', ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(12)
  })
})

describe('argument-driven setters', () => {
  it.each([
    ['font-family', 'Arial', 'setFontFamily', 'Arial'],
    ['font-color', '#FF0000', 'setFontColor', '#FF0000'],
    ['fill', '#00FF00', 'setBackground', '#00FF00'],
  ])('%s forwards its argument', (cmd, arg, setter, expected) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx, arg)
    expect(r[setter as keyof typeof r]).toHaveBeenCalledWith(expected)
  })

  it('font-size coerces to a number', () => {
    const { ctx, r } = makeCtx()
    handle('font-size', ctx, '14')
    expect(r.setFontSize).toHaveBeenCalledWith(14)
  })

  it.each(['font-family', 'font-size', 'font-color', 'fill', 'format', 'align', 'valign'])(
    '%s does nothing without an argument',
    (cmd) => {
      const { ctx } = makeCtx()
      handle(cmd, ctx)
      expect(status()).toBe('就绪')
    },
  )
})

describe('alignment', () => {
  // 'right' maps to 'normal' for the default text direction.
  it('maps right to normal', () => {
    const { ctx, r } = makeCtx()
    handle('align', ctx, 'right')
    expect(r.setHorizontalAlignment).toHaveBeenCalledWith('normal')
    expect(status()).toBe('水平对齐: right')
  })

  it('passes other alignments through', () => {
    const { ctx, r } = makeCtx()
    handle('align', ctx, 'center')
    expect(r.setHorizontalAlignment).toHaveBeenCalledWith('center')
  })

  it('wrap toggles from the current state', () => {
    const { ctx, r } = makeCtx({ getWrap: () => true })
    handle('wrap', ctx)
    expect(r.setWrap).toHaveBeenCalledWith(false)
    expect(status()).toBe('已关闭自动换行')
  })
})

describe('rotate', () => {
  it('applies the requested angle', () => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({ tr: { a: 0 } }) })
    handle('rotate', ctx, 45)
    expect(r.setTextRotation).toHaveBeenCalledWith(45)
  })

  // Applying the same angle twice clears the rotation.
  it('clears when the angle already matches', () => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({ tr: { a: 45 } }) })
    handle('rotate', ctx, 45)
    expect(r.setTextRotation).toHaveBeenCalledWith(0)
    expect(status()).toBe('文本旋转度: 0°')
  })

  it('defaults to 45 degrees', () => {
    const { ctx, r } = makeCtx({ getCellStyleData: () => ({}) })
    handle('rotate', ctx)
    expect(r.setTextRotation).toHaveBeenCalledWith(45)
  })
})

describe('merge', () => {
  it('merges and centres by default', () => {
    const { ctx, r } = makeCtx()
    handle('merge', ctx)
    expect(r.merge).toHaveBeenCalled()
    expect(r.setHorizontalAlignment).toHaveBeenCalledWith('center')
  })

  it('merges across without centring', () => {
    const { ctx, r } = makeCtx()
    handle('merge', ctx, 'across')
    expect(r.mergeAcross).toHaveBeenCalled()
    expect(r.setHorizontalAlignment).not.toHaveBeenCalled()
  })

  it('unmerges', () => {
    const { ctx, r } = makeCtx()
    handle('merge', ctx, 'unmerge')
    expect(r.breakApart).toHaveBeenCalled()
  })

  it('merges without centring for the cells mode', () => {
    const { ctx, r } = makeCtx()
    handle('merge', ctx, 'cells')
    expect(r.merge).toHaveBeenCalled()
    expect(r.setHorizontalAlignment).not.toHaveBeenCalled()
  })
})

describe('border', () => {
  // With no Enum on the facade, the string fallbacks apply.
  it('uses string fallbacks and reports the type', () => {
    const { ctx, r } = makeCtx()
    handle('border', ctx, 'outer', '#123456')
    expect(r.setBorder).toHaveBeenCalledWith('outside', 1, '#123456')
    expect(status()).toBe('边框已设置: outer')
  })

  // thick-outer is the ALL type at MEDIUM weight, not its own border type.
  it('renders thick-outer as the all type at medium weight', () => {
    const { ctx, r } = makeCtx()
    handle('border', ctx, 'thick-outer')
    expect(r.setBorder).toHaveBeenCalledWith('all', 2, '#000000')
  })

  it('falls back to the Univer command when setBorder throws', () => {
    const { ctx, executeCommand } = makeCtx({
      setBorder: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })
    handle('border', ctx, 'all', '#000000')
    expect(executeCommand).toHaveBeenCalledWith('sheet.command.set-border', {
      type: 'all',
      color: '#000000',
    })
    expect(status()).toBe('边框已设置: all')
  })
})

describe('clipboard', () => {
  it.each([
    ['paste', 'univer.command.paste'],
    ['cut', 'univer.command.cut'],
    ['copy', 'univer.command.copy'],
    ['format-painter', 'sheet.command.set-once-format-painter'],
    ['fill-down', 'sheet.command.copy-down'],
    ['fill-right', 'sheet.command.copy-right'],
    ['find', 'ui.operation.open-find-dialog'],
    ['replace', 'ui.operation.open-find-dialog'],
    ['decimal-inc', 'sheet.command.numfmt.add.decimal.command'],
    ['decimal-dec', 'sheet.command.numfmt.subtract.decimal.command'],
    ['cf-open', 'sheet.command.open-conditional-formatting-panel'],
  ])('%s delegates to %s', (cmd, univerCmd) => {
    const { ctx, executeCommand } = makeCtx()
    handle(cmd, ctx)
    expect(executeCommand).toHaveBeenCalledWith(univerCmd)
  })

  // Find and replace share a dialog; only the status differs.
  it.each([
    ['find', '查找'],
    ['replace', '替换'],
  ])('%s reports %s', (cmd, message) => {
    const { ctx } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
  })

  it.each([
    ['paste-special:value', 'sheet.command.paste-value', '仅粘贴数值'],
    ['paste-special:formula', 'sheet.command.paste-formula', '仅粘贴公式'],
    ['paste-special:format', 'sheet.command.paste-format', '仅粘贴格式'],
    ['paste-special:col-width', 'sheet.command.paste-col-width', '保持源列宽'],
    ['paste-special:besides-border', 'sheet.command.paste-besides-border', '除边框外的所有内容'],
  ])('%s delegates and reports', (cmd, univerCmd, message) => {
    const { ctx, executeCommand } = makeCtx()
    handle(cmd, ctx)
    expect(executeCommand).toHaveBeenCalledWith(univerCmd)
    expect(status()).toBe(message)
  })
})

describe('clear', () => {
  it('clear-all clears everything', () => {
    const { ctx, r } = makeCtx()
    handle('clear-all', ctx)
    expect(r.clear).toHaveBeenCalledWith()
  })

  it.each([
    ['clear-formats', 'format'],
    ['clear-contents', 'value'],
  ])('%s clears only %s', (cmd, kind) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx)
    expect(r.clear).toHaveBeenCalledWith(kind)
  })

  it('clear-contents falls back to setValue(null)', () => {
    const { ctx, r } = makeCtx({
      clear: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })
    handle('clear-contents', ctx)
    expect(r.setValue).toHaveBeenCalledWith(null)
  })

  it('clear-formats swallows a failure without falling back', () => {
    const { ctx, r } = makeCtx({
      clear: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })
    expect(() => handle('clear-formats', ctx)).not.toThrow()
    expect(r.setValue).not.toHaveBeenCalled()
    expect(status()).toBe('已清除单元格格式')
  })
})

describe('cell styles', () => {
  it.each([
    ['cell-style:good', '#C6EFCE', '#006100', '好'],
    ['cell-style:bad', '#FFC7CE', '#9C0006', '差'],
    ['cell-style:neutral', '#FFEB9C', '#9C6500', '适中'],
    ['cell-style:input', '#FCE4D6', '#C00000', '输入'],
  ])('%s applies its background and colour', (cmd, bg, fg, label) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx)
    expect(r.setBackground).toHaveBeenCalledWith(bg)
    expect(r.setFontColor).toHaveBeenCalledWith(fg)
    expect(status()).toBe(`已应用单元格样式: ${label}`)
  })

  it.each([
    ['cell-style:title', 18],
    ['cell-style:heading-1', 15],
    ['cell-style:heading-2', 13],
  ])('%s sets size %s and bold', (cmd, size) => {
    const { ctx, r } = makeCtx()
    handle(cmd, ctx)
    expect(r.setFontSize).toHaveBeenCalledWith(size)
    expect(r.setFontWeight).toHaveBeenCalledWith('bold')
  })

  it('warning-text sets only the colour', () => {
    const { ctx, r } = makeCtx()
    handle('cell-style:warning-text', ctx)
    expect(r.setFontColor).toHaveBeenCalledWith('#FF0000')
    expect(r.setBackground).not.toHaveBeenCalled()
  })

  // accent1, accent1-20 and accent1-40 share one style.
  it.each(['cell-style:accent1', 'cell-style:accent1-20', 'cell-style:accent1-40'])(
    '%s uses the shared accent style',
    (cmd) => {
      const { ctx, r } = makeCtx()
      handle(cmd, ctx)
      expect(r.setBackground).toHaveBeenCalledWith('#E7EEF8')
      expect(r.setFontColor).toHaveBeenCalledWith('#1E4E79')
      expect(status()).toBe('已应用主题单元格样式')
    },
  )
})

describe('format-as-table', () => {
  it('styles the header row and stripes the body', () => {
    const { ctx, worksheet, sheetRanges } = makeCtx({
      getRow: () => 0,
      getColumn: () => 0,
      getHeight: () => 3,
      getWidth: () => 2,
    })

    handle('format-as-table', ctx)

    // One call for the header, then one per body row.
    expect(worksheet.getRange).toHaveBeenCalledTimes(3)
    expect(sheetRanges[0]?.setBackground).toHaveBeenCalledWith('#217346')
    expect(sheetRanges[0]?.setFontWeight).toHaveBeenCalledWith('bold')
    expect(sheetRanges[1]?.setBackground).toHaveBeenCalledWith('#FFFFFF')
    expect(sheetRanges[2]?.setBackground).toHaveBeenCalledWith('#F2F7F4')
  })
})

describe('row and column operations', () => {
  it('insert-row-here inserts before the current row', () => {
    const { ctx, worksheet } = makeCtx({ getRow: () => 4 })
    handle('insert-row-here', ctx)
    expect(worksheet.insertRowsBefore).toHaveBeenCalledWith(4, 1)
    expect(status()).toBe('在第 5 行前插入新行')
  })

  it('delete-col-here reports the column letter', () => {
    const { ctx, worksheet } = makeCtx({ getColumn: () => 2 })
    handle('delete-col-here', ctx)
    expect(worksheet.deleteColumns).toHaveBeenCalledWith(2, 1)
    expect(status()).toBe('已删除第 C 列')
  })

  // Hiding is a zero row height, so unhide restores the default rather than the
  // row's previous height.
  it.each([
    ['hide-row', 0, '已隐藏第 3 行'],
    ['unhide-row', 24, '已取消隐藏第 3 行'],
  ])('%s sets the height to %s', (cmd, height, message) => {
    const { ctx, worksheet } = makeCtx({ getRow: () => 2 })
    handle(cmd, ctx)
    expect(worksheet.setRowHeightsForced).toHaveBeenCalledWith(2, 1, height)
    expect(status()).toBe(message)
  })

  it('row-height-open applies the prompted value', () => {
    promptResult = '30'
    const { ctx, worksheet } = makeCtx({ getRow: () => 1 })
    handle('row-height-open', ctx)
    expect(worksheet.setRowHeightsForced).toHaveBeenCalledWith(1, 1, 30)
  })

  it.each([
    ['row-height-open', null],
    ['row-height-open', 'abc'],
  ])('%s ignores a cancelled or non-numeric response', (cmd, response) => {
    promptResult = response
    const { ctx, worksheet } = makeCtx()
    handle(cmd, ctx)
    expect(worksheet.setRowHeightsForced).not.toHaveBeenCalled()
  })

  it('col-width-open applies the prompted value', () => {
    promptResult = '120'
    const { ctx, worksheet } = makeCtx({ getColumn: () => 1 })
    handle('col-width-open', ctx)
    expect(worksheet.setColumnWidth).toHaveBeenCalledWith(1, 120)
    expect(status()).toBe('第 B 列列宽已设为: 120')
  })
})

describe('dialog openers', () => {
  it.each([
    ['goto-open', 'goto'],
    ['format-cells', 'format-cells'],
    ['format-menu', 'format-cells'],
  ])('%s opens %s', (cmd, dialog) => {
    const { ctx } = makeCtx()
    handle(cmd, ctx)
    expect(useDialogStore.getState().activeDialog).toBe(dialog)
  })
})
