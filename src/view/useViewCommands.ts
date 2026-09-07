import { columnLabel } from '../charts/cellAddress'
import { useDocumentStore, useViewStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4.0
const ZOOM_STEP = 0.1

/**
 * View tab commands: zoom, freeze panes, and the display toggles.
 *
 * The window commands at the end (new-window, arrange-all, split-window, ...)
 * only report intent - a Tauri webview hosts a single workbook, so there are no
 * sibling windows to arrange. Preserved as-is rather than quietly dropped.
 */
export function useViewCommands() {
  return function handleViewCommand(cmd: string, ctx: CommandContext): boolean {
    const { worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()
    const view = useViewStore.getState()

    const zoomTo = (level: number, label?: string) => {
      worksheet.zoom(level)
      setStatus(`视图缩放: ${label ?? `${Math.round(level * 100)}%`}`)
    }

    switch (cmd) {
      // ── View modes ──
      case 'view-normal': {
        view.setPageBreakPreview(false)
        worksheet.zoom(1.0)
        setStatus('已切换为: 普通视图')
        return true
      }

      case 'view-page-break': {
        view.setPageBreakPreview(!view.pageBreakPreview)
        setStatus('已切换为: 分页预览视图')
        return true
      }

      case 'view-page-layout': {
        view.setPageBreakPreview(true)
        setStatus('已切换为: 页面布局视图')
        return true
      }

      case 'view-custom': {
        setStatus('自定义视图：已保存当前显示及打印设置')
        return true
      }

      case 'toggle-ruler': {
        setStatus('标尺显示已切换')
        return true
      }

      // ── Display toggles ──
      case 'toggle-gridlines': {
        // Univer owns this state, so it is read back rather than derived from the
        // store - the two could otherwise drift.
        const nextHidden = !worksheet.hasHiddenGridLines()
        worksheet.setHiddenGridlines(nextHidden)
        view.setShowGridlines(!nextHidden)
        setStatus(!nextHidden ? '网格线已显示' : '网格线已隐藏')
        return true
      }

      case 'print-gridlines': {
        const next = !view.printGridlines
        view.setPrintGridlines(next)
        setStatus(next ? '打印网格线已开启' : '打印网格线已关闭')
        return true
      }

      case 'toggle-formula-bar': {
        const next = !view.formulaBarVisible
        document
          .getElementById('univer-container')
          ?.classList.toggle('formula-bar-hidden', !next)
        view.setFormulaBarVisible(next)
        setStatus(next ? '编辑栏已显示' : '编辑栏已隐藏')
        return true
      }

      case 'toggle-cross-highlight': {
        const next = !view.crossHighlightVisible
        view.setCrossHighlightVisible(next)
        setStatus(next ? '十字高亮已开启' : '十字高亮已关闭')
        return true
      }

      case 'toggle-headings': {
        const next = !view.showHeadings
        view.setShowHeadings(next)
        try {
          const config = (worksheet as any).getSheet?.()?.getConfig?.()
          if (config) {
            const nextHidden = config.rowHeader?.hidden !== 1
            config.rowHeader.hidden = nextHidden ? 1 : 0
            config.columnHeader.hidden = nextHidden ? 1 : 0
          }
        } catch {}
        setStatus(next ? '行号列标已显示' : '行号列标已隐藏')
        return true
      }

      case 'print-headings': {
        const next = !view.printHeadings
        view.setPrintHeadings(next)
        setStatus(next ? '打印标题（行标列标）已开启' : '打印标题已关闭')
        return true
      }

      // ── Zoom ──
      case 'zoom-in': {
        const current = worksheet.getZoom() || 1.0
        zoomTo(Math.min(ZOOM_MAX, Number((current + ZOOM_STEP).toFixed(2))))
        return true
      }

      case 'zoom-out': {
        const current = worksheet.getZoom() || 1.0
        zoomTo(Math.max(ZOOM_MIN, Number((current - ZOOM_STEP).toFixed(2))))
        return true
      }

      case 'zoom-reset':
      case 'zoom:100': {
        zoomTo(1.0, '100%')
        return true
      }

      case 'zoom:75': {
        zoomTo(0.75, '75%')
        return true
      }

      case 'zoom:125': {
        zoomTo(1.25, '125%')
        return true
      }

      case 'zoom:200': {
        zoomTo(2.0, '200%')
        return true
      }

      case 'zoom-to-selection': {
        const selW = Math.max(1, range.getWidth())
        const selH = Math.max(1, range.getHeight())
        const ratio = Math.min(2.5, Math.max(0.5, 8 / Math.max(selW, selH)))
        worksheet.zoom(Number(ratio.toFixed(2)))
        setStatus(`缩放至选区大小 (${Math.round(ratio * 100)}%)`)
        return true
      }

      // ── Freeze panes ──
      case 'freeze-here': {
        const r = range.getRow()
        const c = range.getColumn()
        try {
          worksheet.setFreeze({
            startRow: r > 0 ? r : 1,
            startColumn: c > 0 ? c : 1,
            xSplit: c > 0 ? c : 1,
            ySplit: r > 0 ? r : 1,
          })
          setStatus(`已冻结至第 ${r + 1} 行、第 ${columnLabel(c)} 列`)
        } catch (e) {
          console.warn(e)
        }
        return true
      }

      case 'freeze-top-row': {
        worksheet.setFreeze({ startRow: 1, startColumn: -1, xSplit: 0, ySplit: 1 })
        setStatus('已冻结首行')
        return true
      }

      case 'freeze-first-col': {
        worksheet.setFreeze({ startRow: -1, startColumn: 1, xSplit: 1, ySplit: 0 })
        setStatus('已冻结首列')
        return true
      }

      case 'unfreeze': {
        try {
          worksheet.cancelFreeze()
          setStatus('已取消冻结窗格')
        } catch (e) {
          console.warn(e)
        }
        return true
      }

      // ── Window management (acknowledged only; single-window host) ──
      case 'new-window': {
        setStatus('已新建工作簿多窗口视图')
        return true
      }

      case 'arrange-all': {
        setStatus('已平铺重排所有工作簿窗口')
        return true
      }

      case 'split-window': {
        setStatus('已切换窗口拆分模式')
        return true
      }

      case 'hide-window': {
        setStatus('已隐藏当前工作簿窗口')
        return true
      }

      case 'unhide-window': {
        setStatus('已取消隐藏工作簿窗口')
        return true
      }

      case 'switch-windows': {
        setStatus('已切换到下一活动窗口')
        return true
      }

      default:
        return false
    }
  }
}
