// src/charts/chartRecommend.ts
// Heuristic chart recommendation algorithm matching Excel & GenOffice

import { chartDataFromValues } from './chartVisual';
import type { ChartGridValue, ChartRecommendations, ParsedChartData, RecommendedKind, RecommendReason } from './types';

const MONTH_NAMES = new Set(
  'jan feb mar apr may jun jul aug sep oct nov dec january february march april june july august september october november december'
    .split(' '),
);

export function isTimeLike(categories: readonly string[]): boolean {
  if (categories.length < 3) return false;
  let dated = 0;
  let numeric = 0;
  let lastNumber = Number.NEGATIVE_INFINITY;
  let increasing = true;
  for (const raw of categories) {
    const label = raw.trim();
    if (label === '') return false;
    const lower = label.toLowerCase().replace(/[.月]$/u, '');
    if (MONTH_NAMES.has(lower) || /^\d{1,2}月$/u.test(label) || /^[qQ][1-4]$/.test(label)) {
      dated += 1;
      continue;
    }
    if (!Number.isNaN(Date.parse(label)) && /[-/年]/u.test(label)) {
      dated += 1;
      continue;
    }
    const asNumber = Number(label);
    if (Number.isInteger(asNumber) && asNumber >= 1900 && asNumber <= 2200) {
      numeric += 1;
      if (asNumber <= lastNumber) increasing = false;
      lastNumber = asNumber;
      continue;
    }
    return false;
  }
  return dated === categories.length || (numeric === categories.length && increasing);
}

export function hasNumericYearAxis(parsed: ParsedChartData): boolean {
  const firstSeries = parsed.series[0];
  return (
    !parsed.hasCategoryColumn &&
    parsed.series.length >= 2 &&
    firstSeries !== undefined &&
    isTimeLike(firstSeries.values.map((value) => String(value)))
  );
}

export function recommendCharts(
  values: readonly (readonly ChartGridValue[])[],
): ChartRecommendations | null {
  let parsed = chartDataFromValues(values);
  if (!parsed) return null;
  if (hasNumericYearAxis(parsed)) {
    parsed = chartDataFromValues(values, { numericCategoryColumn: true }) ?? parsed;
  }
  const rows = parsed.categories.length;
  const seriesCount = parsed.series.length;
  const firstSeries = parsed.series[0];
  if (!firstSeries || rows === 0) return null;

  const time = parsed.hasCategoryColumn && isTimeLike(parsed.categories);
  const allPositive = parsed.series.every((series) => series.values.every((value) => value >= 0));
  const longLabels =
    parsed.hasCategoryColumn &&
    parsed.categories.reduce((sum, label) => sum + label.length, 0) / rows > 12;

  const scatterCandidate = !parsed.hasCategoryColumn && seriesCount >= 2 && rows >= 5;
  const spread = (series: { values: number[] }): number =>
    Math.max(...series.values.map(Math.abs), 0);
  const secondSeries = parsed.series[1];
  const mixedScales =
    seriesCount === 2 &&
    secondSeries !== undefined &&
    spread(firstSeries) > 0 &&
    spread(secondSeries) > 0 &&
    (spread(firstSeries) / spread(secondSeries) > 10 ||
      spread(secondSeries) / spread(firstSeries) > 10);

  const items: ChartRecommendations['items'] = [];
  const add = (kind: RecommendedKind, reason: RecommendReason): void => {
    if (!items.some((item) => item.kind === kind)) items.push({ kind, reason });
  };

  if (scatterCandidate) add('scatter', 'correlation');
  if (time) {
    add('line', 'time');
    if (seriesCount > 1 && allPositive) add('area', 'time');
    if (rows <= 12) add('column', 'time');
  }
  if (seriesCount === 1 && rows >= 2 && rows <= 8 && allPositive) {
    add('pie', 'proportion');
    add('doughnut', 'proportion');
  }
  if (mixedScales) add('combo', 'mixedScales');
  if (longLabels) add('bar', 'longLabels');
  if (rows > 20 || seriesCount >= 4) add('line', 'manyPoints');
  add('column', 'comparison');
  add('bar', 'comparison');
  if (!time && rows >= 3 && rows <= 8 && seriesCount >= 2 && seriesCount <= 3) {
    add('radar', 'comparison');
  }
  add('line', 'comparison');

  return { parsed, items: items.slice(0, 6) };
}

export const REASON_DESCRIPTIONS: Record<RecommendReason, { title: string; desc: string }> = {
  time: {
    title: '时间趋势',
    desc: '识别到日期或时间序列，折线图或时间柱形图最适合展示随时间变化的演进趋势。',
  },
  proportion: {
    title: '部分与整体占比',
    desc: '单一正值数据系列且项目数量适中，适合使用饼图或圆环图清晰展现各项在总体中的占比。',
  },
  correlation: {
    title: '变量相关性',
    desc: '多组纯数值且点数较多，适合用散点图探究变量之间的相关性或离散分布。',
  },
  comparison: {
    title: '类别数值对比',
    desc: '跨分类项目的直接数值对比，柱形图与条形图能提供最直观且准确的高低差距视觉。',
  },
  manyPoints: {
    title: '密集数据走势',
    desc: '数据点或系列较多，使用折线图能够清晰展现走势波动而避免视觉拥挤。',
  },
  longLabels: {
    title: '长文本类别排布',
    desc: '类别文本名称较长，条形图横向排布能使文字更易阅读，避免重叠或倾斜。',
  },
  mixedScales: {
    title: '混合尺度展示',
    desc: '系列间数值量级差异悬殊，组合图（柱线结合）能在同一图表中直观对照不同维度的指标。',
  },
};

export const KIND_NAMES: Record<RecommendedKind, { zh: string; en: string }> = {
  column: { zh: '簇状柱形图', en: 'Clustered Column' },
  bar: { zh: '簇状条形图', en: 'Clustered Bar' },
  line: { zh: '折线图', en: 'Line' },
  area: { zh: '面积图', en: 'Area' },
  pie: { zh: '饼图', en: 'Pie' },
  doughnut: { zh: '圆环图', en: 'Doughnut' },
  scatter: { zh: '散点图', en: 'Scatter' },
  radar: { zh: '雷达图', en: 'Radar' },
  combo: { zh: '组合图 (柱线结合)', en: 'Combo' },
};
