import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInsertCommands } from '../insert/useInsertCommands'
import { useChartStore } from '../store/chartSlice'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import { useNotificationStore } from '../store/notificationSlice'
import type { CommandContext } from '../shared/commandTypes'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }))
vi.mock('../charts', () => ({ recommendCharts: vi.fn(() => ({ primary: 'column' })) }))

const { recommendCharts } = await import('../charts')

const initialDialogs = useDialogStore.getState()
const initialCharts = useChartStore.getState()

let promptResult: string | null = null
const originalPrompt = window.prompt

function makeCtx(rangeOverrides: Record<string, unknown> = {}) {
  const setValue = vi.fn()
  const setFontStyle = vi.fn()
  const setFontColor = vi.fn()
  const setFontLine = vi.fn()
  const setDataValidation = vi.fn()
  const build = vi.fn(() => ({ rule: true }))

  const ctx: CommandContext = {
    runtime: {
      univerAPI: {
        newDataValidation: () => ({ requireCheckbox: () => ({ build }) }),
      },
    } as never,
    workbook: {},
    worksheet: {},
    range: {
      getA1Notation: () => 'B2:D5',
      getValue: () => '',
      setValue,
      setFontStyle,
      setFontColor,
      setFontLine,
      setDataValidation,
      ...rangeOverrides,
    },
  }
  return { ctx, setValue, setFontStyle, setFontColor, setFontLine, setDataValidation }
}

const deps = {
  getFieldsFromRange: vi.fn(() => [{ name: 'A', colIndex: 0 } as never]),
  extractActiveChartValues: vi.fn(() => ({ values: [[1, 2]] })),
}
const handle = useInsertCommands(deps)
const status = () => useDocumentStore.getState().status

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  useChartStore.setState({ ...initialCharts })
  useNotificationStore.setState({ notification: null })
  promptResult = null
  ;(window as unknown as { prompt: () => string | null }).prompt = () => promptResult
})

describe('insert command routing', () => {
  it('claims every insert command', () => {
    const commands = [
      'pivot-edit', 'recommended-charts-open', 'insert-picture', 'insert-icons',
      'insert-screenshot', 'insert-checkbox', 'insert-textbox', 'link-open',
      'header-footer-open', 'insert-equation', 'insert-symbol',
      'slicer-open', 'timeline-open',
    ]
    for (const cmd of commands) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'zoom-in', 'insert', 'insert-chart:pie', '']) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })
})

describe('pivot-edit', () => {
  it('captures the fields and range, then opens the dialog', () => {
    const { ctx } = makeCtx({ getA1Notation: () => 'A1:C9' })
    handle('pivot-edit', ctx)

    expect(deps.getFieldsFromRange).toHaveBeenCalled()
    expect(useDialogStore.getState().dataFields).toEqual([{ name: 'A', colIndex: 0 }])
    expect(useDialogStore.getState().defaultRangeStr).toBe('A1:C9')
    expect(useDialogStore.getState().activeDialog).toBe('pivot')
  })
})

describe('recommended-charts-open', () => {
  it('opens the picker when a recommendation exists', () => {
    const { ctx } = makeCtx()
    handle('recommended-charts-open', ctx)

    expect(useChartStore.getState().recommendedData).toEqual({ primary: 'column' })
    expect(useDialogStore.getState().activeDialog).toBe('recommended-charts')
  })

  // Opening the picker for an unchartable selection offered layouts for a chart
  // that could not then be built.
  it('reports instead of opening when nothing can be recommended', () => {
    vi.mocked(recommendCharts).mockReturnValueOnce(null as never)
    const { ctx } = makeCtx()

    handle('recommended-charts-open', ctx)

    expect(useDialogStore.getState().activeDialog).toBeNull()
    expect(useNotificationStore.getState().notification?.title).toBe('无法推荐图表')
    expect(status()).toContain('至少包含一列有效数值')
  })
})

describe('checkbox', () => {
  it('applies a data-validation rule when available', () => {
    const { ctx, setDataValidation, setValue } = makeCtx()
    handle('insert-checkbox', ctx)

    expect(setDataValidation).toHaveBeenCalledWith({ rule: true })
    expect(setValue).not.toHaveBeenCalled()
    expect(status()).toBe('已插入交互式复选框')
  })

  it('falls back to a static glyph when validation is unavailable', () => {
    const { ctx, setValue } = makeCtx({
      setDataValidation: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })

    handle('insert-checkbox', ctx)

    expect(setValue).toHaveBeenCalledWith('☐')
    expect(status()).toBe('已插入复选框')
  })
})

describe('link-open', () => {
  it('writes and styles the url', () => {
    promptResult = 'https://example.com'
    const { ctx, setValue, setFontColor, setFontLine } = makeCtx()

    handle('link-open', ctx)

    expect(setValue).toHaveBeenCalledWith('https://example.com')
    expect(setFontColor).toHaveBeenCalledWith('#0563C1')
    expect(setFontLine).toHaveBeenCalledWith('underline')
    expect(status()).toBe('已插入超链接: https://example.com')
  })

  it('does nothing when cancelled', () => {
    promptResult = null
    const { ctx, setValue } = makeCtx()

    handle('link-open', ctx)

    expect(setValue).not.toHaveBeenCalled()
    expect(status()).toBe('就绪')
  })

  it('offers the current cell value as the default', () => {
    promptResult = 'ok'
    const prompts: Array<string | undefined> = []
    ;(window as unknown as { prompt: (m?: string, d?: string) => string | null }).prompt = (
      _m,
      d,
    ) => {
      prompts.push(d)
      return promptResult
    }

    const { ctx } = makeCtx({ getValue: () => 'https://existing.test' })
    handle('link-open', ctx)

    expect(prompts[0]).toBe('https://existing.test')
  })
})

describe('placeholder inserts', () => {
  // These write text into the cell rather than inserting a real object; Univer
  // exposes no text-box or equation primitive here.
  it('insert-textbox writes prompt text in italics', () => {
    const { ctx, setValue, setFontStyle } = makeCtx()
    handle('insert-textbox', ctx)
    expect(setValue).toHaveBeenCalledWith('请输入文本内容...')
    expect(setFontStyle).toHaveBeenCalledWith('italic')
  })

  it('insert-equation writes a formula string in italics', () => {
    const { ctx, setValue, setFontStyle } = makeCtx()
    handle('insert-equation', ctx)
    expect(vi.mocked(setValue).mock.calls[0]?.[0]).toContain('f(x)')
    expect(setFontStyle).toHaveBeenCalledWith('italic')
  })

  it('insert-icons writes a star', () => {
    const { ctx, setValue } = makeCtx()
    handle('insert-icons', ctx)
    expect(setValue).toHaveBeenCalledWith('⭐')
  })

  it.each([
    ['insert-screenshot', '已截取当前屏幕画面并嵌入工作表'],
    ['timeline-open', '已为日期列创建时间线筛选器'],
  ])('%s only reports', (cmd, message) => {
    const { ctx, setValue } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
    expect(setValue).not.toHaveBeenCalled()
  })

  it('slicer-open reports the selection', () => {
    const { ctx } = makeCtx({ getA1Notation: () => 'A1:B4' })
    handle('slicer-open', ctx)
    expect(status()).toBe('已为当前选区 A1:B4 生成交互式数据切片器')
  })
})

describe('dialog openers', () => {
  it.each([
    ['header-footer-open', 'header-footer'],
    ['insert-symbol', 'symbol'],
  ])('%s opens %s', (cmd, dialog) => {
    const { ctx } = makeCtx()
    handle(cmd, ctx)
    expect(useDialogStore.getState().activeDialog).toBe(dialog)
  })
})

afterEach(() => {
  ;(window as unknown as { prompt: typeof originalPrompt }).prompt = originalPrompt
})
