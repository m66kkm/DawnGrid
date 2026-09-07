// Imports concrete modules rather than the charts barrel: this file is exported
// from it, so going through it would be circular.
import { applyChartStateEdit, transposeChartSeries } from './chartVisual'
import { KIND_NAMES } from './chartRecommend'
import { COLOR_PALETTES } from './types'
import type {
  ChartStateEdit,
  ChartVisualState,
  RecommendedKind,
  SheetVisual,
} from './types'
import { useChartStore, useDialogStore, useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

export interface ChartCommandDeps {
  /** Resolves the chart a command should act on, optionally creating one. */
  getTargetChart: (autoCreateKind?: RecommendedKind) => SheetVisual | null
  /** Inserts a chart of the given kind from the current selection. */
  insertChartObject: (kind: RecommendedKind, customTitle?: string) => SheetVisual | null
}

/** Quick-layout presets, keyed by the numeric suffix of `chart-layout:N`. */
const LAYOUT_PRESETS: Record<string, ChartStateEdit> = {
  '1': { legend: 'right', dataLabels: 'value', gridlines: true },
  '2': { legend: 'top', dataLabels: 'value', gridlines: true },
  '3': { legend: 'bottom', dataLabels: 'none', gridlines: true },
  '4': { legend: 'none', dataLabels: 'none', gridlines: false },
}

const GROUPING_NAMES: Record<string, string> = {
  clustered: '簇状',
  stacked: '堆叠',
  percentStacked: '百分比堆叠',
}

/**
 * Chart Design tab commands, plus the chart-related prefix commands that lived
 * in the dispatcher's default branch.
 *
 * Most edits follow the same shape: resolve the target chart, patch its state,
 * report. `patchTarget` captures that so each case states only what it changes.
 */
export function useChartCommands(deps: ChartCommandDeps) {
  return function handleChartCommand(cmd: string, ctx: CommandContext): boolean {
    const { range } = ctx
    const { setStatus } = useDocumentStore.getState()
    const charts = useChartStore.getState()

    /** Applies an edit to the resolved chart. Returns false when none resolved. */
    const patchTarget = (
      edit: ChartStateEdit | ((chart: ChartVisualState) => ChartVisualState),
      message: string | ((target: SheetVisual) => string),
      autoCreateKind?: RecommendedKind,
    ): boolean => {
      const target = deps.getTargetChart(autoCreateKind)
      if (!target) return false
      charts.setCharts((prev) =>
        prev.map((c) =>
          c.id === target.id
            ? {
                ...c,
                chart: typeof edit === 'function' ? edit(c.chart) : applyChartStateEdit(c.chart, edit),
              }
            : c,
        ),
      )
      setStatus(typeof message === 'function' ? message(target) : message)
      return true
    }

    switch (cmd) {
      case 'activate-chart-tab': {
        const target = deps.getTargetChart()
        if (target) {
          charts.setActiveChartId(target.id)
          charts.setSelectedChart(true)
          const kindKey = target.chart.chartTypes[0]?.replace('Chart', '') as RecommendedKind
          const label = target.chart.title || KIND_NAMES[kindKey]?.zh || '图表'
          setStatus(`已进入图表设计，当前图表: ${label}`)
        }
        return true
      }

      case 'chart-switch-row-col': {
        const target = deps.getTargetChart('column')
        if (target) {
          const seriesSet = transposeChartSeries(target.chart.series, (n) => `系列 ${n}`)
          if (seriesSet) {
            charts.setCharts((prev) =>
              prev.map((c) =>
                c.id === target.id ? { ...c, chart: applyChartStateEdit(c.chart, { seriesSet }) } : c,
              ),
            )
            setStatus('图表数据源：已完成行/列互换 (Switch Row/Column)')
          } else {
            setStatus('当前图表暂无有效类别，无法互换行/列')
          }
        }
        return true
      }

      case 'chart-select-data':
      case 'chart-format-pane': {
        const target = deps.getTargetChart('column')
        if (target) {
          charts.setActiveChartId(target.id)
          charts.setSelectedChart(true)
          useDialogStore
            .getState()
            .openDialog(cmd === 'chart-select-data' ? 'chart-select-data' : 'chart-format')
        }
        return true
      }

      case 'chart-delete': {
        const target = deps.getTargetChart()
        if (target) {
          charts.setCharts((prev) => prev.filter((c) => c.id !== target.id))
          charts.setActiveChartId(null)
          charts.setSelectedChart(false)
          setStatus('选中的图表对象已成功删除')
        } else {
          setStatus('当前无可用图表对象可删除')
        }
        return true
      }

      case 'chart-type-column':
      case 'chart-type-bar':
      case 'chart-type-line':
      case 'chart-type-area':
      case 'chart-type-pie':
      case 'chart-type-doughnut': {
        const kind = cmd.slice('chart-type-'.length) as RecommendedKind
        // With no chart to convert, the command creates one of that kind instead.
        if (!patchTarget({ chartType: kind }, `图表类型已转换为: ${KIND_NAMES[kind]?.zh || kind}`)) {
          deps.insertChartObject(kind)
        }
        return true
      }

      case 'chart-element-title': {
        // Toggles between a default title and none, rather than editing text.
        patchTarget(
          (chart) => ({ ...chart, title: chart.title ? '' : '图表标题' }),
          '已切换图表标题显示',
          'column',
        )
        return true
      }

      case 'chart-element-axis-cat':
      case 'chart-element-axis-val': {
        const axis = cmd === 'chart-element-axis-cat' ? 'category' : 'value'
        const defaultTitle = axis === 'category' ? '类别轴标题' : '数值轴标题'
        patchTarget(
          (chart) => ({
            ...chart,
            axisTitles: {
              ...chart.axisTitles,
              [axis]: chart.axisTitles?.[axis] ? undefined : defaultTitle,
            },
          }),
          axis === 'category' ? '已切换横坐标轴标题' : '已切换纵坐标轴标题',
          'column',
        )
        return true
      }
    }

    // ── Prefix commands ──
    if (cmd.startsWith('insert-chart:')) {
      deps.insertChartObject(cmd.slice('insert-chart:'.length) as RecommendedKind)
      return true
    }

    if (cmd.startsWith('insert-pivot-chart:')) {
      deps.insertChartObject(cmd.slice('insert-pivot-chart:'.length) as RecommendedKind, '数据透视图')
      return true
    }

    if (cmd.startsWith('chart-type:')) {
      const chartType = cmd.slice('chart-type:'.length) as RecommendedKind
      if (!patchTarget({ chartType }, `图表类型已切换为: ${KIND_NAMES[chartType]?.zh || chartType}`)) {
        deps.insertChartObject(chartType)
      }
      return true
    }

    if (cmd.startsWith('chart-labels:')) {
      const dataLabels = cmd.slice('chart-labels:'.length) as ChartVisualState['dataLabels']
      patchTarget(
        { dataLabels },
        `已设置数据标签为: ${dataLabels === 'none' ? '无' : '数值'}`,
        'column',
      )
      return true
    }

    if (cmd.startsWith('chart-legend:')) {
      const legend = cmd.slice('chart-legend:'.length) as ChartVisualState['legend']
      patchTarget({ legend }, `已调整图例位置: ${legend === 'none' ? '无图例' : legend}`, 'column')
      return true
    }

    if (cmd.startsWith('chart-layout:')) {
      const layoutIdx = cmd.slice('chart-layout:'.length)
      // An unknown index applies an empty patch, matching the original.
      patchTarget(LAYOUT_PRESETS[layoutIdx] ?? {}, `已应用快速图表布局: 样式 ${layoutIdx}`, 'column')
      return true
    }

    if (cmd.startsWith('chart-colors:')) {
      const pal = cmd.slice('chart-colors:'.length)
      const colors = COLOR_PALETTES[pal] ?? COLOR_PALETTES.office
      const target = deps.getTargetChart('column')
      if (target) {
        const seriesColors: Record<string, string> = {}
        target.chart.series.forEach((_, idx) => {
          seriesColors[String(idx)] = colors[idx % colors.length]
        })

        // Pie, doughnut and single-series charts colour by point rather than by
        // series, so each slice gets its own palette entry.
        const pointColors: Record<string, Record<string, string>> = {}
        const perPoint =
          target.chart.chartTypes.includes('pieChart') ||
          target.chart.chartTypes.includes('doughnutChart') ||
          target.chart.series.length === 1
        if (perPoint) {
          const first = target.chart.series[0]
          const catCount = first?.categories?.length || first?.values?.length || 0
          const ptMap: Record<string, string> = {}
          for (let i = 0; i < catCount; i++) ptMap[String(i)] = colors[i % colors.length]
          pointColors['0'] = ptMap
        }

        patchTarget({ seriesColors, pointColors, palette: pal }, `已应用图表配色: ${pal}`, 'column')
      }
      return true
    }

    if (cmd.startsWith('chart-grouping:')) {
      const grouping = cmd.slice('chart-grouping:'.length) as ChartStateEdit['grouping']
      patchTarget(
        { grouping },
        `已设置图表堆叠方式: ${GROUPING_NAMES[grouping as string] ?? grouping}`,
        'column',
      )
      return true
    }

    if (cmd.startsWith('sparkline:')) {
      // Reports only; Univer has no sparkline primitive.
      setStatus(`已为选区 ${range.getA1Notation()} 创建迷你图 (${cmd.slice('sparkline:'.length)})`)
      return true
    }

    return false
  }
}
