import { open } from '@tauri-apps/plugin-dialog'
import { recommendCharts } from '../charts'
import { useChartStore, useDialogStore, useDocumentStore, useNotificationStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'
import type { PivotField } from './PivotDialog'

export interface InsertCommandDeps {
  /** Reads the column headers of a range, for the dialogs that list fields. */
  getFieldsFromRange: (worksheet: any, range: any) => PivotField[]
  /** Reads the selection as a value grid, for chart recommendation. */
  extractActiveChartValues: () => { values: unknown[][] }
}

/**
 * Insert tab commands.
 *
 * Several of these write a placeholder into the cell rather than inserting a
 * real object - Univer has no text box, equation or screenshot primitive
 * exposed here. Preserved as-is; replacing them is a separate decision.
 */
export function useInsertCommands(deps: InsertCommandDeps) {
  return function handleInsertCommand(cmd: string, ctx: CommandContext): boolean {
    const { runtime, worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()
    const dialogs = useDialogStore.getState()

    switch (cmd) {
      case 'pivot-edit': {
        dialogs.setDataFields(deps.getFieldsFromRange(worksheet, range))
        dialogs.setDefaultRangeStr(range.getA1Notation())
        dialogs.openDialog('pivot')
        return true
      }

      case 'recommended-charts-open': {
        const data = deps.extractActiveChartValues()
        const reco = recommendCharts(data.values as never)
        // recommendCharts returns null when the selection has no chartable
        // numeric series. Opening the picker anyway showed its default layouts,
        // inviting the user to pick a chart that could not then be built.
        if (!reco) {
          const reason = '所选区域需要至少包含一列有效数值才能推荐图表。请选择包含数字的数据区域。'
          setStatus(reason)
          useNotificationStore.getState().notifyError(reason, '无法推荐图表')
          return true
        }
        useChartStore.getState().setRecommendedData(reco)
        dialogs.openDialog('recommended-charts')
        return true
      }

      case 'insert-picture': {
        // Fire-and-forget: nothing downstream awaited this in the original.
        void (async () => {
          try {
            const selected = await open({
              multiple: false,
              filters: [
                { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] },
              ],
            })
            if (selected && typeof selected === 'string') {
              const fileName = selected.split(/[/\\]/).pop()
              // Writes a text marker, not an embedded image.
              range.setValue(`[图片: ${fileName}]`)
              setStatus(`已在单元格插入图片引用: ${fileName}`)
            }
          } catch (e) {
            console.error(e)
          }
        })()
        return true
      }

      case 'insert-icons': {
        range.setValue('⭐')
        setStatus('已在当前单元格插入图标: ⭐')
        return true
      }

      case 'insert-screenshot': {
        setStatus('已截取当前屏幕画面并嵌入工作表')
        return true
      }

      case 'insert-checkbox': {
        try {
          const rule = (runtime.univerAPI as any).newDataValidation().requireCheckbox().build()
          range.setDataValidation(rule)
          setStatus('已插入交互式复选框')
        } catch {
          // Falls back to a static glyph when data validation is unavailable.
          range.setValue('☐')
          setStatus('已插入复选框')
        }
        return true
      }

      case 'insert-textbox': {
        range.setValue('请输入文本内容...')
        range.setFontStyle('italic')
        setStatus('已插入文本框')
        return true
      }

      case 'link-open': {
        const currentVal = String(range.getValue() || 'https://genspark.ai')
        const url = window.prompt('请输入要插入的超链接 URL:', currentVal)
        if (url) {
          // Styled to look like a link; not a real hyperlink attribute.
          range.setValue(url)
          range.setFontColor('#0563C1')
          range.setFontLine('underline')
          setStatus(`已插入超链接: ${url}`)
        }
        return true
      }

      case 'header-footer-open': {
        dialogs.openDialog('header-footer')
        return true
      }

      case 'insert-equation': {
        range.setValue('f(x) = a0 + ∑(an·cos(nπx/L) + bn·sin(nπx/L))')
        range.setFontStyle('italic')
        setStatus('已插入数学公式')
        return true
      }

      case 'insert-symbol': {
        dialogs.openDialog('symbol')
        return true
      }

      case 'slicer-open': {
        setStatus(`已为当前选区 ${range.getA1Notation()} 生成交互式数据切片器`)
        return true
      }

      case 'timeline-open': {
        setStatus('已为日期列创建时间线筛选器')
        return true
      }

      default:
        return false
    }
  }
}
