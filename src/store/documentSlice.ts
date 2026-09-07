import { create } from 'zustand'
import type { WorkbookMetadata } from '../shared/types'
import type { DefinedNameRow } from '../formular/types'

/**
 * The open workbook: which file, its metadata, the active sheet, and the status
 * line.
 *
 * `status` is written from ~230 call sites, almost all of them a plain string,
 * so it stays a simple setter. App previously mirrored `metadata` and
 * `activeSheetId` into refs for stable callbacks to read; `getState()` replaces
 * that.
 */
export interface DocumentState {
  currentFile: string | null
  metadata: WorkbookMetadata | null
  status: string
  loading: boolean
  activeSheetId: string
  definedNames: DefinedNameRow[]

  setCurrentFile: (path: string | null) => void
  setMetadata: (meta: WorkbookMetadata | null) => void
  setStatus: (status: string) => void
  setLoading: (loading: boolean) => void
  setActiveSheetId: (id: string) => void
  setDefinedNames: (
    updater: DefinedNameRow[] | ((prev: DefinedNameRow[]) => DefinedNameRow[]),
  ) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  currentFile: null,
  metadata: null,
  status: '就绪',
  loading: false,
  activeSheetId: 'sheet-1',
  definedNames: [{ name: 'SalesData', ref: '=Sheet1!$A$1:$D$10', scope: '工作簿' }],

  setCurrentFile: (path) => set({ currentFile: path }),
  setMetadata: (meta) => set({ metadata: meta }),
  setStatus: (status) => set((s) => (s.status === status ? s : { status })),
  setLoading: (loading) => set((s) => (s.loading === loading ? s : { loading })),
  setActiveSheetId: (id) => set((s) => (s.activeSheetId === id ? s : { activeSheetId: id })),
  setDefinedNames: (updater) =>
    set((s) => ({
      definedNames: typeof updater === 'function' ? updater(s.definedNames) : updater,
    })),
}))
