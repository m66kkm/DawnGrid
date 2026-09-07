import { create } from 'zustand'
import { isSameSelectionFormat, type SelectionFormat } from '../shared/selection-format'

/**
 * Selection state, updated on every cell click.
 *
 * This is the hottest state in the app: a single click fans out into ~11 Univer
 * commands. Keeping it in its own store means only the components that read the
 * selection re-render, instead of the whole tree.
 */
export interface SelectionState {
  selectionFormat: SelectionFormat | null
  lastActiveCellAddress: string
  setSelectionFormat: (fmt: SelectionFormat | null) => void
  setLastActiveCellAddress: (addr: string) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectionFormat: null,
  lastActiveCellAddress: 'A1',

  // toSelectionFormat builds a fresh object every call, so an identity check would
  // always miss. Compare by value and keep the previous reference when unchanged —
  // zustand skips notifying subscribers when the slice is referentially equal.
  setSelectionFormat: (fmt) =>
    set((state) =>
      isSameSelectionFormat(state.selectionFormat, fmt) ? state : { selectionFormat: fmt },
    ),

  setLastActiveCellAddress: (addr) =>
    set((state) => (state.lastActiveCellAddress === addr ? state : { lastActiveCellAddress: addr })),
}))
