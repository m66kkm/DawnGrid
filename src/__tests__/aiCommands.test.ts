import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiCommands } from '../shared/useAiCommands'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialDialogs = useDialogStore.getState()

/** Builds a worksheet whose cells come from a row-major grid of raw values. */
function makeCtx(grid: unknown[][] = [], maxRows = grid.length) {
  const ctx: CommandContext = {
    runtime: {} as never,
    workbook: {},
    worksheet: {
      getMaxRows: () => maxRows,
      getRange: (r: number, c: number) => ({
        getValue: () => grid[r]?.[c] ?? null,
      }),
    },
    range: {},
  }
  return ctx
}

const status = () => useDocumentStore.getState().status

beforeEach(() => {
  useDocumentStore.setState({ status: '就绪' })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null, analysisSummary: null })
})

describe('ai command routing', () => {
  it('claims every ai command', () => {
    const dispatch = vi.fn()
    const handle = useAiCommands(dispatch)
    for (const cmd of ['ai-chat', 'ai-check', 'ai-analyze']) {
      expect(handle(cmd, makeCtx()), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    const handle = useAiCommands(vi.fn())
    for (const cmd of ['bold', 'zoom-in', 'ai', 'error-checking', '']) {
      expect(handle(cmd, makeCtx()), cmd).toBe(false)
    }
  })
})

describe('ai-chat', () => {
  it('just opens the assistant', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-chat', makeCtx())
    expect(useDialogStore.getState().activeDialog).toBe('ai')
    expect(status()).toBe('就绪')
  })
})

describe('ai-check', () => {
  // Crosses domains: error-checking lives on the formula tab, so this handler
  // re-enters the dispatcher rather than duplicating the logic.
  it('delegates to error-checking, then opens the assistant', () => {
    const dispatch = vi.fn()
    const handle = useAiCommands(dispatch)

    handle('ai-check', makeCtx())

    expect(dispatch).toHaveBeenCalledWith('error-checking')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(useDialogStore.getState().activeDialog).toBe('ai')
  })
})

describe('ai-analyze', () => {
  it('sums and averages the numeric cells', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([[10, 20], [30, 40]]))

    const summary = useDialogStore.getState().analysisSummary
    expect(summary).toContain('4 个有效数值单元格')
    expect(summary).toContain('总计 100')
    expect(summary).toContain('均值约 25.00')
    expect(status()).toBe(summary)
    expect(useDialogStore.getState().activeDialog).toBe('ai')
  })

  // Zero is skipped along with blanks and text, so it shifts the average rather
  // than lowering it. Documented because it is surprising, not because it is right.
  it('excludes zeroes from both the count and the sum', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([[10, 0], [0, 30]]))

    const summary = useDialogStore.getState().analysisSummary
    expect(summary).toContain('2 个有效数值单元格')
    expect(summary).toContain('总计 40')
    expect(summary).toContain('均值约 20.00')
  })

  it('ignores text and blank cells', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([['abc', null], [undefined, 5]]))

    const summary = useDialogStore.getState().analysisSummary
    expect(summary).toContain('1 个有效数值单元格')
    expect(summary).toContain('总计 5')
  })

  it('reports zero for a sheet with nothing numeric', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([['a', 'b']]))

    const summary = useDialogStore.getState().analysisSummary
    expect(summary).toContain('0 个有效数值单元格')
    expect(summary).toContain('总计 0')
    expect(summary).toContain('均值约 0')
  })

  it('handles negative values', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([[-10, 20]]))

    const summary = useDialogStore.getState().analysisSummary
    expect(summary).toContain('2 个有效数值单元格')
    expect(summary).toContain('总计 10')
  })

  // Bounded scan: a taller sheet is sampled, not walked in full.
  it('samples at most 100 rows', () => {
    const grid = Array.from({ length: 200 }, () => [1])
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx(grid, 200))

    expect(useDialogStore.getState().analysisSummary).toContain('100 个有效数值单元格')
  })

  it('stops at the sheet height when it is under the cap', () => {
    const handle = useAiCommands(vi.fn())
    handle('ai-analyze', makeCtx([[1], [2]], 2))

    expect(useDialogStore.getState().analysisSummary).toContain('2 个有效数值单元格')
  })
})
