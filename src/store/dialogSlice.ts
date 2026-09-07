import { create } from 'zustand'

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
}

export const useDialogStore = create<DialogState>((set, get) => ({
  activeDialog: null,

  openDialog: (id) => set({ activeDialog: id }),
  closeDialog: () => set({ activeDialog: null }),
  closeDialogIf: (id) => set((s) => (s.activeDialog === id ? { activeDialog: null } : s)),
  isOpen: (id) => get().activeDialog === id,
}))
