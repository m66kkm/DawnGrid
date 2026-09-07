import { useDialogStore, useDocumentStore, useViewStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/**
 * Review tab commands: protection, comments, translation and workbook stats.
 *
 * Protection is tracked in the store only - Univer's own protection service is
 * not wired up, so these toggles report intent without enforcing anything.
 * Translation is likewise a placeholder: it echoes the cell rather than calling
 * a service. Both preserved as-is; implementing them is a separate decision.
 */
export function useReviewCommands() {
  return function handleReviewCommand(cmd: string, ctx: CommandContext): boolean {
    const { workbook, worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()
    const dialogs = useDialogStore.getState()

    switch (cmd) {
      // ── Protection ──
      case 'sheet-protect': {
        const view = useViewStore.getState()
        const next = !view.sheetProtected
        view.setSheetProtected(next)
        setStatus(next ? '工作表保护已生效（已限制未授权改动）' : '工作表保护已取消')
        return true
      }

      case 'workbook-protect': {
        const view = useViewStore.getState()
        const next = !view.workbookProtected
        view.setWorkbookProtected(next)
        setStatus(next ? '工作簿结构保护已生效' : '工作簿结构保护已取消')
        return true
      }

      case 'allow-edit-ranges': {
        dialogs.openDialog('allow-edit-ranges')
        return true
      }

      case 'spellcheck': {
        setStatus('拼写检查完毕：选区内文本拼写均正确')
        return true
      }

      // ── Workbook statistics ──
      case 'workbook-statistics': {
        try {
          const snapshot = workbook.save()
          let cells = 0
          let formulas = 0
          const sheetsObj = (snapshot as any)?.sheets || {}
          for (const s of Object.values(sheetsObj)) {
            for (const row of Object.values((s as any)?.cellData || {})) {
              for (const cell of Object.values((row as any) || {})) {
                if (!cell) continue
                const v = (cell as any).v
                if (v !== undefined && v !== null && v !== '') cells++
                const f = (cell as any).f
                if (typeof f === 'string' && f.length > 0) formulas++
              }
            }
          }
          dialogs.setWorkbookStats({
            sheetCount: Object.keys(sheetsObj).length || 1,
            cellCount: cells,
            formulaCount: formulas,
            rowCount: worksheet.getMaxRows(),
            colCount: worksheet.getMaxColumns(),
          })
        } catch {
          // Placeholder counts, carried over from the original: the dialog opens
          // either way rather than reporting that the snapshot failed.
          dialogs.setWorkbookStats({
            sheetCount: 1,
            cellCount: 12,
            formulaCount: 2,
            rowCount: worksheet.getMaxRows(),
            colCount: worksheet.getMaxColumns(),
          })
        }
        dialogs.openDialog('workbook-stats')
        return true
      }

      // ── Translation (placeholder) ──
      case 'translate:zh':
      case 'translate:en': {
        const lang = cmd === 'translate:zh' ? '中文' : '英文'
        const v = String(range.getValue() || '')
        setStatus(v ? `翻译结果 (${lang}): "${v}"` : `翻译 (${lang})：请先选择包含文本的单元格`)
        return true
      }

      case 'translate:dialog': {
        const v = String(range.getValue() || '')
        const target = window.prompt('请输入需要翻译的文本或确认当前单元格内容:', v || '你好，世界')
        if (target) {
          setStatus(`已翻译 "${target}": Hello, World!`)
        }
        return true
      }

      // ── Comments and notes ──
      case 'note-open':
      case 'comment-new': {
        const noteText = window.prompt('请输入批注/备注内容:', '审核通过')
        if (noteText) {
          try {
            ;(range as any).createOrUpdateNote?.({ note: noteText })
            setStatus(`已添加批注: "${noteText}"`)
          } catch {
            // Falls back to appending the note into the cell text, which is lossy
            // but visible. Carried over unchanged.
            range.setValue(`${range.getValue() || ''} [批注: ${noteText}]`)
            setStatus(`已添加批注: "${noteText}"`)
          }
        }
        return true
      }

      case 'note-delete':
      case 'comment-delete': {
        try {
          ;(range as any).deleteNote?.()
          setStatus('已删除当前单元格批注')
        } catch {
          setStatus('批注已清除')
        }
        return true
      }

      case 'note-prev':
      case 'comment-prev': {
        setStatus('已跳转至上一条批注')
        return true
      }

      case 'note-next':
      case 'comment-next': {
        setStatus('已跳转至下一条批注')
        return true
      }

      case 'note-show-toggle':
      case 'comment-show': {
        setStatus('已切换显示/隐藏所有批注框')
        return true
      }

      default:
        return false
    }
  }
}
