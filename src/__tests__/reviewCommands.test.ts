import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReviewCommands } from '../review/useReviewCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import { useViewStore } from '../store/viewSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialView = useViewStore.getState()
const initialDialogs = useDialogStore.getState()

function makeCtx(opts: {
  snapshot?: unknown
  saveThrows?: boolean
  cellValue?: unknown
  noteApi?: boolean
  noteThrows?: boolean
} = {}) {
  const setValue = vi.fn()
  const createOrUpdateNote = vi.fn(() => {
    if (opts.noteThrows) throw new Error('unsupported')
  })
  const deleteNote = vi.fn(() => {
    if (opts.noteThrows) throw new Error('unsupported')
  })

  const range: Record<string, unknown> = {
    getValue: () => opts.cellValue ?? '',
    setValue,
  }
  if (opts.noteApi !== false) {
    range.createOrUpdateNote = createOrUpdateNote
    range.deleteNote = deleteNote
  }

  const ctx: CommandContext = {
    runtime: {} as never,
    workbook: {
      save: vi.fn(() => {
        if (opts.saveThrows) throw new Error('snapshot failed')
        return opts.snapshot ?? { sheets: {} }
      }),
    },
    worksheet: {
      getMaxRows: () => 100,
      getMaxColumns: () => 30,
    },
    range,
  }
  return { ctx, setValue, createOrUpdateNote, deleteNote }
}

const handle = useReviewCommands()
const status = () => useDocumentStore.getState().status

// happy-dom does not implement window.prompt, so vi.spyOn has nothing to wrap.
// Install a stub directly and reset it between tests.
let promptResult: string | null = null
const originalPrompt = window.prompt
function stubPrompt(result: string | null) {
  promptResult = result
}

beforeEach(() => {
  useDocumentStore.setState({ status: '就绪' })
  useViewStore.setState({ ...initialView })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  promptResult = null
  ;(window as unknown as { prompt: (m?: string, d?: string) => string | null }).prompt = () =>
    promptResult
})

afterEach(() => {
  vi.restoreAllMocks()
  ;(window as unknown as { prompt: typeof originalPrompt }).prompt = originalPrompt
})

describe('review command routing', () => {
  it('claims every review command', () => {
    const commands = [
      'sheet-protect', 'workbook-protect', 'allow-edit-ranges', 'spellcheck',
      'workbook-statistics',
      'translate:zh', 'translate:en', 'translate:dialog',
      'note-open', 'comment-new', 'note-delete', 'comment-delete',
      'note-prev', 'comment-prev', 'note-next', 'comment-next',
      'note-show-toggle', 'comment-show',
    ]
    // window.prompt drives the note/translate dialogs; decline so nothing is written.
    stubPrompt(null)
    for (const cmd of commands) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'zoom-in', 'insert-chart:pie', 'translate', '']) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })
})

describe('protection', () => {
  it.each([
    ['sheet-protect', 'sheetProtected' as const, '工作表保护已生效（已限制未授权改动）', '工作表保护已取消'],
    ['workbook-protect', 'workbookProtected' as const, '工作簿结构保护已生效', '工作簿结构保护已取消'],
  ])('%s toggles both ways', (cmd, field, onMsg, offMsg) => {
    const { ctx } = makeCtx()

    handle(cmd, ctx)
    expect(useViewStore.getState()[field]).toBe(true)
    expect(status()).toBe(onMsg)

    handle(cmd, ctx)
    expect(useViewStore.getState()[field]).toBe(false)
    expect(status()).toBe(offMsg)
  })

  it('allow-edit-ranges opens its dialog', () => {
    const { ctx } = makeCtx()
    handle('allow-edit-ranges', ctx)
    expect(useDialogStore.getState().activeDialog).toBe('allow-edit-ranges')
  })
})

describe('workbook statistics', () => {
  it('counts non-empty values and formulas across sheets', () => {
    const { ctx } = makeCtx({
      snapshot: {
        sheets: {
          s1: {
            cellData: {
              0: { 0: { v: 'a' }, 1: { v: 1 }, 2: { f: '=SUM(A1)' } },
              1: { 0: { v: '' }, 1: { v: null }, 2: {} },
            },
          },
          s2: { cellData: { 0: { 0: { v: 0, f: '=1+1' } } } },
        },
      },
    })

    handle('workbook-statistics', ctx)

    // '' and null do not count; 0 does. Two formulas across the two sheets.
    expect(useDialogStore.getState().workbookStats).toEqual({
      sheetCount: 2,
      cellCount: 3,
      formulaCount: 2,
      rowCount: 100,
      colCount: 30,
    })
    expect(useDialogStore.getState().activeDialog).toBe('workbook-stats')
  })

  it('reports at least one sheet for an empty snapshot', () => {
    const { ctx } = makeCtx({ snapshot: { sheets: {} } })
    handle('workbook-statistics', ctx)
    expect(useDialogStore.getState().workbookStats.sheetCount).toBe(1)
    expect(useDialogStore.getState().workbookStats.cellCount).toBe(0)
  })

  // Carried over from the original: a failed snapshot still opens the dialog,
  // showing placeholder counts rather than an error.
  it('falls back to placeholder counts when the snapshot throws', () => {
    const { ctx } = makeCtx({ saveThrows: true })
    handle('workbook-statistics', ctx)
    expect(useDialogStore.getState().workbookStats).toEqual({
      sheetCount: 1,
      cellCount: 12,
      formulaCount: 2,
      rowCount: 100,
      colCount: 30,
    })
    expect(useDialogStore.getState().activeDialog).toBe('workbook-stats')
  })
})

describe('translation', () => {
  it.each([
    ['translate:zh', '中文'],
    ['translate:en', '英文'],
  ])('%s echoes the cell text', (cmd, lang) => {
    const { ctx } = makeCtx({ cellValue: '你好' })
    handle(cmd, ctx)
    expect(status()).toBe(`翻译结果 (${lang}): "你好"`)
  })

  it.each([
    ['translate:zh', '中文'],
    ['translate:en', '英文'],
  ])('%s asks for a selection when the cell is empty', (cmd, lang) => {
    const { ctx } = makeCtx({ cellValue: '' })
    handle(cmd, ctx)
    expect(status()).toBe(`翻译 (${lang})：请先选择包含文本的单元格`)
  })

  it('translate:dialog uses the prompt result', () => {
    stubPrompt('hello')
    const { ctx } = makeCtx()
    handle('translate:dialog', ctx)
    expect(status()).toBe('已翻译 "hello": Hello, World!')
  })

  it('translate:dialog leaves the status alone when cancelled', () => {
    stubPrompt(null)
    const { ctx } = makeCtx()
    handle('translate:dialog', ctx)
    expect(status()).toBe('就绪')
  })
})

describe('comments', () => {
  it('note-open writes through the note API when available', () => {
    stubPrompt('看过了')
    const { ctx, createOrUpdateNote, setValue } = makeCtx()

    handle('note-open', ctx)

    expect(createOrUpdateNote).toHaveBeenCalledWith({ note: '看过了' })
    expect(setValue).not.toHaveBeenCalled()
    expect(status()).toBe('已添加批注: "看过了"')
  })

  // The fallback appends the note into the cell text - lossy, but visible.
  it('note-open falls back to appending into the cell when the API throws', () => {
    stubPrompt('看过了')
    const { ctx, setValue } = makeCtx({ noteThrows: true, cellValue: '原值' })

    handle('note-open', ctx)

    expect(setValue).toHaveBeenCalledWith('原值 [批注: 看过了]')
    expect(status()).toBe('已添加批注: "看过了"')
  })

  it('note-open does nothing when the prompt is cancelled', () => {
    stubPrompt(null)
    const { ctx, createOrUpdateNote, setValue } = makeCtx()

    handle('note-open', ctx)

    expect(createOrUpdateNote).not.toHaveBeenCalled()
    expect(setValue).not.toHaveBeenCalled()
    expect(status()).toBe('就绪')
  })

  it('comment-new is an alias of note-open', () => {
    stubPrompt('ok')
    const { ctx, createOrUpdateNote } = makeCtx()
    handle('comment-new', ctx)
    expect(createOrUpdateNote).toHaveBeenCalledWith({ note: 'ok' })
  })

  it('note-delete calls through and reports', () => {
    const { ctx, deleteNote } = makeCtx()
    handle('note-delete', ctx)
    expect(deleteNote).toHaveBeenCalled()
    expect(status()).toBe('已删除当前单元格批注')
  })

  it('note-delete reports differently when the API throws', () => {
    const { ctx } = makeCtx({ noteThrows: true })
    handle('note-delete', ctx)
    expect(status()).toBe('批注已清除')
  })

  it('note-delete tolerates a range without the note API', () => {
    const { ctx } = makeCtx({ noteApi: false })
    expect(() => handle('note-delete', ctx)).not.toThrow()
    expect(status()).toBe('已删除当前单元格批注')
  })

  it.each([
    ['note-prev', '已跳转至上一条批注'],
    ['comment-prev', '已跳转至上一条批注'],
    ['note-next', '已跳转至下一条批注'],
    ['comment-next', '已跳转至下一条批注'],
    ['note-show-toggle', '已切换显示/隐藏所有批注框'],
    ['comment-show', '已切换显示/隐藏所有批注框'],
  ])('%s reports its message', (cmd, message) => {
    const { ctx } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
  })
})

describe('spellcheck', () => {
  it('reports success without inspecting anything', () => {
    const { ctx } = makeCtx()
    handle('spellcheck', ctx)
    expect(status()).toBe('拼写检查完毕：选区内文本拼写均正确')
  })
})
