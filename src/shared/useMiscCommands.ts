import { useDialogStore, useDocumentStore } from '../store'
import type { CommandContext } from '../shared/commandTypes'

/** Legacy cell-style colours, kept for the style names useHomeCommands does not list. */
const LEGACY_STYLE_COLORS = {
  accent1: { background: '#D9E1F2', fontColor: '#002060' },
  good: { background: '#C6EFCE', fontColor: '#006100' },
  bad: { background: '#FFC7CE', fontColor: '#9C0006' },
  neutral: { background: '#FFEB9C', fontColor: '#9C6500' },
} as const

/** Sample formulas inserted by the function-category buttons. */
const FUNCTION_SAMPLES: Record<string, string> = {
  financial: '=PMT(0.05/12, 360, 1000000)',
  logical: '=IF(A1>0, "Pass", "Fail")',
  text: '=CONCATENATE(A1, " ", B1)',
  datetime: '=TODAY()',
  lookup: '=VLOOKUP(A1, B1:D10, 2, FALSE)',
  math: '=ROUND(A1, 2)',
}

const TABLE_HEADER = { background: '#4472C4', fontColor: '#FFFFFF' }
const TABLE_STRIPE = { odd: '#D9E1F2', even: '#FFFFFF' }

/** Points to pixels at 96 DPI, and characters to an approximate pixel width. */
const PT_TO_PX = 96 / 72
const CHAR_TO_PX = 8

/**
 * Prefix-matched commands that did not belong to a single ribbon tab, plus the
 * catch-all for unrecognised commands.
 *
 * This runs last: the domain handlers are tried first, and only what none of
 * them claimed reaches here. The cell-style branch in particular is a fallback
 * for names useHomeCommands does not list, which use different colours — the
 * two are not interchangeable.
 */
export function useMiscCommands() {
  return function handleMiscCommand(
    cmd: string,
    ctx: CommandContext,
    ...args: any[]
  ): boolean {
    const { worksheet, range } = ctx
    const { setStatus } = useDocumentStore.getState()

    if (cmd.startsWith('cell-style:')) {
      // Substring matching, so "accent1-20" and "heading1" both land here.
      const styleName = cmd.slice('cell-style:'.length)
      if (styleName.includes('accent1')) {
        range.setBackground(LEGACY_STYLE_COLORS.accent1.background)
        range.setFontColor(LEGACY_STYLE_COLORS.accent1.fontColor)
      } else if (styleName.includes('good')) {
        range.setBackground(LEGACY_STYLE_COLORS.good.background)
        range.setFontColor(LEGACY_STYLE_COLORS.good.fontColor)
      } else if (styleName.includes('bad')) {
        range.setBackground(LEGACY_STYLE_COLORS.bad.background)
        range.setFontColor(LEGACY_STYLE_COLORS.bad.fontColor)
      } else if (styleName.includes('neutral')) {
        range.setBackground(LEGACY_STYLE_COLORS.neutral.background)
        range.setFontColor(LEGACY_STYLE_COLORS.neutral.fontColor)
      } else if (styleName.includes('title')) {
        range.setFontSize(18)
        range.setFontWeight('bold')
        range.setFontColor('#1F497D')
      } else if (styleName.includes('heading1')) {
        range.setFontSize(15)
        range.setFontWeight('bold')
        range.setFontColor('#1F497D')
      } else if (styleName.includes('total')) {
        range.setFontWeight('bold')
        range.setFontLine('underline')
      } else {
        range.setBackground('#F2F2F2')
      }
      setStatus(`已应用单元格样式: ${styleName}`)
      return true
    }

    if (cmd.startsWith('format-as-table:')) {
      // Styles cell by cell rather than by row range, unlike the Home tab's
      // bare format-as-table, and uses a different palette.
      const tableStyle = cmd.slice('format-as-table:'.length)
      const startR = range.getRow()
      const startC = range.getColumn()
      const h = range.getHeight()
      const w = range.getWidth()

      for (let c = 0; c < w; c++) {
        const headerCell = worksheet.getRange(startR, startC + c, 1, 1)
        headerCell.setBackground(TABLE_HEADER.background)
        headerCell.setFontColor(TABLE_HEADER.fontColor)
        headerCell.setFontWeight('bold')
      }
      for (let r = 1; r < h; r++) {
        const bg = r % 2 === 1 ? TABLE_STRIPE.odd : TABLE_STRIPE.even
        for (let c = 0; c < w; c++) {
          worksheet.getRange(startR + r, startC + c, 1, 1).setBackground(bg)
        }
      }
      setStatus(`已套用表格样式: ${tableStyle}`)
      return true
    }

    // Theme switching is not implemented; the command only reports.
    if (
      cmd.startsWith('theme:') ||
      cmd.startsWith('colors:') ||
      cmd.startsWith('fonts:') ||
      cmd.startsWith('effects:')
    ) {
      setStatus(`已切换主题方案: ${cmd}`)
      return true
    }

    if (cmd.startsWith('fn-cat:')) {
      const cat = cmd.slice('fn-cat:'.length)
      const sample = FUNCTION_SAMPLES[cat] || '=SUM(A1:A10)'
      range.setValue(sample)
      setStatus(`已插入 ${cat} 类别函数: ${sample}`)
      return true
    }

    // Note: use-in-formula: is handled earlier in handleRibbonCommand, which
    // inserts the name into the existing formula rather than overwriting the
    // cell. The branch that once lived here never ran and is not reproduced.

    if (cmd.startsWith('what-if:')) {
      if (cmd === 'what-if:goal-seek') {
        useDialogStore.getState().openDialog('goal-seek')
      } else {
        setStatus(`模拟分析: ${cmd.slice('what-if:'.length)}`)
      }
      return true
    }

    if (cmd.startsWith('row-height:')) {
      const pt = Number(cmd.slice('row-height:'.length))
      if (!isNaN(pt) && pt > 0) {
        worksheet.setRowHeightsForced(range.getRow(), 1, Math.round(pt * PT_TO_PX))
        setStatus(`行高已设置为: ${pt} 磅`)
      }
      return true
    }

    if (cmd.startsWith('col-width:')) {
      const ch = Number(cmd.slice('col-width:'.length))
      if (!isNaN(ch) && ch > 0) {
        worksheet.setColumnWidth(range.getColumn(), Math.round(ch * CHAR_TO_PX))
        setStatus(`列宽已设置为: ${ch} 字符`)
      }
      return true
    }

    // Nothing claimed it. Reported rather than silently ignored so an unwired
    // ribbon button is visible during development.
    console.log('Ribbon command triggered:', cmd, args)
    setStatus(`执行: ${cmd}`)
    return true
  }
}
