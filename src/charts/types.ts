// src/charts/types.ts
// Comprehensive chart types, recommendations, and visual states

export type RecommendedKind =
  | 'column'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'doughnut'
  | 'scatter'
  | 'radar'
  | 'combo';

export type RecommendReason =
  | 'time'
  | 'proportion'
  | 'correlation'
  | 'comparison'
  | 'manyPoints'
  | 'longLabels'
  | 'mixedScales';

export type ChartGridValue = string | number | boolean | null | undefined;

export interface SheetVisualAnchor {
  fromRow: number;
  fromColumn: number;
  fromRowOffset: number;
  fromColumnOffset: number;
  toRow: number;
  toColumn: number;
  toRowOffset: number;
  toColumnOffset: number;
}

export interface ChartSeriesVisualState {
  name: string;
  nameRef?: string | undefined;
  categories: string[];
  values: number[];
  blanks?: number[] | undefined;
  numberFormat?: string | undefined;
  categoryFormat?: string | undefined;
  color?: string | undefined;
  trendline?: string | undefined;
  valuesRef?: string | undefined;
  categoriesRef?: string | undefined;
  pointColors?: { index: number; color: string }[] | undefined;
  explosionPct?: number | undefined;
  pointExplosions?: { index: number; pct: number }[] | undefined;
  lineColor?: string | undefined;
  lineWidth?: number | undefined;
  smooth?: boolean | undefined;
  marker?: string | undefined;
  categoryGroups?: { label: string; start: number; end: number }[] | undefined;
}

export interface ChartAxisInfoState {
  title?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  majorUnit?: number | undefined;
  numFmt?: string | undefined;
  majorGridlines: boolean;
  hidden: boolean;
  reversed: boolean;
}

export interface ChartVisualState {
  chartTypes: string[];
  barDirection?: string | undefined;
  title: string;
  series: ChartSeriesVisualState[];
  legend?: 'none' | 'right' | 'bottom' | 'top' | 'left' | undefined;
  axisTitles?: { category?: string | null | undefined; value?: string | null | undefined } | undefined;
  dataLabels?: 'none' | 'value' | 'percent' | 'category-percent' | 'category-value-percent' | undefined;
  dataLabelPosition?: 'center' | 'inside-end' | 'outside-end' | undefined;
  dataLabelFormat?: string | undefined;
  grouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard' | undefined;
  gridlines?: boolean | undefined;
  valueAxis?: { min?: number | undefined; max?: number | undefined } | undefined;
  categoryAxisFormat?: string | undefined;
  gapWidthPct?: number | undefined;
  holeSizePct?: number | undefined;
  xAxis?: ChartAxisInfoState | undefined;
  yAxis?: ChartAxisInfoState | undefined;
  secondaryYAxis?: ChartAxisInfoState | undefined;
  scatterStyle?: string | undefined;
  lineMarkers?: boolean | undefined;
  dispBlanksAs?: 'gap' | 'zero' | 'span' | undefined;
  titleStyle?: { size?: number | undefined; bold?: boolean | undefined; color?: string | undefined } | undefined;
  palette?: string | undefined;
}

export interface SheetVisual {
  id: string;
  sheetId: string;
  kind: 'chart';
  anchor: SheetVisualAnchor;
  chart: ChartVisualState;
  pos: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ParsedChartData {
  readonly byRow: boolean;
  readonly hasHeaderRow: boolean;
  readonly hasCategoryColumn: boolean;
  readonly categories: string[];
  readonly series: { name: string; values: number[]; column: number }[];
}

export interface ChartRecommendations {
  parsed: ParsedChartData;
  items: { kind: RecommendedKind; reason: RecommendReason }[];
}

export interface BuildChartVisualInput {
  readonly id: string;
  readonly sheetId: string;
  readonly sheetName: string;
  readonly chartType: RecommendedKind;
  readonly dataRange: string;
  readonly title?: string | undefined;
  readonly anchorCell?: string | undefined;
  readonly values: readonly (readonly ChartGridValue[])[];
  readonly initialPos?: { x: number; y: number; width: number; height: number } | undefined;
}

export interface ChartStateEdit {
  title?: string | undefined;
  chartType?: 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'combo' | undefined;
  seriesColors?: Record<string, string> | undefined;
  pointColors?: Record<string, Record<string, string>> | undefined;
  legend?: ChartVisualState['legend'];
  dataLabels?: ChartVisualState['dataLabels'];
  dataLabelPosition?: ChartVisualState['dataLabelPosition'];
  dataLabelFormat?: ChartVisualState['dataLabelFormat'];
  axisTitles?: ChartVisualState['axisTitles'];
  grouping?: 'clustered' | 'stacked' | 'percentStacked' | undefined;
  gridlines?: boolean | undefined;
  valueAxis?: { min?: number | null | undefined; max?: number | null | undefined } | undefined;
  gapWidthPct?: number | undefined;
  holeSizePct?: number | undefined;
  explosionPct?: number | undefined;
  pointExplosions?: Record<string, number> | undefined;
  series?: {
    index: number;
    name?: string | undefined;
    values?: number[] | undefined;
    categories?: string[] | undefined;
    valuesRef?: string | undefined;
    categoriesRef?: string | undefined;
  }[] | undefined;
  seriesSet?: {
    name: string;
    values: number[];
    categories?: string[] | undefined;
    valuesRef?: string | undefined;
    categoriesRef?: string | undefined;
    color?: string | undefined;
  }[] | undefined;
  palette?: string | undefined;
}

export const COLOR_PALETTES: Record<string, string[]> = {
  office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'],
  blue: ['#1f4e79', '#2e75b6', '#5b9bd5', '#9dc3e6', '#bdd7ee', '#ddebf7'],
  green: ['#385723', '#548235', '#70ad47', '#a9d18e', '#c6e0b4', '#e2efda'],
  warm: ['#c00000', '#ed7d31', '#ffc000', '#f4b183', '#ffd966', '#fce4d6'],
  gray: ['#262626', '#595959', '#7f7f7f', '#a6a6a6', '#d9d9d9', '#f2f2f2'],
};
