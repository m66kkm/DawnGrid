import { columnLabel } from '../charts/cellAddress'
import { useDialogStore, useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/** Named cell styles, as background/font pairs. */
const CELL_STYLES: Record<
  string,
  { background?: string; fontColor?: string; fontSize?: number; bold?: boolean; label: string }
> = {
  good: { background: '#C6EFCE', fontColor: '#006100', label: '好' },
  bad: { background: '#FFC7CE', fontColor: '#9C0006', label: '差' },
  neutral: { background: '#FFEB9C', fontColor: '#9C6500', label: '适中' },
  input: { background: '#FCE4D6', fontColor: '#C00000', label: '输入' },
  output: { background: '#F2F2F2', bold: true, label: '输出' },
  calculation: { background: '#F2F2F2', fontColor: '#FA7D00', label: '计算' },
  'warning-text': { fontColor: '#FF0000', label: '警告文本' },
  title: { fontSize: 18, bold: true, fontColor: '#1F4E78', label: '标题' },
  'heading-1': { fontSize: 15, bold: true, fontColor: '#1F4E78', label: '标题 1' },
  'heading-2': { fontSize: 13, bold: true, fontColor: '#1F4E78', label: '标题 2' },
  total: { background: '#FFF2CC', bold: true, label: '汇总' },
}

const ACCENT_STYLE = { background: '#E7EEF8', fontColor: '#1E4E79' }

/** Paste-special variants, keyed by the command suffix. */
const PASTE_SPECIAL: Record<string, { command: string; label: string }> = {
  value: { command: 'sheet.command.paste-value', label: '仅粘贴数值' },
  formula: { command: 'sheet.command.paste-formula', label: '仅粘贴公式' },
  format: { command: 'sheet.command.paste-format', label: '仅粘贴格式' },
  'col-width': { command: 'sheet.command.paste-col-width', label: '保持源列宽' },
  'besides-border': { command: 'sheet.command.paste-besides-border', label: '除边框外的所有内容' },
}

const MIN_FONT_SIZE = 8
const DEFAULT_FONT_SIZE = 11
const DEFAULT_ROW_HEIGHT = 24
const DEFAULT_COL_WIDTH = 80

/**
 * Home tab commands: font and text formatting, alignment, number formats, cell
 * styles, clipboard, and row/column operations.
 *
 * The toggles here read the current style back from the cell rather than
 * tracking it, so bold on an already-bold cell clears it.
 */
export function useHomeCommands() {
  return function handleHomeCommand(
    cmd: string,
    ctx: CommandContext,
    ...args: any[]
  ): boolean {
    const { runtime, worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()

    switch (cmd) {
      // ── Font and text ──
      case 'bold': {
        const isBold = range.getCellStyleData()?.bl === 1
        range.setFontWeight(isBold ? null : 'bold')
        setStatus(isBold ? '已取消加粗' : '已设置加粗')
        return true
      }

      case 'italic': {
        const isItalic = range.getCellStyleData()?.it === 1
        range.setFontStyle(isItalic ? null : 'italic')
        setStatus(isItalic ? '已取消斜体' : '已设置斜体')
        return true
      }

      case 'underline': {
        const isUnderline = range.getCellStyleData()?.ul?.s === 1
        range.setFontLine(isUnderline ? null : 'underline')
        setStatus(isUnderline ? '已取消下划线' : '已设置下划线')
        return true
      }

      case 'underline:double': {
        // Writes the style through setValue because the facade exposes no
        // double-underline setter. Unlike the single variant, this only ever sets.
        range.setValue({ s: { ul: { s: 1, t: 10 } } } as any)
        setStatus('已设置双下划线')
        return true
      }

      case 'strike': {
        const isStrike = range.getCellStyleData()?.st?.s === 1
        range.setValue({ s: { st: isStrike ? null : { s: 1 } } } as any)
        setStatus(isStrike ? '已取消删除线' : '已设置删除线')
        return true
      }

      case 'font-family': {
        if (args[0]) {
          range.setFontFamily(String(args[0]))
          setStatus(`字体已设为: ${args[0]}`)
        }
        return true
      }

      case 'font-size': {
        if (args[0]) {
          range.setFontSize(Number(args[0]))
          setStatus(`字号已设为: ${args[0]}pt`)
        }
        return true
      }

      case 'font-color': {
        if (args[0]) {
          range.setFontColor(String(args[0]))
          setStatus('字体颜色已更改')
        }
        return true
      }

      case 'fill': {
        if (args[0]) {
          range.setBackground(String(args[0]))
          setStatus('填充背景颜色已更改')
        }
        return true
      }

      case 'font-size-inc':
      case 'font-size-dec': {
        const cur = range.getFontSize() || DEFAULT_FONT_SIZE
        const next =
          cmd === 'font-size-inc' ? cur + 1 : Math.max(MIN_FONT_SIZE, cur - 1)
        range.setFontSize(next)
        setStatus(`字号已${cmd === 'font-size-inc' ? '增大' : '减小'}至: ${next}pt`)
        return true
      }

      case 'border': {
        const borderType = args[0] || 'all'
        const color = args[1] || '#000000'
        try {
          const Enum = (runtime.univerAPI as any).Enum
          const named: Record<string, string> = {
            all: Enum?.BorderType?.ALL || 'all',
            outer: Enum?.BorderType?.OUTSIDE || 'outside',
            top: Enum?.BorderType?.TOP || 'top',
            bottom: Enum?.BorderType?.BOTTOM || 'bottom',
            left: Enum?.BorderType?.LEFT || 'left',
            right: Enum?.BorderType?.RIGHT || 'right',
            none: Enum?.BorderType?.NONE || 'none',
          }
          // thick-outer is not a border type: it is the ALL type at MEDIUM weight.
          const borderTypeEnum = named[borderType] ?? named.all
          const borderStyle =
            borderType === 'thick-outer'
              ? Enum?.BorderStyleTypes?.MEDIUM || 2
              : Enum?.BorderStyleTypes?.THIN || 1
          range.setBorder(borderTypeEnum, borderStyle, color)
        } catch {
          void runtime.univerAPI.executeCommand('sheet.command.set-border', {
            type: borderType,
            color,
          })
        }
        setStatus(`边框已设置: ${borderType}`)
        return true
      }

      // ── Alignment and merging ──
      case 'align': {
        if (args[0]) {
          // 'right' maps to 'normal': the facade treats normal as right-aligned
          // for the default text direction.
          const val = args[0] === 'right' ? 'normal' : args[0]
          range.setHorizontalAlignment(val)
          setStatus(`水平对齐: ${args[0]}`)
        }
        return true
      }

      case 'valign': {
        if (args[0]) {
          range.setVerticalAlignment(args[0])
          setStatus(`垂直对齐: ${args[0]}`)
        }
        return true
      }

      case 'wrap': {
        const isWrap = range.getWrap()
        range.setWrap(!isWrap)
        setStatus(!isWrap ? '已开启自动换行' : '已关闭自动换行')
        return true
      }

      case 'rotate': {
        const angle = Number(args[0]) || 45
        const curRot = range.getCellStyleData()?.tr?.a || 0
        // Applying the same angle twice clears the rotation.
        const next = curRot === angle ? 0 : angle
        range.setTextRotation(next)
        setStatus(`文本旋转度: ${next}°`)
        return true
      }

      case 'merge': {
        const mode = args[0] || 'center'
        if (mode === 'unmerge') {
          range.breakApart()
          setStatus('已取消合并单元格')
        } else if (mode === 'across') {
          range.mergeAcross()
          setStatus('已跨越合并')
        } else {
          range.merge()
          if (mode === 'center') range.setHorizontalAlignment('center')
          setStatus('已合并并居中')
        }
        return true
      }

      // ── Number formats ──
      case 'format': {
        if (args[0]) {
          range.setNumberFormat(args[0])
          setStatus(`数字格式已设置为: ${args[0]}`)
        }
        return true
      }

      case 'decimal-inc':
      case 'decimal-dec': {
        const inc = cmd === 'decimal-inc'
        void runtime.univerAPI.executeCommand(
          inc
            ? 'sheet.command.numfmt.add.decimal.command'
            : 'sheet.command.numfmt.subtract.decimal.command',
        )
        setStatus(inc ? '增加小数位数' : '减少小数位数')
        return true
      }

      // ── Styles and presets ──
      case 'cf-open': {
        void runtime.univerAPI.executeCommand('sheet.command.open-conditional-formatting-panel')
        setStatus('已打开条件格式面板')
        return true
      }

      case 'format-as-table': {
        const startRow = range.getRow()
        const endRow = startRow + range.getHeight() - 1
        const startCol = range.getColumn()
        const width = range.getWidth()

        const headerRange = worksheet.getRange(startRow, startCol, 1, width)
        headerRange.setBackground('#217346')
        headerRange.setFontColor('#FFFFFF')
        headerRange.setFontWeight('bold')

        for (let r = startRow + 1; r <= endRow; r++) {
          const rowRange = worksheet.getRange(r, startCol, 1, width)
          rowRange.setBackground((r - startRow) % 2 === 0 ? '#F2F7F4' : '#FFFFFF')
        }
        setStatus('已套用现代化表格样式')
        return true
      }

      // ── Clipboard ──
      case 'paste': {
        void runtime.univerAPI.executeCommand('univer.command.paste')
        return true
      }

      case 'cut': {
        void runtime.univerAPI.executeCommand('univer.command.cut')
        return true
      }

      case 'copy': {
        void runtime.univerAPI.executeCommand('univer.command.copy')
        return true
      }

      case 'format-painter': {
        void runtime.univerAPI.executeCommand('sheet.command.set-once-format-painter')
        setStatus('已激活格式刷，请选择目标单元格')
        return true
      }

      case 'clear-all': {
        range.clear()
        setStatus('已清除所选单元格内容与格式')
        return true
      }

      case 'clear-formats': {
        try {
          ;(range as any).clear?.('format')
        } catch {}
        setStatus('已清除单元格格式')
        return true
      }

      case 'clear-contents': {
        try {
          ;(range as any).clear?.('value')
        } catch {
          range.setValue(null)
        }
        setStatus('已清除单元格内容')
        return true
      }

      case 'fill-down':
      case 'fill-right': {
        const down = cmd === 'fill-down'
        void runtime.univerAPI.executeCommand(
          down ? 'sheet.command.copy-down' : 'sheet.command.copy-right',
        )
        setStatus(down ? '已向下填充' : '已向右填充')
        return true
      }

      // Find and replace open the same dialog; only the status differs.
      case 'find':
      case 'replace': {
        void runtime.univerAPI.executeCommand('ui.operation.open-find-dialog')
        setStatus(cmd === 'find' ? '查找' : '替换')
        return true
      }

      case 'goto-open': {
        useDialogStore.getState().openDialog('goto')
        return true
      }

      // ── Cell and row/column operations ──
      case 'format-cells':
      case 'format-menu': {
        useDialogStore.getState().openDialog('format-cells')
        return true
      }

      case 'row-height-open': {
        const curH = worksheet.getRowHeight(range.getRow()) || DEFAULT_ROW_HEIGHT
        const newH = window.prompt('设置行高 (pt):', String(curH))
        if (newH && !isNaN(Number(newH))) {
          worksheet.setRowHeightsForced(range.getRow(), 1, Number(newH))
          setStatus(`第 ${range.getRow() + 1} 行行高已设为: ${newH}pt`)
        }
        return true
      }

      case 'col-width-open': {
        const curW = worksheet.getColumnWidth(range.getColumn()) || DEFAULT_COL_WIDTH
        const newW = window.prompt('设置列宽 (字符数/像素):', String(curW))
        if (newW && !isNaN(Number(newW))) {
          worksheet.setColumnWidth(range.getColumn(), Number(newW))
          setStatus(`第 ${columnLabel(range.getColumn())} 列列宽已设为: ${newW}`)
        }
        return true
      }

      case 'insert-row-here': {
        worksheet.insertRowsBefore(range.getRow(), 1)
        setStatus(`在第 ${range.getRow() + 1} 行前插入新行`)
        return true
      }

      case 'delete-row-here': {
        worksheet.deleteRows(range.getRow(), 1)
        setStatus(`已删除第 ${range.getRow() + 1} 行`)
        return true
      }

      case 'insert-col-here': {
        worksheet.insertColumnsBefore(range.getColumn(), 1)
        setStatus(`在第 ${columnLabel(range.getColumn())} 列前插入新列`)
        return true
      }

      case 'delete-col-here': {
        worksheet.deleteColumns(range.getColumn(), 1)
        setStatus(`已删除第 ${columnLabel(range.getColumn())} 列`)
        return true
      }

      // Hiding is a zero row height, so unhide restores the default rather than
      // whatever height the row had before.
      case 'hide-row':
      case 'unhide-row': {
        const hide = cmd === 'hide-row'
        try {
          worksheet.setRowHeightsForced(range.getRow(), 1, hide ? 0 : DEFAULT_ROW_HEIGHT)
          setStatus(`已${hide ? '隐藏' : '取消隐藏'}第 ${range.getRow() + 1} 行`)
        } catch {}
        return true
      }
    }

    // ── Prefix commands ──
    if (cmd.startsWith('paste-special:')) {
      const variant = PASTE_SPECIAL[cmd.slice('paste-special:'.length)]
      if (variant) {
        void runtime.univerAPI.executeCommand(variant.command)
        setStatus(variant.label)
        return true
      }
      return false
    }

    if (cmd.startsWith('cell-style:')) {
      const name = cmd.slice('cell-style:'.length)
      // Accent variants (accent1, accent1-20, accent1-40) all share one style.
      if (name.includes('accent1')) {
        range.setBackground(ACCENT_STYLE.background)
        range.setFontColor(ACCENT_STYLE.fontColor)
        setStatus('已应用主题单元格样式')
        return true
      }

      const style = CELL_STYLES[name]
      if (!style) return false
      if (style.background) range.setBackground(style.background)
      if (style.fontColor) range.setFontColor(style.fontColor)
      if (style.fontSize) range.setFontSize(style.fontSize)
      if (style.bold) range.setFontWeight('bold')
      setStatus(`已应用单元格样式: ${style.label}`)
      return true
    }

    return false
  }
}
