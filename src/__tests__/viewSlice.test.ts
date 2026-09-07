import { beforeEach, describe, expect, it } from 'vitest'
import { useViewStore, type ViewState } from '../store/viewSlice'

const initial = useViewStore.getState()

beforeEach(() => {
  useViewStore.setState({ ...initial })
})

type BooleanField = {
  [K in keyof ViewState]: ViewState[K] extends boolean ? K : never
}[keyof ViewState]

const FIELDS: Array<[BooleanField, boolean, keyof ViewState]> = [
  ['showGridlines', true, 'setShowGridlines'],
  ['showHeadings', true, 'setShowHeadings'],
  ['formulaBarVisible', true, 'setFormulaBarVisible'],
  ['crossHighlightVisible', false, 'setCrossHighlightVisible'],
  ['pageBreakPreview', false, 'setPageBreakPreview'],
  ['printGridlines', false, 'setPrintGridlines'],
  ['printHeadings', false, 'setPrintHeadings'],
  ['sheetProtected', false, 'setSheetProtected'],
  ['workbookProtected', false, 'setWorkbookProtected'],
  ['calcManual', false, 'setCalcManual'],
]

describe('view store defaults', () => {
  it.each(FIELDS)('%s defaults to %s', (field, expected) => {
    expect(useViewStore.getState()[field]).toBe(expected)
  })

  it('matches the pre-migration App defaults', () => {
    // Gridlines, headings and the formula bar were shown by default; everything
    // else started off.
    const s = useViewStore.getState()
    expect([s.showGridlines, s.showHeadings, s.formulaBarVisible]).toEqual([true, true, true])
    expect([
      s.crossHighlightVisible,
      s.pageBreakPreview,
      s.printGridlines,
      s.printHeadings,
      s.sheetProtected,
      s.workbookProtected,
      s.calcManual,
    ]).toEqual([false, false, false, false, false, false, false])
  })
})

describe('view store setters', () => {
  it.each(FIELDS)('%s round-trips through its setter', (field, initialValue, setterName) => {
    const setter = useViewStore.getState()[setterName] as (v: boolean) => void

    setter(!initialValue)
    expect(useViewStore.getState()[field]).toBe(!initialValue)

    setter(initialValue)
    expect(useViewStore.getState()[field]).toBe(initialValue)
  })

  it.each(FIELDS)('%s setter leaves the other fields untouched', (field, initialValue, setterName) => {
    const before = useViewStore.getState()
    const setter = before[setterName] as (v: boolean) => void

    setter(!initialValue)

    const after = useViewStore.getState()
    for (const [other] of FIELDS) {
      if (other === field) continue
      expect(after[other]).toBe(before[other])
    }
  })

  it('covers every boolean field of the slice', () => {
    const booleanKeys = Object.entries(useViewStore.getState())
      .filter(([, v]) => typeof v === 'boolean')
      .map(([k]) => k)
    expect(FIELDS.map(([f]) => f).sort()).toEqual(booleanKeys.sort())
  })
})
