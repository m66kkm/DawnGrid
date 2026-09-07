import { memo } from 'react'
import { Ribbon, type RibbonProps } from '../Ribbon'
import { useSelectionStore, useViewStore } from '../store'

/**
 * Props that App still owns — callbacks and document-level state that have not
 * moved into the store yet.
 */
export type RibbonContainerProps = Omit<
  RibbonProps,
  | 'selectionFormat'
  | 'sheetProtected'
  | 'workbookProtected'
  | 'formulaBarVisible'
  | 'crossHighlightVisible'
  | 'showGridlines'
  | 'showHeadings'
  | 'printGridlines'
  | 'printHeadings'
  | 'pageBreakPreview'
  | 'calcManual'
>

const MemoRibbon = memo(Ribbon)

/**
 * Subscribes to the selection and view stores on the Ribbon's behalf.
 *
 * Reading this state here rather than in App is the point: a cell click now
 * re-renders this small container instead of the 3500-line root, and the memoized
 * Ribbon below only re-renders when a value it actually displays changed.
 *
 * For that memo to hold, every callback App passes down must have a stable
 * identity — see the useCallback wrappers at the App call site.
 */
export function RibbonContainer(props: RibbonContainerProps) {
  const selectionFormat = useSelectionStore((s) => s.selectionFormat)

  const showGridlines = useViewStore((s) => s.showGridlines)
  const showHeadings = useViewStore((s) => s.showHeadings)
  const formulaBarVisible = useViewStore((s) => s.formulaBarVisible)
  const crossHighlightVisible = useViewStore((s) => s.crossHighlightVisible)
  const pageBreakPreview = useViewStore((s) => s.pageBreakPreview)
  const printGridlines = useViewStore((s) => s.printGridlines)
  const printHeadings = useViewStore((s) => s.printHeadings)
  const sheetProtected = useViewStore((s) => s.sheetProtected)
  const workbookProtected = useViewStore((s) => s.workbookProtected)
  const calcManual = useViewStore((s) => s.calcManual)

  return (
    <MemoRibbon
      {...props}
      selectionFormat={selectionFormat}
      showGridlines={showGridlines}
      showHeadings={showHeadings}
      formulaBarVisible={formulaBarVisible}
      crossHighlightVisible={crossHighlightVisible}
      pageBreakPreview={pageBreakPreview}
      printGridlines={printGridlines}
      printHeadings={printHeadings}
      sheetProtected={sheetProtected}
      workbookProtected={workbookProtected}
      calcManual={calcManual}
    />
  )
}
