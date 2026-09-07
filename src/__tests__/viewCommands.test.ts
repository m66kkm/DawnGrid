import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useViewCommands } from '../view/useViewCommands'
import { useDocumentStore } from '../store/documentSlice'
import { useViewStore } from '../store/viewSlice'
import type { CommandContext } from '../shared/commandTypes'

const initialView = useViewStore.getState()

interface WorksheetStub {
  zoom: ReturnType<typeof vi.fn>
  getZoom: ReturnType<typeof vi.fn>
  setFreeze: ReturnType<typeof vi.fn>
  cancelFreeze: ReturnType<typeof vi.fn>
  hasHiddenGridLines: ReturnType<typeof vi.fn>
  setHiddenGridlines: ReturnType<typeof vi.fn>
  getSheet: ReturnType<typeof vi.fn>
}

function makeCtx(
  worksheetOverrides: Partial<WorksheetStub> = {},
  rangeOverrides: Record<string, unknown> = {},
) {
  const worksheet: WorksheetStub = {
    zoom: vi.fn(),
    getZoom: vi.fn(() => 1.0),
    setFreeze: vi.fn(),
    cancelFreeze: vi.fn(),
    hasHiddenGridLines: vi.fn(() => false),
    setHiddenGridlines: vi.fn(),
    getSheet: vi.fn(() => undefined),
    ...worksheetOverrides,
  }
  const ctx: CommandContext = {
    runtime: {} as never,
    workbook: {},
    worksheet,
    range: {
      getRow: () => 2,
      getColumn: () => 3,
      getWidth: () => 4,
      getHeight: () => 4,
      ...rangeOverrides,
    },
  }
  return { ctx, worksheet }
}

const handle = useViewCommands()
const status = () => useDocumentStore.getState().status

beforeEach(() => {
  useDocumentStore.setState({ status: '就绪' })
  useViewStore.setState({ ...initialView })
})

describe('view command routing', () => {
  it('claims every view command', () => {
    const commands = [
      'view-normal', 'view-page-break', 'view-page-layout', 'view-custom',
      'toggle-ruler', 'toggle-gridlines', 'print-gridlines', 'toggle-formula-bar',
      'toggle-cross-highlight', 'toggle-headings', 'print-headings',
      'zoom-in', 'zoom-out', 'zoom-reset', 'zoom:100', 'zoom:75', 'zoom:125',
      'zoom:200', 'zoom-to-selection',
      'freeze-here', 'freeze-top-row', 'freeze-first-col', 'unfreeze',
      'new-window', 'arrange-all', 'split-window', 'hide-window',
      'unhide-window', 'switch-windows',
    ]
    for (const cmd of commands) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'page-layout:size:A4', 'insert-chart:pie', 'zoom', '']) {
      const { ctx } = makeCtx()
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })
})

describe('zoom', () => {
  it.each([
    ['zoom:100', 1.0],
    ['zoom-reset', 1.0],
    ['zoom:75', 0.75],
    ['zoom:125', 1.25],
    ['zoom:200', 2.0],
  ])('%s zooms to %s', (cmd, level) => {
    const { ctx, worksheet } = makeCtx()
    handle(cmd, ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(level)
  })

  it('zoom-in steps up by 0.1 from the sheet zoom', () => {
    const { ctx, worksheet } = makeCtx({ getZoom: vi.fn(() => 1.0) })
    handle('zoom-in', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(1.1)
    expect(status()).toBe('视图缩放: 110%')
  })

  it('zoom-out steps down by 0.1', () => {
    const { ctx, worksheet } = makeCtx({ getZoom: vi.fn(() => 1.0) })
    handle('zoom-out', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(0.9)
  })

  it('clamps zoom-in at 4.0', () => {
    const { ctx, worksheet } = makeCtx({ getZoom: vi.fn(() => 3.95) })
    handle('zoom-in', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(4.0)
  })

  it('clamps zoom-out at 0.25', () => {
    const { ctx, worksheet } = makeCtx({ getZoom: vi.fn(() => 0.3) })
    handle('zoom-out', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(0.25)
  })

  it('treats a falsy sheet zoom as 1.0', () => {
    const { ctx, worksheet } = makeCtx({ getZoom: vi.fn(() => 0) })
    handle('zoom-in', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(1.1)
  })

  it('zoom-to-selection scales inversely with the larger dimension', () => {
    const { ctx, worksheet } = makeCtx({}, { getWidth: () => 8, getHeight: () => 4 })
    handle('zoom-to-selection', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(1)
  })

  it('zoom-to-selection clamps a large selection to 0.5', () => {
    const { ctx, worksheet } = makeCtx({}, { getWidth: () => 100, getHeight: () => 100 })
    handle('zoom-to-selection', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(0.5)
  })

  it('zoom-to-selection clamps a tiny selection to 2.5', () => {
    const { ctx, worksheet } = makeCtx({}, { getWidth: () => 1, getHeight: () => 1 })
    handle('zoom-to-selection', ctx)
    expect(worksheet.zoom).toHaveBeenCalledWith(2.5)
  })
})

describe('display toggles', () => {
  // Univer owns gridline visibility, so the handler reads it back rather than
  // deriving it from the store.
  it('toggle-gridlines follows the sheet, not the store', () => {
    const { ctx, worksheet } = makeCtx({ hasHiddenGridLines: vi.fn(() => true) })
    useViewStore.setState({ showGridlines: false })

    handle('toggle-gridlines', ctx)

    expect(worksheet.setHiddenGridlines).toHaveBeenCalledWith(false)
    expect(useViewStore.getState().showGridlines).toBe(true)
    expect(status()).toBe('网格线已显示')
  })

  it.each([
    ['print-gridlines', 'printGridlines' as const, '打印网格线已开启', '打印网格线已关闭'],
    ['toggle-cross-highlight', 'crossHighlightVisible' as const, '十字高亮已开启', '十字高亮已关闭'],
    ['print-headings', 'printHeadings' as const, '打印标题（行标列标）已开启', '打印标题已关闭'],
  ])('%s flips its flag both ways', (cmd, field, onMsg, offMsg) => {
    const { ctx } = makeCtx()
    const before = useViewStore.getState()[field]

    handle(cmd, ctx)
    expect(useViewStore.getState()[field]).toBe(!before)
    expect(status()).toBe(before ? offMsg : onMsg)

    handle(cmd, ctx)
    expect(useViewStore.getState()[field]).toBe(before)
  })

  it('toggle-formula-bar flips the flag and the container class', () => {
    const container = document.createElement('div')
    container.id = 'univer-container'
    document.body.appendChild(container)

    const { ctx } = makeCtx()
    handle('toggle-formula-bar', ctx)

    expect(useViewStore.getState().formulaBarVisible).toBe(false)
    expect(container.classList.contains('formula-bar-hidden')).toBe(true)

    handle('toggle-formula-bar', ctx)
    expect(container.classList.contains('formula-bar-hidden')).toBe(false)

    container.remove()
  })

  it('toggle-headings survives a worksheet without a config', () => {
    const { ctx } = makeCtx({ getSheet: vi.fn(() => undefined) })
    expect(() => handle('toggle-headings', ctx)).not.toThrow()
    expect(useViewStore.getState().showHeadings).toBe(false)
  })
})

describe('view modes', () => {
  it('view-normal resets zoom and leaves page-break preview', () => {
    useViewStore.setState({ pageBreakPreview: true })
    const { ctx, worksheet } = makeCtx()

    handle('view-normal', ctx)

    expect(worksheet.zoom).toHaveBeenCalledWith(1.0)
    expect(useViewStore.getState().pageBreakPreview).toBe(false)
  })

  it('view-page-break toggles rather than sets', () => {
    const { ctx } = makeCtx()
    handle('view-page-break', ctx)
    expect(useViewStore.getState().pageBreakPreview).toBe(true)
    handle('view-page-break', ctx)
    expect(useViewStore.getState().pageBreakPreview).toBe(false)
  })

  it('view-page-layout always enables page-break preview', () => {
    const { ctx } = makeCtx()
    handle('view-page-layout', ctx)
    expect(useViewStore.getState().pageBreakPreview).toBe(true)
    handle('view-page-layout', ctx)
    expect(useViewStore.getState().pageBreakPreview).toBe(true)
  })
})

describe('freeze panes', () => {
  it('freeze-here freezes at the selection', () => {
    const { ctx, worksheet } = makeCtx({}, { getRow: () => 2, getColumn: () => 3 })
    handle('freeze-here', ctx)
    expect(worksheet.setFreeze).toHaveBeenCalledWith({
      startRow: 2,
      startColumn: 3,
      xSplit: 3,
      ySplit: 2,
    })
    expect(status()).toBe('已冻结至第 3 行、第 D 列')
  })

  // Freezing at A1 would freeze nothing, so row/column 0 is treated as 1.
  it('freeze-here substitutes 1 for a zero row or column', () => {
    const { ctx, worksheet } = makeCtx({}, { getRow: () => 0, getColumn: () => 0 })
    handle('freeze-here', ctx)
    expect(worksheet.setFreeze).toHaveBeenCalledWith({
      startRow: 1,
      startColumn: 1,
      xSplit: 1,
      ySplit: 1,
    })
  })

  it('freeze-top-row freezes only rows', () => {
    const { ctx, worksheet } = makeCtx()
    handle('freeze-top-row', ctx)
    expect(worksheet.setFreeze).toHaveBeenCalledWith({
      startRow: 1, startColumn: -1, xSplit: 0, ySplit: 1,
    })
  })

  it('freeze-first-col freezes only columns', () => {
    const { ctx, worksheet } = makeCtx()
    handle('freeze-first-col', ctx)
    expect(worksheet.setFreeze).toHaveBeenCalledWith({
      startRow: -1, startColumn: 1, xSplit: 1, ySplit: 0,
    })
  })

  it('unfreeze reports success', () => {
    const { ctx, worksheet } = makeCtx()
    handle('unfreeze', ctx)
    expect(worksheet.cancelFreeze).toHaveBeenCalled()
    expect(status()).toBe('已取消冻结窗格')
  })

  it('a failing freeze is swallowed and leaves the status alone', () => {
    const { ctx } = makeCtx({
      setFreeze: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })
    expect(() => handle('freeze-here', ctx)).not.toThrow()
    expect(status()).toBe('就绪')
  })

  it('a failing unfreeze is swallowed', () => {
    const { ctx } = makeCtx({
      cancelFreeze: vi.fn(() => {
        throw new Error('unsupported')
      }),
    })
    expect(() => handle('unfreeze', ctx)).not.toThrow()
    expect(status()).toBe('就绪')
  })
})

describe('window commands', () => {
  // Single-window host: these report intent and touch nothing.
  it.each([
    ['new-window', '已新建工作簿多窗口视图'],
    ['arrange-all', '已平铺重排所有工作簿窗口'],
    ['split-window', '已切换窗口拆分模式'],
    ['hide-window', '已隐藏当前工作簿窗口'],
    ['unhide-window', '已取消隐藏工作簿窗口'],
    ['switch-windows', '已切换到下一活动窗口'],
  ])('%s reports its message without touching the sheet', (cmd, message) => {
    const { ctx, worksheet } = makeCtx()
    handle(cmd, ctx)
    expect(status()).toBe(message)
    expect(worksheet.zoom).not.toHaveBeenCalled()
    expect(worksheet.setFreeze).not.toHaveBeenCalled()
  })
})
