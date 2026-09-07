import { create } from 'zustand'
import type { ChartRecommendations, SheetVisual } from '../charts/types'

/**
 * Chart objects overlaid on the grid, plus which one is selected.
 *
 * App previously mirrored `charts` and `activeChartId` into refs so that stable
 * callbacks could read current values without re-subscribing. `getState()` covers
 * that case directly, so the mirrors go away.
 */
export interface ChartState {
  charts: SheetVisual[]
  activeChartId: string | null
  selectedChart: boolean
  recommendedData: ChartRecommendations | null

  setCharts: (updater: SheetVisual[] | ((prev: SheetVisual[]) => SheetVisual[])) => void
  setActiveChartId: (id: string | null) => void
  setSelectedChart: (v: boolean) => void
  setRecommendedData: (data: ChartRecommendations | null) => void
  /** Deselects the active chart, if any. No-op when nothing is selected, so it
   *  does not notify subscribers on every stray grid click. */
  clearActiveChart: () => void
}

export const useChartStore = create<ChartState>((set, get) => ({
  charts: [],
  activeChartId: null,
  selectedChart: false,
  recommendedData: null,

  setCharts: (updater) =>
    set((s) => ({ charts: typeof updater === 'function' ? updater(s.charts) : updater })),
  setActiveChartId: (id) => set({ activeChartId: id }),
  setSelectedChart: (v) => set({ selectedChart: v }),
  setRecommendedData: (data) => set({ recommendedData: data }),

  clearActiveChart: () => {
    if (get().activeChartId === null) return
    set({ activeChartId: null, selectedChart: false })
  },
}))
