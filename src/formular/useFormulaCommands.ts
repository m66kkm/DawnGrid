// Imports the concrete modules rather than the formular barrel: this file is
// itself exported from that barrel, so going through it would be circular.
import { applyAutoSum } from './autoSum'
import { calculateNow, calculateSheet } from './calculation'
import { createNamesFromSelection } from './definedNames'
import { checkFormulaErrors, clearAuditHighlights, traceDependents, tracePrecedents } from './formulaAudit'
import { useDialogStore, useDocumentStore, useViewStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/**
 * Formula tab commands: auto-sum, defined names, auditing, and calculation mode.
 *
 * `syncSelectionState` is taken explicitly because auto-sum writes into the
 * sheet and the ribbon's format state has to catch up; the other handlers here
 * only read.
 */
export function useFormulaCommands(syncSelectionState: () => void) {
  return function handleFormulaCommand(
    cmd: string,
    ctx: CommandContext,
    ...args: any[]
  ): boolean {
    const { workbook, worksheet, range } = ctx
    const doc = useDocumentStore.getState()
    const dialogs = useDialogStore.getState()
    const { setStatus } = doc

    switch (cmd) {
      case 'insert-function-open': {
        dialogs.setInsertFuncCategory(args[0] || 'Common')
        dialogs.openDialog('insert-function')
        return true
      }

      case 'autofn': {
        const res = applyAutoSum(worksheet, range, args[0] || 'SUM')
        setStatus(res.message)
        syncSelectionState()
        return true
      }

      // ── Defined names ──
      case 'name-manager-open': {
        dialogs.openDialog('name-manager')
        return true
      }

      case 'create-names:top':
      case 'create-names:left': {
        const source = cmd === 'create-names:top' ? 'top' : 'left'
        const res = createNamesFromSelection(worksheet, range, source, doc.definedNames)
        if (res.success) {
          doc.setDefinedNames(res.updatedList)
        }
        setStatus(res.message)
        return true
      }

      // ── Formula auditing ──
      case 'trace-precedents': {
        setStatus(tracePrecedents(worksheet, range).message)
        return true
      }

      case 'trace-dependents': {
        setStatus(traceDependents(worksheet, range).message)
        return true
      }

      case 'remove-arrows': {
        clearAuditHighlights(worksheet)
        setStatus('已移去所有公式追踪高亮与箭头')
        return true
      }

      case 'toggle-show-formulas': {
        // Reports the active cell's formula rather than switching the sheet into
        // formula-view; Univer has no such mode. Name kept for the ribbon binding.
        const formula = range.getFormula?.()
        if (formula) {
          setStatus(`公式明细 (${range.getA1Notation()}): ${formula}`)
        } else {
          const val = range.getValue?.()
          setStatus(
            `单元格 (${range.getA1Notation()}) 为静态值: ${val != null ? String(val) : '空'}`,
          )
        }
        return true
      }

      case 'watch-window': {
        dialogs.openDialog('watch-window')
        return true
      }

      // ── Calculation ──
      case 'calc-mode:auto':
      case 'calc-mode:manual': {
        const manual = cmd === 'calc-mode:manual'
        useViewStore.getState().setCalcManual(manual)
        setStatus(`计算选项已切换为: ${manual ? '手动计算' : '自动计算'}`)
        return true
      }

      case 'calculate-now': {
        setStatus(calculateNow(workbook).message)
        return true
      }

      case 'calculate-sheet': {
        setStatus(calculateSheet(worksheet).message)
        return true
      }

      case 'error-checking': {
        const res = checkFormulaErrors(worksheet)
        dialogs.setDiagnosticResult(res.message)
        setStatus(res.message)
        return true
      }

      default:
        return false
    }
  }
}
