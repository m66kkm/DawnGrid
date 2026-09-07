import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFormulaCommands } from '../formular/useFormulaCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import { useViewStore } from '../store/viewSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialDialogs = useDialogStore.getState()
const initialDoc = useDocumentStore.getState()
const initialView = useViewStore.getState()

vi.mock('../formular/autoSum', () => ({
  applyAutoSum: vi.fn(() => ({ success: true, message: '已插入 SUM 公式' })),
}))
vi.mock('../formular/calculation', () => ({
  calculateNow: vi.fn(() => ({ message: '已重算整个工作簿' })),
  calculateSheet: vi.fn(() => ({ message: '已重算当前工作表' })),
}))
vi.mock('../formular/definedNames', () => ({
  createNamesFromSelection: vi.fn(() => ({
    success: true,
    message: '已创建 2 个名称',
    updatedList: [{ name: 'X', ref: '=A1', scope: '工作簿' }],
  })),
}))
vi.mock('../formular/formulaAudit', () => ({
  tracePrecedents: vi.fn(() => ({ message: '已追踪引用单元格' })),
  traceDependents: vi.fn(() => ({ message: '已追踪从属单元格' })),
  clearAuditHighlights: vi.fn(),
  checkFormulaErrors: vi.fn(() => ({ message: '未发现公式错误' })),
}))

const { applyAutoSum } = await import('../formular/autoSum')
const { createNamesFromSelection } = await import('../formular/definedNames')
const { clearAuditHighlights } = await import('../formular/formulaAudit')

function makeCtx(rangeOverrides: Record<string, unknown> = {}): CommandContext {
  return {
    runtime: {} as never,
    workbook: {},
    worksheet: {},
    range: {
      getA1Notation: () => 'B2',
      getFormula: () => '',
      getValue: () => null,
      ...rangeOverrides,
    },
  }
}

const status = () => useDocumentStore.getState().status
let sync: () => void
let handle: ReturnType<typeof useFormulaCommands>

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ ...initialDoc, status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  useViewStore.setState({ ...initialView })
  sync = vi.fn<() => void>()
  handle = useFormulaCommands(sync)
})

describe('formula command routing', () => {
  it('claims every formula command', () => {
    const commands = [
      'insert-function-open', 'autofn', 'name-manager-open',
      'create-names:top', 'create-names:left',
      'trace-precedents', 'trace-dependents', 'remove-arrows',
      'toggle-show-formulas', 'watch-window',
      'calc-mode:auto', 'calc-mode:manual',
      'calculate-now', 'calculate-sheet', 'error-checking',
    ]
    for (const cmd of commands) {
      expect(handle(cmd, makeCtx()), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'zoom-in', 'ai-chat', 'calc-mode', '']) {
      expect(handle(cmd, makeCtx()), cmd).toBe(false)
    }
  })
})

describe('insert function', () => {
  it('opens the dialog with the requested category', () => {
    handle('insert-function-open', makeCtx(), 'Math')
    expect(useDialogStore.getState().insertFuncCategory).toBe('Math')
    expect(useDialogStore.getState().activeDialog).toBe('insert-function')
  })

  it('defaults the category to Common', () => {
    handle('insert-function-open', makeCtx())
    expect(useDialogStore.getState().insertFuncCategory).toBe('Common')
  })
})

describe('autofn', () => {
  // Auto-sum writes into the sheet, so the ribbon's format state has to catch up.
  it('applies the function and resyncs the selection', () => {
    handle('autofn', makeCtx(), 'AVERAGE')
    expect(applyAutoSum).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'AVERAGE')
    expect(status()).toBe('已插入 SUM 公式')
    expect(vi.mocked(sync)).toHaveBeenCalledTimes(1)
  })

  it('defaults to SUM', () => {
    handle('autofn', makeCtx())
    expect(applyAutoSum).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'SUM')
  })
})

describe('defined names', () => {
  it.each([
    ['create-names:top', 'top'],
    ['create-names:left', 'left'],
  ])('%s passes %s as the label source', (cmd, source) => {
    handle(cmd, makeCtx())
    expect(createNamesFromSelection).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      source,
      expect.anything(),
    )
  })

  it('stores the updated list on success', () => {
    handle('create-names:top', makeCtx())
    expect(useDocumentStore.getState().definedNames).toEqual([
      { name: 'X', ref: '=A1', scope: '工作簿' },
    ])
    expect(status()).toBe('已创建 2 个名称')
  })

  it('reports the message but keeps the list on failure', () => {
    vi.mocked(createNamesFromSelection).mockReturnValueOnce({
      success: false,
      message: '选区不含标签行',
      updatedList: [],
    } as never)
    const before = useDocumentStore.getState().definedNames

    handle('create-names:top', makeCtx())

    expect(useDocumentStore.getState().definedNames).toBe(before)
    expect(status()).toBe('选区不含标签行')
  })

  it('name-manager-open opens its dialog', () => {
    handle('name-manager-open', makeCtx())
    expect(useDialogStore.getState().activeDialog).toBe('name-manager')
  })
})

describe('auditing', () => {
  it.each([
    ['trace-precedents', '已追踪引用单元格'],
    ['trace-dependents', '已追踪从属单元格'],
  ])('%s reports its result', (cmd, message) => {
    handle(cmd, makeCtx())
    expect(status()).toBe(message)
  })

  it('remove-arrows clears the highlights', () => {
    handle('remove-arrows', makeCtx())
    expect(clearAuditHighlights).toHaveBeenCalled()
    expect(status()).toBe('已移去所有公式追踪高亮与箭头')
  })
})

describe('toggle-show-formulas', () => {
  // Reports the active cell rather than switching the sheet into formula view;
  // Univer has no such mode.
  it('reports the formula when the cell has one', () => {
    handle('toggle-show-formulas', makeCtx({ getFormula: () => '=SUM(A1:A9)' }))
    expect(status()).toBe('公式明细 (B2): =SUM(A1:A9)')
  })

  it('reports the value when the cell is static', () => {
    handle('toggle-show-formulas', makeCtx({ getFormula: () => '', getValue: () => 42 }))
    expect(status()).toBe('单元格 (B2) 为静态值: 42')
  })

  it('reports 空 for an empty static cell', () => {
    handle('toggle-show-formulas', makeCtx({ getFormula: () => '', getValue: () => null }))
    expect(status()).toBe('单元格 (B2) 为静态值: 空')
  })

  it('tolerates a range without getFormula', () => {
    const ctx = makeCtx()
    delete (ctx.range as Record<string, unknown>).getFormula
    expect(() => handle('toggle-show-formulas', ctx)).not.toThrow()
  })
})

describe('calculation', () => {
  it.each([
    ['calc-mode:manual', true, '计算选项已切换为: 手动计算'],
    ['calc-mode:auto', false, '计算选项已切换为: 自动计算'],
  ])('%s sets calcManual to %s', (cmd, expected, message) => {
    handle(cmd, makeCtx())
    expect(useViewStore.getState().calcManual).toBe(expected)
    expect(status()).toBe(message)
  })

  it.each([
    ['calculate-now', '已重算整个工作簿'],
    ['calculate-sheet', '已重算当前工作表'],
  ])('%s reports its result', (cmd, message) => {
    handle(cmd, makeCtx())
    expect(status()).toBe(message)
  })
})

describe('error-checking', () => {
  // The AI assistant reads diagnosticResult, so it must be stored, not just shown.
  it('stores the diagnostic as well as reporting it', () => {
    handle('error-checking', makeCtx())
    expect(useDialogStore.getState().diagnosticResult).toBe('未发现公式错误')
    expect(status()).toBe('未发现公式错误')
  })
})
