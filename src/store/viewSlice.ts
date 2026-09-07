import { create } from 'zustand'

/**
 * View and protection toggles.
 *
 * These change rarely — a menu click at most — but they lived alongside the
 * selection state in the root component, so every cell click rebuilt the whole
 * tree that reads them.
 */
export interface ViewState {
  showGridlines: boolean
  showHeadings: boolean
  formulaBarVisible: boolean
  crossHighlightVisible: boolean
  pageBreakPreview: boolean
  printGridlines: boolean
  printHeadings: boolean
  sheetProtected: boolean
  workbookProtected: boolean
  calcManual: boolean

  setShowGridlines: (v: boolean) => void
  setShowHeadings: (v: boolean) => void
  setFormulaBarVisible: (v: boolean) => void
  setCrossHighlightVisible: (v: boolean) => void
  setPageBreakPreview: (v: boolean) => void
  setPrintGridlines: (v: boolean) => void
  setPrintHeadings: (v: boolean) => void
  setSheetProtected: (v: boolean) => void
  setWorkbookProtected: (v: boolean) => void
  setCalcManual: (v: boolean) => void
}

export const useViewStore = create<ViewState>((set) => ({
  showGridlines: true,
  showHeadings: true,
  formulaBarVisible: true,
  crossHighlightVisible: false,
  pageBreakPreview: false,
  printGridlines: false,
  printHeadings: false,
  sheetProtected: false,
  workbookProtected: false,
  calcManual: false,

  setShowGridlines: (v) => set({ showGridlines: v }),
  setShowHeadings: (v) => set({ showHeadings: v }),
  setFormulaBarVisible: (v) => set({ formulaBarVisible: v }),
  setCrossHighlightVisible: (v) => set({ crossHighlightVisible: v }),
  setPageBreakPreview: (v) => set({ pageBreakPreview: v }),
  setPrintGridlines: (v) => set({ printGridlines: v }),
  setPrintHeadings: (v) => set({ printHeadings: v }),
  setSheetProtected: (v) => set({ sheetProtected: v }),
  setWorkbookProtected: (v) => set({ workbookProtected: v }),
  setCalcManual: (v) => set({ calcManual: v }),
}))
