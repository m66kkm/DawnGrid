import { describe, expect, it } from 'vitest'
import { CATEGORIES, normalizeCategory } from '../formular/catalog'

describe('normalizeCategory', () => {
  it('defaults to Common for empty input', () => {
    expect(normalizeCategory()).toBe('Common')
    expect(normalizeCategory('')).toBe('Common')
    expect(normalizeCategory(undefined)).toBe('Common')
  })

  it('accepts canonical English keys case-insensitively', () => {
    expect(normalizeCategory('All')).toBe('All')
    expect(normalizeCategory('all')).toBe('All')
    expect(normalizeCategory('COMMON')).toBe('Common')
    expect(normalizeCategory('math')).toBe('Math')
    expect(normalizeCategory('statistical')).toBe('Statistical')
    expect(normalizeCategory('logical')).toBe('Logical')
    expect(normalizeCategory('lookup')).toBe('Lookup')
    expect(normalizeCategory('text')).toBe('Text')
    expect(normalizeCategory('financial')).toBe('Financial')
  })

  it('accepts Chinese labels', () => {
    expect(normalizeCategory('全部')).toBe('All')
    expect(normalizeCategory('常用')).toBe('Common')
    expect(normalizeCategory('最近使用')).toBe('Common')
    expect(normalizeCategory('数学与三角')).toBe('Math')
    expect(normalizeCategory('统计')).toBe('Statistical')
    expect(normalizeCategory('逻辑')).toBe('Logical')
    expect(normalizeCategory('查找与引用')).toBe('Lookup')
    expect(normalizeCategory('文本')).toBe('Text')
    expect(normalizeCategory('日期和时间')).toBe('Date & Time')
    expect(normalizeCategory('财务')).toBe('Financial')
  })

  it('matches Date & Time on either DATE or TIME', () => {
    expect(normalizeCategory('Date & Time')).toBe('Date & Time')
    expect(normalizeCategory('date')).toBe('Date & Time')
    expect(normalizeCategory('TIME')).toBe('Date & Time')
  })

  it('trims surrounding whitespace on English keys', () => {
    expect(normalizeCategory('  math  ')).toBe('Math')
  })

  it('falls back to Common for unknown categories', () => {
    expect(normalizeCategory('Engineering')).toBe('Common')
    expect(normalizeCategory('工程')).toBe('Common')
  })

  it('matches Chinese labels as substrings, not exact equality', () => {
    // Documents actual behaviour: the Chinese branches use includes(), so any string
    // containing the keyword matches.
    expect(normalizeCategory('高级统计函数')).toBe('Statistical')
  })

  it('does not trim before comparing Chinese labels', () => {
    // Documents actual behaviour: `cat === '全部'` runs against the untrimmed input,
    // but the includes()-based branches below still match padded Chinese input.
    expect(normalizeCategory('  全部  ')).toBe('Common')
    expect(normalizeCategory('  统计  ')).toBe('Statistical')
  })

  it('returns a key present in CATEGORIES for every documented input', () => {
    const keys = new Set(CATEGORIES.map((c) => c.key))
    for (const input of [
      'All',
      'Common',
      'Math',
      'Statistical',
      'Logical',
      'Lookup',
      'Text',
      'Date & Time',
      'Financial',
      '全部',
      '常用',
      '数学与三角',
      '统计',
      '逻辑',
      '查找与引用',
      '文本',
      '日期和时间',
      '财务',
      'unknown',
    ]) {
      expect(keys).toContain(normalizeCategory(input))
    }
  })
})
