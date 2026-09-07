import { beforeEach, describe, expect, it } from 'vitest'
import { useSelectionStore } from '../store/selectionSlice'
import { toSelectionFormat, type SelectionFormat } from '../shared/selection-format'

const initial = useSelectionStore.getState()

beforeEach(() => {
  useSelectionStore.setState({
    selectionFormat: null,
    lastActiveCellAddress: 'A1',
    setSelectionFormat: initial.setSelectionFormat,
    setLastActiveCellAddress: initial.setLastActiveCellAddress,
  })
})

describe('selection store defaults', () => {
  it('starts with no format and A1 as the active cell', () => {
    const s = useSelectionStore.getState()
    expect(s.selectionFormat).toBeNull()
    expect(s.lastActiveCellAddress).toBe('A1')
  })
})

describe('setSelectionFormat', () => {
  it('stores a new format', () => {
    const fmt = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(fmt)
    expect(useSelectionStore.getState().selectionFormat).toBe(fmt)
  })

  // The whole point of the slice: toSelectionFormat allocates a fresh object per
  // call, so without value comparison every cell click would notify subscribers.
  it('keeps the previous reference when the value is unchanged', () => {
    const first = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(first)

    const equivalent = toSelectionFormat({}, '0.00')
    expect(equivalent).not.toBe(first)

    useSelectionStore.getState().setSelectionFormat(equivalent)
    expect(useSelectionStore.getState().selectionFormat).toBe(first)
  })

  it('does not notify subscribers when the value is unchanged', () => {
    let notifications = 0
    const unsubscribe = useSelectionStore.subscribe(() => {
      notifications += 1
    })

    const a = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(a)
    expect(notifications).toBe(1)

    useSelectionStore.getState().setSelectionFormat(toSelectionFormat({}, '0.00'))
    expect(notifications).toBe(1)

    useSelectionStore.getState().setSelectionFormat(toSelectionFormat({}, '常规'))
    expect(notifications).toBe(2)

    unsubscribe()
  })

  it('accepts null and treats repeated nulls as unchanged', () => {
    let notifications = 0
    const unsubscribe = useSelectionStore.subscribe(() => {
      notifications += 1
    })

    useSelectionStore.getState().setSelectionFormat(null)
    expect(useSelectionStore.getState().selectionFormat).toBeNull()
    expect(notifications).toBe(0)

    unsubscribe()
  })

  it('transitions between null and a value in both directions', () => {
    const fmt = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(fmt)
    expect(useSelectionStore.getState().selectionFormat).toBe(fmt)

    useSelectionStore.getState().setSelectionFormat(null)
    expect(useSelectionStore.getState().selectionFormat).toBeNull()
  })

  it('detects a change in any single field', () => {
    const base = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(base)

    const changed: SelectionFormat = { ...base, bold: !base.bold }
    useSelectionStore.getState().setSelectionFormat(changed)
    expect(useSelectionStore.getState().selectionFormat).toBe(changed)
  })
})

describe('setLastActiveCellAddress', () => {
  it('stores a new address', () => {
    useSelectionStore.getState().setLastActiveCellAddress('C5')
    expect(useSelectionStore.getState().lastActiveCellAddress).toBe('C5')
  })

  it('does not notify subscribers when the address is unchanged', () => {
    useSelectionStore.getState().setLastActiveCellAddress('C5')

    let notifications = 0
    const unsubscribe = useSelectionStore.subscribe(() => {
      notifications += 1
    })

    useSelectionStore.getState().setLastActiveCellAddress('C5')
    expect(notifications).toBe(0)

    useSelectionStore.getState().setLastActiveCellAddress('D6')
    expect(notifications).toBe(1)

    unsubscribe()
  })

  it('leaves the format untouched', () => {
    const fmt = toSelectionFormat({}, '0.00')
    useSelectionStore.getState().setSelectionFormat(fmt)
    useSelectionStore.getState().setLastActiveCellAddress('Z99')
    expect(useSelectionStore.getState().selectionFormat).toBe(fmt)
  })
})
