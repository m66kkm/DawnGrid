import { beforeEach, describe, expect, it } from 'vitest'
import { useDialogStore, type DialogId } from '../store/dialogSlice'

beforeEach(() => {
  useDialogStore.setState({ activeDialog: null })
})

const ALL_IDS: DialogId[] = [
  'format-cells',
  'insert-function',
  'ai',
  'goto',
  'pivot',
  'goal-seek',
  'subtotal',
  'consolidate',
  'advanced-filter',
  'custom-sort',
  'name-manager',
  'watch-window',
  'symbol',
  'header-footer',
  'allow-edit-ranges',
  'workbook-stats',
  'recommended-charts',
  'chart-select-data',
  'chart-format',
]

describe('dialog store', () => {
  it('starts with no dialog open', () => {
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })

  it.each(ALL_IDS)('opens %s', (id) => {
    useDialogStore.getState().openDialog(id)
    expect(useDialogStore.getState().activeDialog).toBe(id)
    expect(useDialogStore.getState().isOpen(id)).toBe(true)
  })

  it('replaces the open dialog rather than stacking', () => {
    useDialogStore.getState().openDialog('pivot')
    useDialogStore.getState().openDialog('goto')
    expect(useDialogStore.getState().activeDialog).toBe('goto')
    expect(useDialogStore.getState().isOpen('pivot')).toBe(false)
  })

  it('closeDialog clears whichever dialog is open', () => {
    useDialogStore.getState().openDialog('symbol')
    useDialogStore.getState().closeDialog()
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })

  it('closeDialog is a no-op when nothing is open', () => {
    useDialogStore.getState().closeDialog()
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })
})

describe('closeDialogIf', () => {
  it('closes when the id matches', () => {
    useDialogStore.getState().openDialog('subtotal')
    useDialogStore.getState().closeDialogIf('subtotal')
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })

  // Guards the shim in App: each dialog's onClose calls setIsXxxOpen(false), and a
  // handler left over from a dialog that already closed must not dismiss the one
  // opened after it.
  it('leaves a different dialog open', () => {
    useDialogStore.getState().openDialog('goto')
    useDialogStore.getState().closeDialogIf('pivot')
    expect(useDialogStore.getState().activeDialog).toBe('goto')
  })

  it('is a no-op when nothing is open', () => {
    useDialogStore.getState().closeDialogIf('ai')
    expect(useDialogStore.getState().activeDialog).toBeNull()
  })

  it('does not notify subscribers when the id does not match', () => {
    useDialogStore.getState().openDialog('goto')

    let notifications = 0
    const unsubscribe = useDialogStore.subscribe(() => {
      notifications += 1
    })

    useDialogStore.getState().closeDialogIf('pivot')
    expect(notifications).toBe(0)

    useDialogStore.getState().closeDialogIf('goto')
    expect(notifications).toBe(1)

    unsubscribe()
  })
})

describe('isOpen', () => {
  it('reports false for every id when nothing is open', () => {
    for (const id of ALL_IDS) {
      expect(useDialogStore.getState().isOpen(id)).toBe(false)
    }
  })

  it('reports true for exactly one id at a time', () => {
    useDialogStore.getState().openDialog('header-footer')
    const open = ALL_IDS.filter((id) => useDialogStore.getState().isOpen(id))
    expect(open).toEqual(['header-footer'])
  })
})
