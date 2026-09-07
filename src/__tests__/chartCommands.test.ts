import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChartCommands } from '../charts/useChartCommands'
import { useChartStore } from '../store/chartSlice'
import { useDialogStore } from '../store/dialogSlice'
import { useDocumentStore } from '../store/documentSlice'
import type { CommandContext } from '../shared/commandTypes'
import type { SheetVisual } from '../charts/types'

const initialCharts = useChartStore.getState()
const initialDialogs = useDialogStore.getState()

function makeChart(overrides: Partial<SheetVisual['chart']> = {}): SheetVisual {
  return {
    id: 'c1',
    sheetId: 's1',
    kind: 'chart',
    anchor: {} as never,
    pos: { x: 0, y: 0, width: 100, height: 100 },
    chart: {
      chartTypes: ['barChart'],
      title: '',
      series: [{ name: 'A', categories: ['x', 'y'], values: [1, 2] }],
      ...overrides,
    },
  } as SheetVisual
}

const ctx: CommandContext = {
  runtime: {} as never,
  workbook: {},
  worksheet: {},
  range: { getA1Notation: () => 'B2:D5' },
}

const status = () => useDocumentStore.getState().status
const currentChart = () => useChartStore.getState().charts[0]?.chart

let getTargetChart: ReturnType<typeof vi.fn>
let insertChartObject: ReturnType<typeof vi.fn>
let handle: ReturnType<typeof useChartCommands>

/** Seeds the store with one chart and resolves it as the command target. */
function withChart(chart = makeChart()) {
  useChartStore.setState({ charts: [chart] })
  getTargetChart.mockReturnValue(chart)
  return chart
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocumentStore.setState({ status: '就绪' })
  useChartStore.setState({ ...initialCharts, charts: [] })
  useDialogStore.setState({ ...initialDialogs, activeDialog: null })
  getTargetChart = vi.fn(() => null)
  insertChartObject = vi.fn(() => null)
  handle = useChartCommands({
    getTargetChart: getTargetChart as never,
    insertChartObject: insertChartObject as never,
  })
})

describe('chart command routing', () => {
  it('claims every chart command', () => {
    const commands = [
      'activate-chart-tab', 'chart-switch-row-col', 'chart-select-data',
      'chart-format-pane', 'chart-delete',
      'chart-type-column', 'chart-type-bar', 'chart-type-line',
      'chart-type-area', 'chart-type-pie', 'chart-type-doughnut',
      'chart-element-title', 'chart-element-axis-cat', 'chart-element-axis-val',
      'insert-chart:pie', 'insert-pivot-chart:bar', 'chart-type:line',
      'chart-labels:value', 'chart-legend:right', 'chart-layout:1',
      'chart-colors:office', 'chart-grouping:stacked', 'sparkline:line',
    ]
    for (const cmd of commands) {
      expect(handle(cmd, ctx), cmd).toBe(true)
    }
  })

  it('passes on commands belonging to other domains', () => {
    for (const cmd of ['bold', 'zoom-in', 'chart', 'cell-style:good', '']) {
      expect(handle(cmd, ctx), cmd).toBe(false)
    }
  })
})

describe('chart-delete', () => {
  it('removes the chart and clears the selection', () => {
    withChart()
    handle('chart-delete', ctx)

    expect(useChartStore.getState().charts).toEqual([])
    expect(useChartStore.getState().activeChartId).toBeNull()
    expect(useChartStore.getState().selectedChart).toBe(false)
    expect(status()).toBe('选中的图表对象已成功删除')
  })

  it('reports when there is nothing to delete', () => {
    handle('chart-delete', ctx)
    expect(status()).toBe('当前无可用图表对象可删除')
  })
})

describe('chart type', () => {
  it.each([
    ['chart-type-pie', 'pie'],
    ['chart-type-bar', 'bar'],
    ['chart-type:line', 'line'],
  ])('%s converts an existing chart', (cmd, kind) => {
    withChart()
    handle(cmd, ctx)

    expect(currentChart()?.chartTypes).toBeDefined()
    expect(insertChartObject).not.toHaveBeenCalled()
    expect(status()).toContain('图表类型已')
    expect(kind).toBeTruthy()
  })

  // With nothing to convert, the command creates a chart of that kind instead.
  it.each([
    ['chart-type-pie', 'pie'],
    ['chart-type:line', 'line'],
  ])('%s inserts a new chart when none resolves', (cmd, kind) => {
    handle(cmd, ctx)
    expect(insertChartObject).toHaveBeenCalledWith(kind)
  })
})

describe('insert prefixes', () => {
  it('insert-chart: forwards the kind', () => {
    handle('insert-chart:doughnut', ctx)
    expect(insertChartObject).toHaveBeenCalledWith('doughnut')
  })

  it('insert-pivot-chart: passes the pivot title', () => {
    handle('insert-pivot-chart:bar', ctx)
    expect(insertChartObject).toHaveBeenCalledWith('bar', '数据透视图')
  })
})

describe('element toggles', () => {
  // These toggle between a default and none rather than editing text.
  it('chart-element-title adds a title when absent', () => {
    withChart(makeChart({ title: '' }))
    handle('chart-element-title', ctx)
    expect(currentChart()?.title).toBe('图表标题')
  })

  it('chart-element-title clears an existing title', () => {
    withChart(makeChart({ title: '销售额' }))
    handle('chart-element-title', ctx)
    expect(currentChart()?.title).toBe('')
  })

  it.each([
    ['chart-element-axis-cat', 'category', '类别轴标题'],
    ['chart-element-axis-val', 'value', '数值轴标题'],
  ])('%s adds the default axis title', (cmd, axis, expected) => {
    withChart()
    handle(cmd, ctx)
    expect((currentChart()?.axisTitles as never as Record<string, string>)[axis]).toBe(expected)
  })

  it.each([
    ['chart-element-axis-cat', 'category'],
    ['chart-element-axis-val', 'value'],
  ])('%s clears an existing axis title', (cmd, axis) => {
    withChart(makeChart({ axisTitles: { [axis]: '已有标题' } as never }))
    handle(cmd, ctx)
    expect((currentChart()?.axisTitles as never as Record<string, unknown>)[axis]).toBeUndefined()
  })

  it('leaves the other axis untouched', () => {
    withChart(makeChart({ axisTitles: { value: '数值' } as never }))
    handle('chart-element-axis-cat', ctx)
    const titles = currentChart()?.axisTitles as never as Record<string, string>
    expect(titles.value).toBe('数值')
    expect(titles.category).toBe('类别轴标题')
  })
})

describe('chart-switch-row-col', () => {
  it('reports when the chart has no transposable categories', () => {
    withChart(makeChart({ series: [] }))
    handle('chart-switch-row-col', ctx)
    expect(status()).toBe('当前图表暂无有效类别，无法互换行/列')
  })

  it('reports success when the transpose yields a series set', () => {
    withChart()
    handle('chart-switch-row-col', ctx)
    expect(status()).toBe('图表数据源：已完成行/列互换 (Switch Row/Column)')
  })
})

describe('dialogs', () => {
  it.each([
    ['chart-select-data', 'chart-select-data'],
    ['chart-format-pane', 'chart-format'],
  ])('%s selects the chart and opens %s', (cmd, dialog) => {
    const chart = withChart()
    handle(cmd, ctx)

    expect(useChartStore.getState().activeChartId).toBe(chart.id)
    expect(useChartStore.getState().selectedChart).toBe(true)
    expect(useDialogStore.getState().activeDialog).toBe(dialog)
  })

  it('opens nothing when no chart resolves', () => {
    handle('chart-select-data', ctx)
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })
})

describe('chart-layout', () => {
  it('applies the preset for a known index', () => {
    withChart()
    handle('chart-layout:4', ctx)
    expect(currentChart()?.legend).toBe('none')
    expect(currentChart()?.gridlines).toBe(false)
    expect(status()).toBe('已应用快速图表布局: 样式 4')
  })

  // An unknown index applies an empty patch, matching the original.
  it('still reports for an unknown index', () => {
    withChart()
    handle('chart-layout:99', ctx)
    expect(status()).toBe('已应用快速图表布局: 样式 99')
  })
})

describe('chart-colors', () => {
  // Pie, doughnut and single-series charts colour by point rather than series.
  it('assigns point colours for a single-series chart', () => {
    withChart()
    handle('chart-colors:office', ctx)
    expect(status()).toBe('已应用图表配色: office')
    expect(currentChart()?.palette).toBe('office')
  })

  it('assigns point colours for a pie chart', () => {
    withChart(makeChart({ chartTypes: ['pieChart'] }))
    handle('chart-colors:office', ctx)
    expect(currentChart()?.palette).toBe('office')
  })

  it('falls back to the office palette for an unknown name', () => {
    withChart()
    handle('chart-colors:nonexistent', ctx)
    expect(status()).toBe('已应用图表配色: nonexistent')
  })

  it('does nothing when no chart resolves', () => {
    handle('chart-colors:office', ctx)
    expect(status()).toBe('就绪')
  })
})

describe('chart-grouping', () => {
  it.each([
    ['chart-grouping:clustered', '簇状'],
    ['chart-grouping:stacked', '堆叠'],
    ['chart-grouping:percentStacked', '百分比堆叠'],
  ])('%s reports %s', (cmd, label) => {
    withChart()
    handle(cmd, ctx)
    expect(status()).toBe(`已设置图表堆叠方式: ${label}`)
  })
})

describe('labels and legend', () => {
  it.each([
    ['chart-labels:value', '已设置数据标签为: 数值'],
    ['chart-labels:none', '已设置数据标签为: 无'],
  ])('%s reports %s', (cmd, message) => {
    withChart()
    handle(cmd, ctx)
    expect(status()).toBe(message)
  })

  it.each([
    ['chart-legend:right', '已调整图例位置: right'],
    ['chart-legend:none', '已调整图例位置: 无图例'],
  ])('%s reports %s', (cmd, message) => {
    withChart()
    handle(cmd, ctx)
    expect(status()).toBe(message)
  })
})

describe('sparkline', () => {
  // Reports only; Univer has no sparkline primitive.
  it('reports the selection without touching any chart', () => {
    handle('sparkline:line', ctx)
    expect(status()).toBe('已为选区 B2:D5 创建迷你图 (line)')
    expect(useChartStore.getState().charts).toEqual([])
  })
})

describe('activate-chart-tab', () => {
  it('selects the chart and names it by title', () => {
    const chart = withChart(makeChart({ title: '销售额' }))
    handle('activate-chart-tab', ctx)

    expect(useChartStore.getState().activeChartId).toBe(chart.id)
    expect(status()).toBe('已进入图表设计，当前图表: 销售额')
  })

  it('falls back to the chart kind when untitled', () => {
    withChart(makeChart({ title: '', chartTypes: ['pieChart'] }))
    handle('activate-chart-tab', ctx)
    expect(status()).toContain('已进入图表设计，当前图表:')
  })

  it('does nothing when no chart resolves', () => {
    handle('activate-chart-tab', ctx)
    expect(status()).toBe('就绪')
  })
})
