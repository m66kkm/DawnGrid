import { describe, expect, it } from 'vitest'
import { BooleanNumber, WrapStrategy } from '@univerjs/core'
import {
  isSameSelectionFormat,
  normalizeHexColor,
  toSelectionFormat,
  type SelectionFormat,
} from '../shared/selection-format'

describe('normalizeHexColor', () => {
  it('returns null for empty input', () => {
    expect(normalizeHexColor(null)).toBeNull()
    expect(normalizeHexColor(undefined)).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
  })

  it('uppercases 6-digit hex', () => {
    expect(normalizeHexColor('#aabbcc')).toBe('#AABBCC')
    expect(normalizeHexColor('#AABBCC')).toBe('#AABBCC')
  })

  it('truncates 8-digit hex to the leading 7 characters, dropping alpha', () => {
    expect(normalizeHexColor('#aabbccdd')).toBe('#AABBCC')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeHexColor('  #aabbcc  ')).toBe('#AABBCC')
  })

  it('converts rgb() to hex', () => {
    expect(normalizeHexColor('rgb(170, 187, 204)')).toBe('#AABBCC')
    expect(normalizeHexColor('rgb(0,0,0)')).toBe('#000000')
    expect(normalizeHexColor('rgb(255 255 255)')).toBe('#FFFFFF')
  })

  it('converts rgba() by ignoring the alpha channel', () => {
    expect(normalizeHexColor('rgba(170, 187, 204, 0.5)')).toBe('#AABBCC')
  })

  it('pads single-digit channels to two hex digits', () => {
    expect(normalizeHexColor('rgb(1, 2, 3)')).toBe('#010203')
  })

  it('clamps channel values above 255', () => {
    expect(normalizeHexColor('rgb(999, 0, 0)')).toBe('#FF0000')
  })

  it('returns null for unrecognized formats', () => {
    expect(normalizeHexColor('red')).toBeNull()
    expect(normalizeHexColor('#abc')).toBeNull()
    expect(normalizeHexColor('#gggggg')).toBeNull()
    expect(normalizeHexColor('hsl(0, 100%, 50%)')).toBeNull()
  })
})

const BASE: SelectionFormat = {
  fontFamily: 'Arial',
  fontSize: 12,
  bold: true,
  italic: false,
  underline: false,
  strike: false,
  wrap: true,
  horizontalAlignment: 'center',
  verticalAlignment: 'top',
  textRotation: 45,
  fontColor: '#112233',
  fillColor: '#445566',
  numberFormat: '0.00',
  link: 'https://example.com',
}

describe('isSameSelectionFormat', () => {
  it('treats the identical reference as equal', () => {
    expect(isSameSelectionFormat(BASE, BASE)).toBe(true)
  })

  it('treats two nulls as equal', () => {
    expect(isSameSelectionFormat(null, null)).toBe(true)
  })

  it('treats one null as unequal', () => {
    expect(isSameSelectionFormat(BASE, null)).toBe(false)
    expect(isSameSelectionFormat(null, BASE)).toBe(false)
  })

  it('treats distinct objects with equal fields as equal', () => {
    expect(isSameSelectionFormat(BASE, { ...BASE })).toBe(true)
  })

  // Each field must participate in the comparison; a missed field would silently
  // suppress a legitimate UI update.
  const differences: Array<[keyof SelectionFormat, Partial<SelectionFormat>]> = [
    ['fontFamily', { fontFamily: 'Times' }],
    ['fontSize', { fontSize: 14 }],
    ['bold', { bold: false }],
    ['italic', { italic: true }],
    ['underline', { underline: true }],
    ['strike', { strike: true }],
    ['wrap', { wrap: false }],
    ['horizontalAlignment', { horizontalAlignment: 'left' }],
    ['verticalAlignment', { verticalAlignment: 'bottom' }],
    ['textRotation', { textRotation: 90 }],
    ['fontColor', { fontColor: '#000000' }],
    ['fillColor', { fillColor: '#FFFFFF' }],
    ['numberFormat', { numberFormat: '常规' }],
    ['link', { link: null }],
  ]

  it.each(differences)('detects a change in %s', (_field, patch) => {
    expect(isSameSelectionFormat(BASE, { ...BASE, ...patch })).toBe(false)
  })

  it('covers every field of SelectionFormat', () => {
    expect(differences).toHaveLength(Object.keys(BASE).length)
  })
})

describe('toSelectionFormat', () => {
  it('maps an empty style to defaults', () => {
    const fmt = toSelectionFormat({})
    expect(fmt.fontFamily).toBeNull()
    expect(fmt.fontSize).toBeNull()
    expect(fmt.bold).toBe(false)
    expect(fmt.italic).toBe(false)
    expect(fmt.underline).toBe(false)
    expect(fmt.strike).toBe(false)
    expect(fmt.wrap).toBe(false)
    expect(fmt.horizontalAlignment).toBeNull()
    expect(fmt.verticalAlignment).toBeNull()
    expect(fmt.textRotation).toBeNull()
    expect(fmt.fontColor).toBeNull()
    expect(fmt.fillColor).toBeNull()
    expect(fmt.link).toBeNull()
  })

  it('defaults numberFormat to "General" but substitutes 常规 for an empty string', () => {
    expect(toSelectionFormat({}).numberFormat).toBe('General')
    expect(toSelectionFormat({}, '').numberFormat).toBe('常规')
    expect(toSelectionFormat({}, '0.00').numberFormat).toBe('0.00')
  })

  it('maps boolean-number style flags', () => {
    const fmt = toSelectionFormat({
      bl: BooleanNumber.TRUE,
      it: BooleanNumber.TRUE,
      ul: { s: BooleanNumber.TRUE },
      st: { s: BooleanNumber.TRUE },
      tb: WrapStrategy.WRAP,
    })
    expect(fmt.bold).toBe(true)
    expect(fmt.italic).toBe(true)
    expect(fmt.underline).toBe(true)
    expect(fmt.strike).toBe(true)
    expect(fmt.wrap).toBe(true)
  })

  it('maps alignment enums to names and leaves unknown codes null', () => {
    expect(toSelectionFormat({ ht: 1 }).horizontalAlignment).toBe('left')
    expect(toSelectionFormat({ ht: 2 }).horizontalAlignment).toBe('center')
    expect(toSelectionFormat({ ht: 3 }).horizontalAlignment).toBe('right')
    expect(toSelectionFormat({ vt: 1 }).verticalAlignment).toBe('top')
    expect(toSelectionFormat({ vt: 3 }).verticalAlignment).toBe('bottom')
    expect(toSelectionFormat({ ht: 99 }).horizontalAlignment).toBeNull()
  })

  it('normalizes colors through normalizeHexColor', () => {
    const fmt = toSelectionFormat({
      cl: { rgb: 'rgb(170, 187, 204)' },
      bg: { rgb: '#ddeeff' },
    })
    expect(fmt.fontColor).toBe('#AABBCC')
    expect(fmt.fillColor).toBe('#DDEEFF')
  })

  it('keeps textRotation only when it is numeric', () => {
    expect(toSelectionFormat({ tr: { a: 45 } }).textRotation).toBe(45)
    expect(toSelectionFormat({ tr: { a: 0 } }).textRotation).toBe(0)
  })

  it('builds a fresh object each call, so callers must compare by value', () => {
    const a = toSelectionFormat({})
    const b = toSelectionFormat({})
    expect(a).not.toBe(b)
    expect(isSameSelectionFormat(a, b)).toBe(true)
  })
})
