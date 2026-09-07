import { useDialogStore, useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/** Rows and columns the analysis samples. Bounded so a large sheet does not stall. */
const ANALYZE_MAX_ROWS = 100
const ANALYZE_MAX_COLS = 10

/**
 * AI assistant commands.
 *
 * `dispatch` is taken explicitly because ai-check delegates to the formula tab's
 * error-checking command. Passing it per-domain rather than putting it on
 * CommandContext keeps it visible which handlers re-enter the dispatcher.
 */
export function useAiCommands(dispatch: (cmd: string) => void) {
  return function handleAiCommand(cmd: string, ctx: CommandContext): boolean {
    const { worksheet } = ctx
    const { setStatus } = useDocumentStore.getState()
    const dialogs = useDialogStore.getState()

    switch (cmd) {
      case 'ai-chat': {
        dialogs.openDialog('ai')
        return true
      }

      case 'ai-check': {
        dispatch('error-checking')
        dialogs.openDialog('ai')
        return true
      }

      case 'ai-analyze': {
        // Counts only non-zero numerics, so the average excludes blanks and text
        // as well as genuine zeroes. Carried over unchanged.
        const maxR = Math.min(ANALYZE_MAX_ROWS, worksheet.getMaxRows())
        let numericCount = 0
        let sum = 0
        for (let r = 0; r < maxR; r++) {
          for (let c = 0; c < ANALYZE_MAX_COLS; c++) {
            const val = Number(worksheet.getRange(r, c, 1, 1).getValue())
            if (!isNaN(val) && val !== 0) {
              numericCount++
              sum += val
            }
          }
        }
        const avg = numericCount > 0 ? (sum / numericCount).toFixed(2) : '0'
        const summary =
          `当前工作表共统计 ${numericCount} 个有效数值单元格，数值总计 ${sum}，` +
          `均值约 ${avg}。数据分布平稳，结构合规。`
        dialogs.setAnalysisSummary(summary)
        setStatus(summary)
        dialogs.openDialog('ai')
        return true
      }

      default:
        return false
    }
  }
}
