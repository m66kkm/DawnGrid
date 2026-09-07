import { create } from 'zustand'
import type { AllowEditRangeItem } from '../review/AllowEditRangesDialog'

export interface WorkbookStats {
  sheetCount: number
  cellCount: number
  formulaCount: number
  rowCount: number
  colCount: number
}

/**
 * Identifies the one dialog that may be open at a time.
 *
 * These were nineteen independent booleans on the root component. Only one can
 * meaningfully be open at once, so a single discriminant replaces them — and lets
 * DialogHost render just the active dialog instead of building JSX for all
 * nineteen on every render.
 */
export type DialogId =
  | 'format-cells'
  | 'insert-function'
  | 'ai'
  | 'goto'
  | 'pivot'
  | 'goal-seek'
  | 'subtotal'
  | 'consolidate'
  | 'advanced-filter'
  | 'custom-sort'
  | 'name-manager'
  | 'watch-window'
  | 'symbol'
  | 'header-footer'
  | 'allow-edit-ranges'
  | 'workbook-stats'
  | 'recommended-charts'
  | 'chart-select-data'
  | 'chart-format'

export interface DialogState {
  activeDialog: DialogId | null
  openDialog: (id: DialogId) => void
  closeDialog: () => void
  /** Closes only if `id` is the dialog currently open, so a stale handler cannot
   *  dismiss a dialog opened after it. */
  closeDialogIf: (id: DialogId) => void
  isOpen: (id: DialogId) => boolean

  // Payloads the dialogs read. They live here rather than in each domain so a
  // command handler can populate a dialog and open it without App relaying props.
  allowEditRanges: AllowEditRangeItem[]
  workbookStats: WorkbookStats
  analysisSummary: string | null
  diagnosticResult: string | null
  setAllowEditRanges: (ranges: AllowEditRangeItem[]) => void
  setWorkbookStats: (stats: WorkbookStats) => void
  setAnalysisSummary: (summary: string | null) => void
  setDiagnosticResult: (result: string | null) => void
}

const EMPTY_STATS: WorkbookStats = {
  sheetCount: 1,
  cellCount: 0,
  formulaCount: 0,
  rowCount: 0,
  colCount: 0,
}

export const useDialogStore = create<DialogState>((set, get) => ({
  activeDialog: null,

  openDialog: (id) => set({ activeDialog: id }),
  closeDialog: () => set({ activeDialog: null }),
  closeDialogIf: (id) => set((s) => (s.activeDialog === id ? { activeDialog: null } : s)),
  isOpen: (id) => get().activeDialog === id,

  allowEditRanges: [],
  workbookStats: EMPTY_STATS,
  analysisSummary: null,
  diagnosticResult: null,
  setAllowEditRanges: (ranges) => set({ allowEditRanges: ranges }),
  setWorkbookStats: (stats) => set({ workbookStats: stats }),
  setAnalysisSummary: (summary) => set({ analysisSummary: summary }),
  setDiagnosticResult: (result) => set({ diagnosticResult: result }),
}))
