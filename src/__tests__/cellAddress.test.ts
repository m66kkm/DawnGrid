import { describe, expect, it } from 'vitest'
import {
  columnIndex,
  columnLabel,
  formatAddress,
  parseAddress,
  parseRange,
  rangeAddresses,
  rangeCellCount,
} from '../charts/cellAddress'

describe('parseAddress', () => {
  it('parses a simple address to zero-based coordinates', () => {
    expect(parseAddress('A1')).toEqual({ row: 0, column: 0 })
    expect(parseAddress('B3')).toEqual({ row: 2, column: 1 })
  })

  it('parses multi-letter columns', () => {
    expect(parseAddress('Z1').column).toBe(25)
    expect(parseAddress('AA1').column).toBe(26)
    expect(parseAddress('AB1').column).toBe(27)
    expect(parseAddress('ZZ1').column).toBe(701)
    expect(parseAddress('AAA1').column).toBe(702)
  })

  it('accepts absolute markers and lowercase, and trims surrounding space', () => {
    expect(parseAddress('$C$5')).toEqual({ row: 4, column: 2 })
    expect(parseAddress('c5')).toEqual({ row: 4, column: 2 })
    expect(parseAddress('  C5  ')).toEqual({ row: 4, column: 2 })
  })

  it('rejects malformed addresses', () => {
    expect(() => parseAddress('')).toThrow(/Invalid cell address/)
    expect(() => parseAddress('A')).toThrow(/Invalid cell address/)
    expect(() => parseAddress('1')).toThrow(/Invalid cell address/)
    expect(() => parseAddress('A1B')).toThrow(/Invalid cell address/)
    expect(() => parseAddress('A-1')).toThrow(/Invalid cell address/)
  })

  it('rejects row zero, since rows are 1-based in A1 notation', () => {
    expect(() => parseAddress('A0')).toThrow(/Invalid cell address/)
  })

  it('rejects leading-zero rows', () => {
    expect(() => parseAddress('A01')).toThrow(/Invalid cell address/)
  })
})

describe('columnLabel', () => {
  it('maps zero-based indices to labels', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
    expect(columnLabel(27)).toBe('AB')
    expect(columnLabel(701)).toBe('ZZ')
    expect(columnLabel(702)).toBe('AAA')
  })

  it('returns an empty label for negative input', () => {
    // Documents actual behaviour: the loop never runs when remaining <= 0.
    expect(columnLabel(-1)).toBe('')
  })
})

describe('columnIndex', () => {
  it('maps labels to zero-based indices', () => {
    expect(columnIndex('A')).toBe(0)
    expect(columnIndex('Z')).toBe(25)
    expect(columnIndex('AA')).toBe(26)
    expect(columnIndex('ZZ')).toBe(701)
    expect(columnIndex('AAA')).toBe(702)
  })

  it('normalizes case and surrounding whitespace', () => {
    expect(columnIndex('  ab  ')).toBe(27)
  })

  it('rejects non-alphabetic labels', () => {
    expect(() => columnIndex('')).toThrow(/Invalid column label/)
    expect(() => columnIndex('A1')).toThrow(/Invalid column label/)
    expect(() => columnIndex('1')).toThrow(/Invalid column label/)
    expect(() => columnIndex('A B')).toThrow(/Invalid column label/)
  })
})

describe('columnLabel / columnIndex round-trip', () => {
  it('are inverses across a wide index range', () => {
    for (const index of [0, 1, 25, 26, 27, 51, 52, 700, 701, 702, 1000, 16383]) {
      expect(columnIndex(columnLabel(index))).toBe(index)
    }
  })
})

describe('formatAddress', () => {
  it('renders zero-based coordinates as 1-based A1 notation', () => {
    expect(formatAddress(0, 0)).toBe('A1')
    expect(formatAddress(4, 2)).toBe('C5')
    expect(formatAddress(0, 26)).toBe('AA1')
  })

  it('round-trips with parseAddress', () => {
    for (const [row, column] of [
      [0, 0],
      [9, 25],
      [99, 26],
      [4, 701],
    ]) {
      expect(parseAddress(formatAddress(row, column))).toEqual({ row, column })
    }
  })
})

describe('parseRange', () => {
  it('parses a two-cell range', () => {
    expect(parseRange('A1:B2')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 1,
      endColumn: 1,
    })
  })

  it('treats a bare address as a single-cell range', () => {
    expect(parseRange('C5')).toEqual({
      startRow: 4,
      startColumn: 2,
      endRow: 4,
      endColumn: 2,
    })
  })

  it('normalizes reversed ranges so start <= end on both axes', () => {
    expect(parseRange('B2:A1')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 1,
      endColumn: 1,
    })
    // Mixed: start row above but column to the right of the end cell.
    expect(parseRange('B1:A2')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 1,
      endColumn: 1,
    })
  })

  it('rejects ranges with more than two parts or an empty first part', () => {
    expect(() => parseRange('A1:B2:C3')).toThrow(/Invalid range/)
    expect(() => parseRange(':B2')).toThrow(/Invalid range/)
    expect(() => parseRange('')).toThrow(/Invalid range/)
  })

  it('propagates address errors from either endpoint', () => {
    expect(() => parseRange('A1:ZZ')).toThrow(/Invalid cell address/)
  })

  it('treats a trailing colon as a single-cell range', () => {
    // Documents actual behaviour: parts[1] is '' (falsy), so `second` falls back to `first`.
    expect(parseRange('A1:')).toEqual({
      startRow: 0,
      startColumn: 0,
      endRow: 0,
      endColumn: 0,
    })
  })
})

describe('rangeCellCount', () => {
  it('counts a single cell as 1', () => {
    expect(rangeCellCount(parseRange('A1'))).toBe(1)
  })

  it('counts rows times columns', () => {
    expect(rangeCellCount(parseRange('A1:B2'))).toBe(4)
    expect(rangeCellCount(parseRange('A1:C10'))).toBe(30)
  })
})

describe('rangeAddresses', () => {
  it('enumerates a single cell', () => {
    expect(rangeAddresses(parseRange('A1'))).toEqual(['A1'])
  })

  it('enumerates in row-major order', () => {
    expect(rangeAddresses(parseRange('A1:B2'))).toEqual(['A1', 'B1', 'A2', 'B2'])
  })

  it('produces exactly rangeCellCount entries', () => {
    const bounds = parseRange('B2:D5')
    expect(rangeAddresses(bounds)).toHaveLength(rangeCellCount(bounds))
  })
})
