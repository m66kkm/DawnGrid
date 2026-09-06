// src/charts/chartVisual.ts
// Chart data parsing, scaling, visual generation and edits

import { numfmt } from '@univerjs/core';
import { columnLabel, parseAddress, parseRange, rangeCellCount } from './cellAddress';
import type {
  BuildChartVisualInput,
  ChartGridValue,
  ChartSeriesVisualState,
  ChartStateEdit,
  ChartVisualState,
  ParsedChartData,
  RecommendedKind,
  SheetVisual,
  SheetVisualAnchor,
} from './types';

export function formatCategoryLabel(raw: string, format: string | undefined): string {
  if (format === undefined || format === 'General' || raw.trim() === '') return raw;
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  try {
    return numfmt.format(format, value, { throws: false });
  } catch {
    return raw;
  }
}

export function chartCategoryFormat(
  chart: Pick<ChartVisualState, 'categoryAxisFormat' | 'series'>,
): string | undefined {
  const axis = chart.categoryAxisFormat;
  if (axis !== undefined && axis !== 'General') return axis;
  const series = chart.series[0]?.categoryFormat;
  return series !== undefined && series !== 'General' ? series : undefined;
}

export interface ScatterAxis {
  min: number;
  max: number;
  ticks: number[];
}

export function scatterAxisBounds(
  values: readonly number[],
  explicit?: { min?: number | undefined; max?: number | undefined; majorUnit?: number | undefined },
): ScatterAxis {
  const finite = values.filter((value) => Number.isFinite(value));
  const dataMin = finite.length > 0 ? Math.min(...finite) : 0;
  const dataMax = finite.length > 0 ? Math.max(...finite) : 1;
  const min = explicit?.min ?? (dataMin >= 0 ? 0 : -niceCeiling(-dataMin));
  let max = explicit?.max ?? (dataMax <= 0 ? 0 : niceCeiling(dataMax));
  if (!(max > min)) max = min + 1;
  const ticks = explicit?.majorUnit
    ? unitTicks(min, max, explicit.majorUnit)
    : [0, 0.25, 0.5, 0.75, 1].map((fraction) => min + fraction * (max - min));
  return { min, max, ticks };
}

export function valueAxisScale(
  dataMax: number,
  explicit?: { min?: number | undefined; max?: number | undefined; majorUnit?: number | undefined },
): { min: number; max: number; ticks: number[] } {
  const min = explicit?.min ?? 0;
  const target = explicit?.max ?? Math.max(dataMax, min);
  const span = target - min;
  if (!(span > 0)) {
    return { min, max: min + 1, ticks: [min, min + 0.5, min + 1] };
  }
  const bumped = explicit?.max === undefined ? span * 1.05 : span;
  const unit = explicit?.majorUnit ?? autoAxisUnit(bumped);
  const max = explicit?.max ?? min + Math.ceil(bumped / unit - 1e-9) * unit;
  return { min, max: max > min ? max : min + unit, ticks: unitTicks(min, max, unit) };
}

function autoAxisUnit(span: number): number {
  let exponent = Math.floor(Math.log10(span)) - 1;
  for (let guard = 0; guard < 6; guard += 1) {
    for (const base of [1, 2, 5]) {
      const unit = base * 10 ** exponent;
      if (span / unit <= 10 + 1e-9) return unit;
    }
    exponent += 1;
  }
  return 10 ** Math.ceil(Math.log10(span));
}

function unitTicks(min: number, max: number, unit: number): number[] {
  const ticks: number[] = [];
  for (let index = 0; index < 25; index += 1) {
    const tick = min + index * unit;
    if (tick > max + unit * 1e-6) break;
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks.length >= 2 ? ticks : [min, max];
}

function niceCeiling(value: number): number {
  let exponent = Math.floor(Math.log10(value)) - 1;
  for (let guard = 0; guard < 8; guard += 1) {
    for (const base of [1, 2, 2.5, 5]) {
      const step = base * 10 ** exponent;
      const intervals = Math.ceil(value / step - 1e-9);
      if (intervals <= 9) return intervals * step;
    }
    exponent += 1;
  }
  return value;
}

export function transposeChartSeries(
  series: readonly ChartSeriesVisualState[],
  seriesLabel: (n: number) => string,
): NonNullable<ChartStateEdit['seriesSet']> | null {
  const seriesNames = series.map((entry, index) => entry.name || seriesLabel(index + 1));
  const categories = series[0]?.categories ?? [];
  if (categories.length === 0) return null;
  return categories.slice(0, 24).map((category, index) => ({
    name: (category || seriesLabel(index + 1)).slice(0, 255),
    values: series.map((entry) => entry.values[index] ?? 0),
    categories: seriesNames,
  }));
}

const LABELABLE_PLOTS = new Set(['barChart', 'lineChart', 'areaChart', 'pieChart', 'doughnutChart']);

export function chartSupportsDataLabels(chartTypes: readonly string[]): boolean {
  return chartTypes.some((type) => LABELABLE_PLOTS.has(type));
}

const SERIES_REPLACEABLE_PLOTS = new Set([
  'barChart',
  'lineChart',
  'areaChart',
  'pieChart',
  'doughnutChart',
  'radarChart',
  'scatterChart',
]);

export function chartSupportsSeriesReplace(chartTypes: readonly string[]): boolean {
  return chartTypes.length === 1 && SERIES_REPLACEABLE_PLOTS.has(chartTypes[0] ?? '');
}

export const CHART_EDIT_TYPES: Record<
  string,
  Pick<ChartVisualState, 'chartTypes' | 'barDirection'>
> = {
  column: { chartTypes: ['barChart'], barDirection: 'col' },
  bar: { chartTypes: ['barChart'], barDirection: 'bar' },
  line: { chartTypes: ['lineChart'], barDirection: undefined },
  area: { chartTypes: ['areaChart'], barDirection: undefined },
  pie: { chartTypes: ['pieChart'], barDirection: undefined },
  doughnut: { chartTypes: ['doughnutChart'], barDirection: undefined },
  scatter: { chartTypes: ['scatterChart'], barDirection: undefined },
  radar: { chartTypes: ['radarChart'], barDirection: undefined },
  combo: { chartTypes: ['barChart', 'lineChart'], barDirection: 'col' },
};

function mergePointColors(
  existing: { index: number; color: string }[] | undefined,
  patch: Record<string, string> | undefined,
): { index: number; color: string }[] | undefined {
  if (!patch) return existing;
  const byIndex = new Map((existing ?? []).map((point) => [point.index, point.color]));
  for (const [key, color] of Object.entries(patch)) byIndex.set(Number(key), color);
  return [...byIndex].map(([index, color]) => ({ index, color })).sort((a, b) => a.index - b.index);
}

function mergePointExplosions(
  existing: { index: number; pct: number }[] | undefined,
  patch: Record<string, number> | undefined,
): { index: number; pct: number }[] | undefined {
  if (!patch) return existing;
  const byIndex = new Map((existing ?? []).map((point) => [point.index, point.pct]));
  for (const [key, pct] of Object.entries(patch)) byIndex.set(Number(key), pct);
  return [...byIndex].map(([index, pct]) => ({ index, pct })).sort((a, b) => a.index - b.index);
}

function mergeValueAxis(
  existing: ChartVisualState['valueAxis'],
  patch: ChartStateEdit['valueAxis'],
): ChartVisualState['valueAxis'] {
  if (!patch) return existing;
  const merged: { min?: number; max?: number } = {};
  const min = patch.min === undefined ? existing?.min : patch.min;
  const max = patch.max === undefined ? existing?.max : patch.max;
  if (typeof min === 'number') merged.min = min;
  if (typeof max === 'number') merged.max = max;
  return Object.keys(merged).length === 0 ? undefined : merged;
}

export function applyChartStateEdit(
  chart: ChartVisualState,
  edit: ChartStateEdit | undefined,
): ChartVisualState {
  if (!edit) return chart;
  const typeOverride: Partial<Pick<ChartVisualState, 'chartTypes' | 'barDirection'>> =
    edit.chartType === undefined ? {} : (CHART_EDIT_TYPES[edit.chartType] ?? {});
  const effectiveTypes = typeOverride.chartTypes ?? chart.chartTypes;
  const grouping =
    edit.grouping === 'clustered' && !effectiveTypes.includes('barChart')
      ? 'standard'
      : edit.grouping;
  const fallbackCategories = chart.series[0]?.categories ?? [];
  const baseSeries: ChartSeriesVisualState[] = edit.seriesSet
    ? edit.seriesSet.map((entry) => ({
        name: entry.name,
        categories: entry.categories ?? fallbackCategories.slice(0, entry.values.length),
        values: entry.values,
        ...(entry.valuesRef === undefined ? {} : { valuesRef: entry.valuesRef }),
        ...(entry.categoriesRef === undefined ? {} : { categoriesRef: entry.categoriesRef }),
        ...(entry.color === undefined ? {} : { color: entry.color }),
      }))
    : chart.series;
  const valueAxis = mergeValueAxis(chart.valueAxis, edit.valueAxis);
  const barDirection =
    edit.chartType !== undefined
      ? typeOverride.barDirection
      : chart.barDirection;
  return {
    ...chart,
    ...(edit.title === undefined ? {} : { title: edit.title }),
    ...(edit.legend === undefined ? {} : { legend: edit.legend }),
    ...(edit.dataLabels === undefined ? {} : { dataLabels: edit.dataLabels }),
    ...(edit.dataLabelPosition === undefined ? {} : { dataLabelPosition: edit.dataLabelPosition }),
    ...(edit.dataLabelFormat === undefined ? {} : { dataLabelFormat: edit.dataLabelFormat }),
    ...(edit.axisTitles === undefined
      ? {}
      : { axisTitles: { ...chart.axisTitles, ...edit.axisTitles } }),
    ...(grouping === undefined ? {} : { grouping }),
    ...(edit.gridlines === undefined ? {} : { gridlines: edit.gridlines }),
    ...(edit.valueAxis === undefined ? {} : { valueAxis }),
    ...(edit.gapWidthPct === undefined ? {} : { gapWidthPct: edit.gapWidthPct }),
    ...(edit.holeSizePct === undefined ? {} : { holeSizePct: edit.holeSizePct }),
    ...(edit.palette === undefined ? {} : { palette: edit.palette }),
    ...typeOverride,
    barDirection,
    series: baseSeries.map((series, index) => {
      const color = edit.seriesColors?.[String(index)];
      const pointColors = mergePointColors(series.pointColors, edit.pointColors?.[String(index)]);
      const pointExplosions =
        index === 0
          ? mergePointExplosions(series.pointExplosions, edit.pointExplosions)
          : series.pointExplosions;
      const data = edit.series?.find((entry) => entry.index === index);
      return {
        ...series,
        ...(color === undefined ? {} : { color }),
        ...(pointColors === undefined ? {} : { pointColors }),
        ...(pointExplosions === undefined ? {} : { pointExplosions }),
        ...(index === 0 && edit.explosionPct !== undefined
          ? { explosionPct: edit.explosionPct }
          : {}),
        ...(data?.name === undefined ? {} : { name: data.name }),
        ...(data?.values === undefined ? {} : { values: data.values, blanks: undefined }),
        ...(data?.categories === undefined
          ? {}
          : { categories: data.categories, categoryGroups: undefined }),
        ...(data?.valuesRef === undefined ? {} : { valuesRef: data.valuesRef }),
        ...(data?.categoriesRef === undefined ? {} : { categoriesRef: data.categoriesRef }),
      };
    }),
  };
}

const MAX_CHART_ROWS = 500;
const MAX_CHART_SERIES = 12;

export function chartDataFromValues(
  source: readonly (readonly ChartGridValue[])[],
  options?: {
    numericCategoryColumn?: boolean;
  },
): ParsedChartData | null {
  const sourceFirstRow = source[0];
  if (!sourceFirstRow || sourceFirstRow.length === 0) return null;
  const byRow = sourceFirstRow.length > 1 && source.length <= sourceFirstRow.length;
  const grid = byRow
    ? sourceFirstRow.map((_, column) => source.map((row) => row[column] ?? null))
    : source;
  const firstRow = grid[0];
  if (!firstRow || firstRow.length === 0) return null;
  const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '';
  const isNumeric = (v: unknown): boolean =>
    typeof v === 'number' ||
    (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
  const toNumber = (v: unknown): number =>
    typeof v === 'number' ? v : isNumeric(v) ? Number(String(v).trim()) : 0;
  const width = firstRow.length;

  const hasLabelHeader =
    grid.length > 1 &&
    firstRow.some((v, i) => (width === 1 || i > 0) && !isBlank(v) && !isNumeric(v));
  const hasCrossTabHeader =
    grid.length > 1 &&
    width > 1 &&
    isBlank(firstRow[0]) &&
    firstRow.every((v, i) => i === 0 || !isBlank(v));
  const hasHeaderRow = hasLabelHeader || hasCrossTabHeader;
  const body = (hasHeaderRow ? grid.slice(1) : grid).slice(0, MAX_CHART_ROWS);
  if (body.length === 0) return null;

  const hasCategoryColumn =
    width > 1 &&
    (hasCrossTabHeader ||
      body.some((row) => !isBlank(row[0]) && !isNumeric(row[0])) ||
      (options?.numericCategoryColumn === true && body.some((row) => isNumeric(row[0]))));
  const categories = body.map((row, i) =>
    hasCategoryColumn ? String(row[0] ?? '') : String(i + 1),
  );
  const series: ParsedChartData['series'] = [];
  for (let column = hasCategoryColumn ? 1 : 0; column < width; column++) {
    if (!body.some((row) => isNumeric(row[column]))) continue;
    const header = hasHeaderRow ? firstRow[column] : null;
    series.push({
      name: isBlank(header) ? `系列 ${series.length + 1}` : String(header),
      values: body.map((row) => toNumber(row[column])),
      column,
    });
    if (series.length >= MAX_CHART_SERIES) break;
  }

  if (series.length === 0 && hasCategoryColumn && body.some((row) => isNumeric(row[0]))) {
    const header = hasHeaderRow ? firstRow[0] : null;
    return {
      byRow,
      hasHeaderRow,
      hasCategoryColumn: false,
      categories: body.map((_, i) => String(i + 1)),
      series: [
        {
          name: isBlank(header) ? '系列 1' : String(header),
          values: body.map((row) => toNumber(row[0])),
          column: 0,
        },
      ],
    };
  }
  return series.length > 0 ? { byRow, hasHeaderRow, hasCategoryColumn, categories, series } : null;
}

function a1RangeRef(sheetName: string, column: number, fromRow: number, toRow: number): string {
  const col = columnLabel(column);
  const name = sheetName.replace(/'/g, "''");
  return `'${name}'!$${col}$${fromRow + 1}:$${col}$${toRow + 1}`;
}

function a1RowRangeRef(
  sheetName: string,
  row: number,
  fromColumn: number,
  toColumn: number,
): string {
  const name = sheetName.replace(/'/g, "''");
  return `'${name}'!$${columnLabel(fromColumn)}$${row + 1}:$${columnLabel(toColumn)}$${row + 1}`;
}

const CHART_KIND_TO_TYPES: Record<RecommendedKind, string[]> = {
  column: ['barChart'],
  bar: ['barChart'],
  line: ['lineChart'],
  area: ['areaChart'],
  pie: ['pieChart'],
  doughnut: ['doughnutChart'],
  scatter: ['scatterChart'],
  radar: ['radarChart'],
  combo: ['barChart', 'lineChart'],
};

export function buildChartVisual(input: BuildChartVisualInput): SheetVisual {
  const bounds = parseRange(input.dataRange);
  if (rangeCellCount(bounds) > 5000) {
    throw new Error('所选数据区域单元格数量超过 5000，请缩小选择范围。');
  }
  const parsed = chartDataFromValues(input.values);
  if (!parsed) {
    throw new Error('所选数据区域需要至少包含一列有效数值以生成图表。');
  }

  const anchorBase = input.anchorCell === undefined ? null : parseAddress(input.anchorCell);
  const anchor: SheetVisualAnchor =
    anchorBase === null
      ? {
          fromRow: bounds.startRow,
          fromColumn: bounds.endColumn + 2,
          fromRowOffset: 0,
          fromColumnOffset: 0,
          toRow: bounds.startRow + 15,
          toColumn: bounds.endColumn + 9,
          toRowOffset: 0,
          toColumnOffset: 0,
        }
      : {
          fromRow: anchorBase.row,
          fromColumn: anchorBase.column,
          fromRowOffset: 0,
          fromColumnOffset: 0,
          toRow: anchorBase.row + 15,
          toColumn: anchorBase.column + 7,
          toRowOffset: 0,
          toColumnOffset: 0,
        };

  const dataStartRow = bounds.startRow + (parsed.hasHeaderRow && !parsed.byRow ? 1 : 0);
  const dataStartColumn = bounds.startColumn + (parsed.hasHeaderRow && parsed.byRow ? 1 : 0);

  const defaultPos = input.initialPos ?? {
    x: 80 + (bounds.endColumn + 1) * 80,
    y: 40 + bounds.startRow * 24,
    width: 520,
    height: 340,
  };

  return {
    id: input.id,
    sheetId: input.sheetId,
    kind: 'chart',
    anchor,
    pos: defaultPos,
    chart: {
      chartTypes: [...CHART_KIND_TO_TYPES[input.chartType]],
      ...(input.chartType === 'column' || input.chartType === 'bar' || input.chartType === 'combo'
        ? {
            barDirection: input.chartType === 'bar' ? 'bar' : 'col',
            ...(input.chartType === 'combo' ? {} : { dataLabels: 'value' as const }),
          }
        : {}),
      title:
        input.title ??
        (parsed.series.length === 1 && parsed.series[0] ? parsed.series[0].name : '图表标题'),
      series: parsed.series.map((series) => ({
        name: series.name,
        categories: parsed.categories,
        values: series.values,
        ...(parsed.byRow
          ? {
              valuesRef: a1RowRangeRef(
                input.sheetName,
                bounds.startRow + series.column,
                dataStartColumn,
                bounds.endColumn,
              ),
              ...(parsed.hasCategoryColumn
                ? {
                    categoriesRef: a1RowRangeRef(
                      input.sheetName,
                      bounds.startRow,
                      dataStartColumn,
                      bounds.endColumn,
                    ),
                  }
                : {}),
            }
          : {
              valuesRef: a1RangeRef(
                input.sheetName,
                series.column + bounds.startColumn,
                dataStartRow,
                bounds.endRow,
              ),
              ...(parsed.hasCategoryColumn
                ? {
                    categoriesRef: a1RangeRef(
                      input.sheetName,
                      bounds.startColumn,
                      dataStartRow,
                      bounds.endRow,
                    ),
                  }
                : {}),
            }),
      })),
    },
  };
}
