import { save } from '@tauri-apps/plugin-dialog'
import { useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/**
 * Page Layout tab commands.
 *
 * Most of these only report intent: Univer has no API for margins, paper size or
 * manual page breaks, so the original switch set a status message and did
 * nothing else. That behaviour is preserved rather than silently dropped -
 * changing it is a separate decision from moving the code.
 */
export function usePageLayoutCommands() {
  return function handlePageLayoutCommand(cmd: string, ctx: CommandContext): boolean {
    const { range } = ctx
    const { setStatus } = useDocumentStore.getState()

    switch (cmd) {
      case 'page-layout:margins:normal':
      case 'page-layout:margins:wide':
      case 'page-layout:margins:narrow': {
        const mode = cmd.split(':')[2]
        setStatus(
          `页边距已更新为: ${mode === 'normal' ? '普通' : mode === 'wide' ? '宽' : '窄'}`,
        )
        return true
      }

      case 'page-layout:orientation:portrait':
      case 'page-layout:orientation:landscape': {
        const ori = cmd.split(':')[2]
        setStatus(`页面方向已设为: ${ori === 'landscape' ? '横向' : '纵向'}`)
        return true
      }

      case 'page-layout:size:A4': {
        setStatus('页面大小已设为标准 A4 (210 × 297 mm)')
        return true
      }

      case 'page-layout:print-area:set': {
        setStatus(`已将选区 ${range.getA1Notation()} 设置为打印区域`)
        return true
      }

      case 'page-layout:print-area:clear': {
        setStatus('已清除打印区域')
        return true
      }

      case 'page-layout:breaks:insert': {
        setStatus(`已在第 ${range.getRow() + 1} 行插入分页符`)
        return true
      }

      case 'page-layout:breaks:remove': {
        setStatus('已删除当前位置分页符')
        return true
      }

      case 'page-layout:breaks:reset': {
        setStatus('已重置所有人工分页符')
        return true
      }

      case 'page-layout:print-titles:first-row': {
        setStatus('已设置首行作为打印标题顶端行重复')
        return true
      }

      case 'page-layout:print-titles:selection': {
        setStatus(`已设置选区 ${range.getA1Notation()} 作为打印标题`)
        return true
      }

      case 'page-layout:print-titles:clear': {
        setStatus('已清除打印标题设置')
        return true
      }

      case 'export-pdf': {
        // Fire-and-forget: the original ran this inside an async switch but never
        // awaited anything after it, so the command completes immediately.
        void (async () => {
          try {
            const { metadata } = useDocumentStore.getState()
            const savePath = await save({
              filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
              defaultPath: (metadata?.name.replace(/\.[^.]+$/, '') || '表格导出') + '.pdf',
            })
            if (savePath) {
              setStatus(`已导出 PDF 至: ${savePath}`)
            }
          } catch (e) {
            console.error(e)
          }
        })()
        return true
      }

      default:
        return false
    }
  }
}
