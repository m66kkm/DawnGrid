import { beforeEach, describe, expect, it } from 'vitest'
import { useChartStore } from '../store/chartSlice'
import type { SheetVisual } from '../charts/types'

const chart = (id: string): SheetVisual => ({ id }) as SheetVisual

beforeEach(() => {
  useChartStore.setState({
    charts: [],
    activeChartId: null,
    selectedChart: false,
    recommendedData: null,
  })
})

describe('chart store defaults', () => {
  it('starts empty with nothing selected', () => {
    const s = useChartStore.getState()
    expect(s.charts).toEqual([])
    expect(s.activeChartId).toBeNull()
    expect(s.selectedChart).toBe(false)
    expect(s.recommendedData).toBeNull()
  })
})

describe('setCharts', () => {
  it('accepts an array', () => {
    useChartStore.getState().setCharts([chart('a')])
    expect(useChartStore.getState().charts.map((c) => c.id)).toEqual(['a'])
  })

  // App calls setCharts(prev => ...) in a dozen places; the updater form has to
  // keep working after the move off useState.
  it('accepts an updater function receiving the current value', () => {
    useChartStore.getState().setCharts([chart('a')])
    useChartStore.getState().setCharts((prev) => [...prev, chart('b')])
    expect(useChartStore.getState().charts.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('supports removal through the updater', () => {
    useChartStore.getState().setCharts([chart('a'), chart('b')])
    useChartStore.getState().setCharts((prev) => prev.filter((c) => c.id !== 'a'))
    expect(useChartStore.getState().charts.map((c) => c.id)).toEqual(['b'])
  })
})

describe('clearActiveChart', () => {
  it('deselects the active chart', () => {
    useChartStore.setState({ activeChartId: 'a', selectedChart: true })
    useChartStore.getState().clearActiveChart()
    expect(useChartStore.getState().activeChartId).toBeNull()
    expect(useChartStore.getState().selectedChart).toBe(false)
  })

  // It runs on every mousedown on the grid, so a no-op path matters: notifying
  // subscribers on each stray click is exactly the churn this refactor removes.
  it('does not notify subscribers when nothing is selected', () => {
    let notifications = 0
    const unsubscribe = useChartStore.subscribe(() => {
      notifications += 1
    })

    useChartStore.getState().clearActiveChart()
    expect(notifications).toBe(0)

    useChartStore.getState().setActiveChartId('a')
    useChartStore.getState().clearActiveChart()
    expect(notifications).toBe(2)

    unsubscribe()
  })

  it('leaves the chart list untouched', () => {
    useChartStore.getState().setCharts([chart('a')])
    useChartStore.setState({ activeChartId: 'a', selectedChart: true })
    useChartStore.getState().clearActiveChart()
    expect(useChartStore.getState().charts.map((c) => c.id)).toEqual(['a'])
  })
})

describe('chart selection setters', () => {
  it('round-trips activeChartId', () => {
    useChartStore.getState().setActiveChartId('x')
    expect(useChartStore.getState().activeChartId).toBe('x')
    useChartStore.getState().setActiveChartId(null)
    expect(useChartStore.getState().activeChartId).toBeNull()
  })

  it('round-trips selectedChart', () => {
    useChartStore.getState().setSelectedChart(true)
    expect(useChartStore.getState().selectedChart).toBe(true)
  })

  it('round-trips recommendedData', () => {
    const data = { kinds: [] } as never
    useChartStore.getState().setRecommendedData(data)
    expect(useChartStore.getState().recommendedData).toBe(data)
    useChartStore.getState().setRecommendedData(null)
    expect(useChartStore.getState().recommendedData).toBeNull()
  })
})
