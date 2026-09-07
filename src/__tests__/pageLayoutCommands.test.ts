import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePageLayoutCommands } from '../view/usePageLayoutCommands'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async () => null),
}))

/**
 * Minimal stand-in for the Univer handles these commands touch. Mocking the whole
 * facade would be brittle; the handlers only reach for a couple of range methods.
 */
function makeCtx(overrides: Partial<CommandContext['range']> = {}): CommandContext {
  return {
    runtime: {} as never,
    workbook: {},
    worksheet: {},
    range: {
      getA1Notation: () => 'B2:D5',
      getRow: () => 4,
      ...overrides,
    },
  }
}

const handle = usePageLayoutCommands()

beforeEach(() => {
  useDocumentStore.setState({ status: '就绪' })
})

const status = () => useDocumentStore.getState().status

describe('page layout command routing', () => {
  // The point of the split: each domain claims its own commands and passes on the
  // rest, so ordering in App stays first-match-wins.
  it('claims every page-layout command', () => {
    const commands = [
      'page-layout:margins:normal',
      'page-layout:margins:wide',
      'page-layout:margins:narrow',
      'page-layout:orientation:portrait',
      'page-layout:orientation:landscape',
      'page-layout:size:A4',
      'page-layout:print-area:set',
      'page-layout:print-area:clear',
      'page-layout:breaks:insert',
      'page-layout:breaks:remove',
      'page-layout:breaks:reset',
      'page-layout:print-titles:first-row',
      'page-layout:print-titles:selection',
      'page-layout:print-titles:clear',
      'export-pdf',
    ]
    for (const cmd of commands) {
      expect(handle(cmd, makeCtx()), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'insert-chart:pie', 'zoom-in', 'page-layout', '']) {
      expect(handle(cmd, makeCtx()), cmd).toBe(false)
    }
  })
})

describe('margins', () => {
  it.each([
    ['page-layout:margins:normal', '普通'],
    ['page-layout:margins:wide', '宽'],
    ['page-layout:margins:narrow', '窄'],
  ])('%s reports %s', (cmd, label) => {
    handle(cmd, makeCtx())
    expect(status()).toBe(`页边距已更新为: ${label}`)
  })
})

describe('orientation', () => {
  it.each([
    ['page-layout:orientation:portrait', '纵向'],
    ['page-layout:orientation:landscape', '横向'],
  ])('%s reports %s', (cmd, label) => {
    handle(cmd, makeCtx())
    expect(status()).toBe(`页面方向已设为: ${label}`)
  })
})

describe('print area and titles', () => {
  it('reports the selection when setting the print area', () => {
    handle('page-layout:print-area:set', makeCtx({ getA1Notation: () => 'A1:C9' }))
    expect(status()).toBe('已将选区 A1:C9 设置为打印区域')
  })

  it('reports the selection when setting print titles', () => {
    handle('page-layout:print-titles:selection', makeCtx({ getA1Notation: () => 'A1:C9' }))
    expect(status()).toBe('已设置选区 A1:C9 作为打印标题')
  })

  it('reports a 1-based row when inserting a break', () => {
    handle('page-layout:breaks:insert', makeCtx({ getRow: () => 4 }))
    expect(status()).toBe('已在第 5 行插入分页符')
  })
})

describe('acknowledged-only commands', () => {
  it.each([
    ['page-layout:size:A4', '页面大小已设为标准 A4 (210 × 297 mm)'],
    ['page-layout:print-area:clear', '已清除打印区域'],
    ['page-layout:breaks:remove', '已删除当前位置分页符'],
    ['page-layout:breaks:reset', '已重置所有人工分页符'],
    ['page-layout:print-titles:first-row', '已设置首行作为打印标题顶端行重复'],
    ['page-layout:print-titles:clear', '已清除打印标题设置'],
  ])('%s reports its message', (cmd, message) => {
    handle(cmd, makeCtx())
    expect(status()).toBe(message)
  })
})
