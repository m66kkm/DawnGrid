/**
 * Sets an explicit height on a set of rows using a single command.
 *
 * The facade's per-row setters each dispatch a synchronous command, so applying N
 * rows costs N command round-trips and can block the main thread for seconds.
 * SetRowHeightCommand accepts a ranges array, so scattered rows (e.g. filter
 * results) are collapsed into contiguous runs and applied in one dispatch.
 */
export function setRowHeightsBatched(
  univerAPI: any,
  unitId: string,
  subUnitId: string,
  columnCount: number,
  rows: number[],
  height: number,
): void {
  if (rows.length === 0) return;
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const ranges: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === runEnd + 1) {
      runEnd = sorted[i];
      continue;
    }
    ranges.push({ startRow: runStart, endRow: runEnd, startColumn: 0, endColumn: columnCount - 1 });
    runStart = sorted[i];
    runEnd = sorted[i];
  }
  ranges.push({ startRow: runStart, endRow: runEnd, startColumn: 0, endColumn: columnCount - 1 });

  try {
    void univerAPI.executeCommand("sheet.command.set-row-height", {
      unitId,
      subUnitId,
      ranges,
      value: height,
    });
  } catch {
    // ignore row height errors
  }
}
