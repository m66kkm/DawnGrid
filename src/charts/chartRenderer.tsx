// src/charts/chartRenderer.tsx
// Full-featured SVG Chart renderer with smooth color & type transition animations

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChartVisualState } from './types';
import { COLOR_PALETTES } from './types';
import { formatCategoryLabel, valueAxisScale } from './chartVisual';

function formatDataLabelValue(value: number, formatCode?: string): string {
  if (formatCode && formatCode.trim() !== '') {
    const code = formatCode.trim();
    const decimals = /0\.(0+)/.exec(code)?.[1]?.length ?? 0;
    if (code.includes('%')) {
      return `${(value * 100).toFixed(decimals)}%`;
    }
    const fixed = value.toFixed(decimals);
    if (code.includes(',')) {
      const [whole, fraction] = fixed.split('.');
      const grouped = Number(whole).toLocaleString('en-US');
      return fraction !== undefined ? `${grouped}.${fraction}` : grouped;
    }
    return fixed;
  }
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
}

interface DataLabelContent {
  main: string;
  secondary?: string;
}

function getDataLabelText(
  mode: ChartVisualState['dataLabels'],
  val: number,
  category: string,
  seriesName: string,
  total: number,
  formatCode?: string,
): DataLabelContent {
  const formattedVal = formatDataLabelValue(val, formatCode);
  const share = total > 0 ? Math.max(0, val) / total : 0;
  const pct = formatCode && formatCode.includes('%')
    ? formatDataLabelValue(share, formatCode)
    : `${Math.round(share * 100)}%`;

  switch (mode) {
    case 'percent':
      return { main: pct };
    case 'category-percent':
      return { main: category || '项目', secondary: pct };
    case 'category-value-percent':
      return { main: category || '项目', secondary: `${formattedVal} (${pct})` };
    case 'category-value':
      return { main: category ? `${category}: ${formattedVal}` : formattedVal };
    case 'series-value':
      return { main: seriesName ? `${seriesName}: ${formattedVal}` : formattedVal };
    case 'value':
    default:
      return { main: formattedVal };
  }
}

interface ChartRendererProps {
  chart: ChartVisualState;
  width: number;
  height: number;
}

export function ChartRenderer({ chart, width, height }: ChartRendererProps): React.JSX.Element {
  const paletteColors = (chart.palette && COLOR_PALETTES[chart.palette]) || COLOR_PALETTES.office;
  const defaultColors = paletteColors;
  const seriesCount = chart.series.length;
  const primarySeries = chart.series[0];
  const categories = primarySeries?.categories ?? [];
  const numCategories = Math.max(categories.length, 1);

  // Grouping modes
  const isStacked = chart.grouping === 'stacked';
  const isPercentStacked = chart.grouping === 'percentStacked';

  const types = chart.chartTypes;
  const isBarHorizontal = chart.barDirection === 'bar';
  const isPie = types.includes('pieChart') || types.includes('doughnutChart');
  const isDoughnut = types.includes('doughnutChart');
  const isScatter = types.includes('scatterChart');
  const isRadar = types.includes('radarChart');
  const isLine = types.includes('lineChart') && !types.includes('barChart');
  const isArea = types.includes('areaChart') && !types.includes('barChart');
  const isCombo = types.includes('barChart') && types.includes('lineChart');

  // Compute active chart mode for animation keying
  const chartMode = isPie
    ? (isDoughnut ? 'doughnut' : 'pie')
    : isBarHorizontal
      ? 'bar'
      : isLine
        ? 'line'
        : isArea
          ? 'area'
          : isScatter
            ? 'scatter'
            : isRadar
              ? 'radar'
              : isCombo
                ? 'combo'
                : 'column';
  const groupMode = chart.grouping || 'clustered';
  const chartTypeAnimKey = `${chartMode}-${groupMode}`;

  // Palette change pulse feedback
  const [pulsePalette, setPulsePalette] = useState(false);
  const prevPaletteRef = useRef(chart.palette);

  useEffect(() => {
    if (chart.palette && chart.palette !== prevPaletteRef.current) {
      prevPaletteRef.current = chart.palette;
      setPulsePalette(true);
      const timer = setTimeout(() => setPulsePalette(false), 550);
      return () => clearTimeout(timer);
    }
  }, [chart.palette]);

  // Axis title checks
  const hasCatAxisTitle = Boolean(chart.axisTitles?.category && !isPie && !isRadar);
  const hasValAxisTitle = Boolean(chart.axisTitles?.value && !isPie && !isRadar);

  // Layout metrics
  const titleHeight = chart.title ? 32 : 10;
  const legendPos = chart.legend ?? (seriesCount > 1 || isPie ? 'right' : 'none');
  const showLegend = legendPos !== 'none' && (seriesCount > 0 || (isPie && categories.length > 0));

  let legendWidth = 0;
  let legendHeight = 0;
  if (showLegend) {
    if (legendPos === 'right' || legendPos === 'left') {
      legendWidth = Math.min(130, Math.max(80, width * 0.22));
    } else {
      legendHeight = 28;
    }
  }

  const paddingLeft = isPie || isRadar ? 20 : (legendPos === 'left' ? legendWidth + 45 : 55) + (hasValAxisTitle ? 20 : 0);
  const paddingRight = isPie || isRadar ? 20 : (legendPos === 'right' ? legendWidth + 20 : 25);
  const paddingTop = titleHeight + (legendPos === 'top' ? legendHeight + 8 : 8);
  const paddingBottom = isPie || isRadar ? 20 : (legendPos === 'bottom' ? legendHeight + 35 : 35) + (hasCatAxisTitle ? 20 : 0);

  const plotWidth = Math.max(10, width - paddingLeft - paddingRight);
  const plotHeight = Math.max(10, height - paddingTop - paddingBottom);

  // Value axis calculations
  const allValues = chart.series.flatMap((s) => s.values);
  const catPositiveTotals = Array.from({ length: numCategories }, (_, i) =>
    chart.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
  );
  const stackMaxVal = Math.max(...catPositiveTotals, 10);

  const maxVal = isPercentStacked
    ? 100
    : isStacked
      ? stackMaxVal
      : (allValues.length > 0 ? Math.max(...allValues, 0) : 10);
  const minVal = isPercentStacked || isStacked
    ? 0
    : (allValues.length > 0 ? Math.min(...allValues, 0) : 0);

  const scale = isPercentStacked
    ? { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100] }
    : valueAxisScale(maxVal, {
        min: chart.valueAxis?.min ?? (minVal < 0 ? minVal : 0),
        max: chart.valueAxis?.max,
      });

  const valSpan = Math.max(scale.max - scale.min, 1e-6);
  const getY = (val: number): number =>
    paddingTop + plotHeight - ((val - scale.min) / valSpan) * plotHeight;
  const getX = (val: number): number =>
    paddingLeft + ((val - scale.min) / valSpan) * plotWidth;

  const showGrid = chart.gridlines !== false && !isPie && !isRadar;
  const showDataLabels = chart.dataLabels && chart.dataLabels !== 'none';

  // Build legend items (Pie shows categories, other charts show series)
  const legendItems = isPie
    ? categories.map((cat, i) => {
        const sliceColor =
          primarySeries?.pointColors?.find((p) => p.index === i)?.color ??
          defaultColors[i % defaultColors.length];
        return { name: cat || `类别 ${i + 1}`, color: sliceColor };
      })
    : chart.series.map((series, sIndex) => ({
        name: series.name || `系列 ${sIndex + 1}`,
        color: series.color ?? defaultColors[sIndex % defaultColors.length],
      }));

  return (
    <div
      className={`chart-container-inner ${pulsePalette ? 'palette-pulse' : ''}`}
      style={{
        width,
        height,
        position: 'relative',
        userSelect: 'none',
        background: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Title */}
      {chart.title && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: chart.titleStyle?.size ? `${chart.titleStyle.size}pt` : '14px',
            fontWeight: chart.titleStyle?.bold === false ? 'normal' : 600,
            color: chart.titleStyle?.color ?? '#24292f',
            pointerEvents: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 12px',
          }}
        >
          {chart.title}
        </div>
      )}

      {/* Chart SVG Scene with Motion Layer 3 Orchestration */}
      <AnimatePresence mode="wait">
        <motion.div
          key={chartTypeAnimKey}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <style>{`
          /* Smooth color transitions for palette switching */
          .chart-elem-transition {
            transition: fill 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                        stroke 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                        opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                        filter 0.2s ease,
                        transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .chart-elem-transition:hover {
            filter: brightness(1.12);
            cursor: pointer;
          }

          /* Column Bar Entrance */
          @keyframes chartColBarGrow {
            0% { transform: scaleY(0); opacity: 0; }
            65% { transform: scaleY(1.04); opacity: 0.95; }
            100% { transform: scaleY(1); opacity: 1; }
          }
          .chart-col-bar {
            transform-box: fill-box;
            transform-origin: bottom center;
            animation: chartColBarGrow 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Horizontal Bar Entrance */
          @keyframes chartHorizBarGrow {
            0% { transform: scaleX(0); opacity: 0; }
            65% { transform: scaleX(1.04); opacity: 0.95; }
            100% { transform: scaleX(1); opacity: 1; }
          }
          .chart-horiz-bar {
            transform-box: fill-box;
            transform-origin: left center;
            animation: chartHorizBarGrow 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Line Path Entrance */
          @keyframes chartLineEnter {
            0% { opacity: 0; transform: translateY(14px) scaleY(0.9); }
            100% { opacity: 1; transform: translateY(0) scaleY(1); }
          }
          .chart-line-path {
            transform-origin: bottom center;
            animation: chartLineEnter 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Point Pop Entrance */
          @keyframes chartPointPop {
            0% { transform: scale(0); opacity: 0; }
            65% { transform: scale(1.4); opacity: 0.95; }
            100% { transform: scale(1); opacity: 1; }
          }
          .chart-point-dot {
            transform-box: fill-box;
            transform-origin: center;
            animation: chartPointPop 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .chart-point-dot:hover {
            transform: scale(1.6) !important;
            cursor: pointer;
          }

          /* Area Fill Entrance */
          @keyframes chartAreaEnter {
            0% { opacity: 0; transform: scaleY(0.2); }
            100% { opacity: 0.35; transform: scaleY(1); }
          }
          .chart-area-fill {
            transform-box: fill-box;
            transform-origin: bottom center;
            animation: chartAreaEnter 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Pie Slice Entrance */
          @keyframes chartPieSliceEnter {
            0% { transform: scale(0.62) rotate(-16deg); opacity: 0; }
            70% { transform: scale(1.03) rotate(2deg); opacity: 0.95; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .chart-pie-slice {
            transform-box: fill-box;
            transform-origin: center;
            animation: chartPieSliceEnter 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .chart-pie-slice:hover {
            transform: scale(1.045) !important;
            filter: brightness(1.1);
            cursor: pointer;
          }

          /* Doughnut Hole Animation */
          @keyframes chartHolePop {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .chart-animated-doughnut-hole {
            transform-box: fill-box;
            transform-origin: center;
            animation: chartHolePop 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Radar Polygon Animation */
          @keyframes chartRadarEnter {
            0% { transform: scale(0.3); opacity: 0; }
            100% { transform: scale(1); opacity: 0.3; }
          }
          .chart-radar-poly {
            animation: chartRadarEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          /* Data Label Fade & Rise Animation */
          @keyframes chartLabelEnter {
            0% { opacity: 0; transform: translateY(6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .chart-data-label {
            animation: chartLabelEnter 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        `}</style>

        {/* Gridlines & Value Axis */}
        {showGrid && (
          <g className="chart-gridlines">
            {scale.ticks.map((tick, i) => {
              const y = getY(tick);
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + plotWidth}
                    y2={y}
                    stroke="#e8eaed"
                    strokeWidth={1}
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fill="#5f6368"
                  >
                    {isPercentStacked ? `${tick}%` : tick}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Category Axis Line */}
        {!isPie && !isRadar && (
          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={paddingLeft + plotWidth}
            y2={paddingTop + plotHeight}
            stroke="#5f6368"
            strokeWidth={1}
          />
        )}

        {/* Category Labels */}
        {!isPie && !isRadar && !isBarHorizontal && (
          <g className="chart-category-labels">
            {categories.map((cat, i) => {
              const step = plotWidth / numCategories;
              const x = paddingLeft + i * step + step / 2;
              const formatted = formatCategoryLabel(cat, chart.categoryAxisFormat);
              return (
                <text
                  key={i}
                  x={x}
                  y={paddingTop + plotHeight + 16}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#5f6368"
                >
                  {formatted.length > 8 ? `${formatted.slice(0, 7)}…` : formatted}
                </text>
              );
            })}
          </g>
        )}

        {/* PIE / DOUGHNUT CHART */}
        {isPie && (
          <g key={`pie-${chartTypeAnimKey}`} className="chart-pie-group">
            {(() => {
              const cx = paddingLeft + plotWidth / 2;
              const cy = paddingTop + plotHeight / 2;
              const radius = Math.min(plotWidth, plotHeight) / 2.1;
              const vals = primarySeries?.values ?? [];
              const total = vals.reduce((sum, v) => sum + Math.max(v, 0), 0) || 1;
              let currentAngle = -Math.PI / 2;

              return (
                <>
                  {vals.map((v, i) => {
                    const sweep = (Math.max(v, 0) / total) * Math.PI * 2;
                    const from = currentAngle;
                    currentAngle += sweep;
                    const x1 = cx + radius * Math.cos(from);
                    const y1 = cy + radius * Math.sin(from);
                    const x2 = cx + radius * Math.cos(currentAngle);
                    const y2 = cy + radius * Math.sin(currentAngle);
                    const mid = from + sweep / 2;
                    const color =
                      primarySeries?.pointColors?.find((p) => p.index === i)?.color ??
                      defaultColors[i % defaultColors.length];

                    const d = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;

                    return (
                      <g key={i}>
                        <path
                          d={d}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          className="chart-pie-slice chart-elem-transition"
                          style={{ animationDelay: `${i * 45}ms` }}
                        />
                        {showDataLabels && sweep > 0.08 && (() => {
                          const pos = chart.dataLabelPosition ?? 'inside-end';
                          const labelInfo = getDataLabelText(
                            chart.dataLabels,
                            v,
                            categories[i] || `类别 ${i + 1}`,
                            primarySeries?.name || '',
                            total,
                            chart.dataLabelFormat,
                          );

                          if (pos === 'outside-end') {
                            const elbowDist = radius * 1.15;
                            const elbowX = cx + elbowDist * Math.cos(mid);
                            const elbowY = cy + elbowDist * Math.sin(mid);
                            const isRight = Math.cos(mid) >= 0;
                            const tick = 12;
                            const textX = elbowX + (isRight ? tick : -tick);
                            const textY = elbowY + 3;
                            const sliceEdgeX = cx + (radius + 2) * Math.cos(mid);
                            const sliceEdgeY = cy + (radius + 2) * Math.sin(mid);

                            return (
                              <g key={`pie-lbl-${i}`}>
                                <polyline
                                  points={`${sliceEdgeX.toFixed(1)},${sliceEdgeY.toFixed(1)} ${elbowX.toFixed(1)},${elbowY.toFixed(1)} ${textX.toFixed(1)},${elbowY.toFixed(1)}`}
                                  fill="none"
                                  stroke="#8c959f"
                                  strokeWidth={1}
                                  strokeDasharray="2,2"
                                />
                                <text
                                  x={textX + (isRight ? 3 : -3)}
                                  y={textY}
                                  textAnchor={isRight ? 'start' : 'end'}
                                  fontSize="10"
                                  fontWeight="600"
                                  fill="#24292f"
                                  className="chart-data-label"
                                  style={{ animationDelay: `${i * 45 + 150}ms` }}
                                >
                                  {labelInfo.secondary ? (
                                    <>
                                      <tspan x={textX + (isRight ? 3 : -3)} dy="-0.2em">{labelInfo.main}</tspan>
                                      <tspan x={textX + (isRight ? 3 : -3)} dy="1.25em" fill="#57606a" fontSize="9">{labelInfo.secondary}</tspan>
                                    </>
                                  ) : (
                                    labelInfo.main
                                  )}
                                </text>
                              </g>
                            );
                          }

                          const innerR = isDoughnut ? radius * ((chart.holeSizePct ?? 50) / 100) : 0;
                          const dist = pos === 'center'
                            ? (innerR > 0 ? (radius + innerR) / 2 : radius * 0.52)
                            : (innerR > 0 ? (radius + innerR) / 2 + (radius - innerR) * 0.25 : radius * 0.76);
                          const lx = cx + dist * Math.cos(mid);
                          const ly = cy + dist * Math.sin(mid);

                          return (
                            <text
                              x={lx}
                              y={labelInfo.secondary ? ly - 2 : ly + 3.5}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="bold"
                              fill="#ffffff"
                              className="chart-data-label"
                              style={{ animationDelay: `${i * 45 + 150}ms` }}
                            >
                              {labelInfo.secondary ? (
                                <>
                                  <tspan x={lx} dy="0">{labelInfo.main}</tspan>
                                  <tspan x={lx} dy="1.2em">{labelInfo.secondary}</tspan>
                                </>
                              ) : (
                                labelInfo.main
                              )}
                            </text>
                          );
                        })()}
                      </g>
                    );
                  })}
                  {isDoughnut && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius * ((chart.holeSizePct ?? 50) / 100)}
                      fill="#ffffff"
                      className="chart-animated-doughnut-hole"
                    />
                  )}
                </>
              );
            })()}
          </g>
        )}

        {/* COLUMN CHART */}
        {!isPie && !isBarHorizontal && !isRadar && !isLine && !isArea && (
          <g key={`col-${chartTypeAnimKey}`} className="chart-bars-group">
            {isStacked || isPercentStacked ? (
              // Stacked / PercentStacked Column
              categories.map((_, i) => {
                const band = plotWidth / numCategories;
                const barWidth = Math.max(6, Math.min(36, band * 0.65));
                const x = paddingLeft + i * band + (band - barWidth) / 2;
                const total = isPercentStacked ? (catPositiveTotals[i] || 1) : 1;
                let cumVal = 0;

                return (
                  <g key={i}>
                    {chart.series.map((series, sIndex) => {
                      const v = Math.max(0, series.values[i] ?? 0);
                      const color = series.color ?? defaultColors[sIndex % defaultColors.length];
                      const startVal = cumVal;
                      cumVal += v;
                      const endVal = cumVal;

                      const y1 = isPercentStacked
                        ? paddingTop + plotHeight - (startVal / total) * plotHeight
                        : getY(startVal);
                      const y2 = isPercentStacked
                        ? paddingTop + plotHeight - (endVal / total) * plotHeight
                        : getY(endVal);
                      const barY = Math.min(y1, y2);
                      const barH = Math.max(0, Math.abs(y1 - y2));

                      return (
                        <g key={`${sIndex}-${i}`}>
                          <rect
                            x={x}
                            y={barY}
                            width={barWidth}
                            height={barH}
                            fill={color}
                            stroke="#ffffff"
                            strokeWidth={0.5}
                            className="chart-col-bar chart-elem-transition"
                            style={{ animationDelay: `${i * 35 + sIndex * 20}ms` }}
                          />
                          {showDataLabels && barH > 10 && (() => {
                            const pos = chart.dataLabelPosition ?? 'center';
                            const labelInfo = getDataLabelText(
                              chart.dataLabels,
                              v,
                              categories[i] ?? '',
                              series.name,
                              total,
                              chart.dataLabelFormat,
                            );
                            let labelY = barY + barH / 2 + 3.5;
                            let fill = '#ffffff';

                            if (pos === 'inside-end' && barH >= 18) {
                              labelY = barY + 12;
                            } else if (pos === 'inside-base' && barH >= 18) {
                              labelY = barY + barH - 4;
                            } else if (pos === 'outside-end' && sIndex === chart.series.length - 1) {
                              labelY = Math.max(paddingTop + 10, barY - 4);
                              fill = '#24292f';
                            }

                            const displayText = isPercentStacked && (!chart.dataLabels || chart.dataLabels === 'none' || chart.dataLabels === 'percent')
                              ? `${Math.round((v / total) * 100)}%`
                              : labelInfo.main;

                            return (
                              <text
                                x={x + barWidth / 2}
                                y={labelY}
                                textAnchor="middle"
                                fontSize="9"
                                fill={fill}
                                fontWeight="600"
                                className="chart-data-label"
                                style={{ animationDelay: `${i * 35 + sIndex * 20 + 120}ms` }}
                              >
                                {displayText}
                              </text>
                            );
                          })()}
                        </g>
                      );
                    })}
                  </g>
                );
              })
            ) : (
              // Clustered Column
              chart.series.map((series, sIndex) => {
                const color = series.color ?? defaultColors[sIndex % defaultColors.length];
                const band = plotWidth / numCategories;
                const barWidth = Math.max(
                  4,
                  Math.min(28, (band * (1 - (chart.gapWidthPct ?? 150) / 400)) / seriesCount),
                );

                return series.values.map((v, i) => {
                  const x = paddingLeft + i * band + sIndex * barWidth + (band - seriesCount * barWidth) / 2;
                  const y = getY(v);
                  const barH = Math.max(0, paddingTop + plotHeight - y);

                  return (
                    <g key={`${sIndex}-${i}`}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barH}
                        fill={color}
                        rx={1.5}
                        className="chart-col-bar chart-elem-transition"
                        style={{ animationDelay: `${i * 35 + sIndex * 20}ms` }}
                      />
                      {showDataLabels && (() => {
                        const pos = chart.dataLabelPosition ?? 'outside-end';
                        const labelInfo = getDataLabelText(
                          chart.dataLabels,
                          v,
                          categories[i] ?? '',
                          series.name,
                          0,
                          chart.dataLabelFormat,
                        );
                        let labelY = Math.max(paddingTop + 10, y - 4);
                        let fill = '#24292f';

                        if (pos === 'inside-end') {
                          if (barH >= 20) {
                            labelY = y + 13;
                            fill = '#ffffff';
                          } else {
                            labelY = Math.max(paddingTop + 10, y - 4);
                            fill = '#24292f';
                          }
                        } else if (pos === 'center') {
                          if (barH >= 16) {
                            labelY = y + barH / 2 + 3.5;
                            fill = '#ffffff';
                          } else {
                            labelY = Math.max(paddingTop + 10, y - 4);
                            fill = '#24292f';
                          }
                        } else if (pos === 'inside-base') {
                          if (barH >= 20) {
                            labelY = y + barH - 6;
                            fill = '#ffffff';
                          } else {
                            labelY = Math.max(paddingTop + 10, y - 4);
                            fill = '#24292f';
                          }
                        }

                        return (
                          <text
                            x={x + barWidth / 2}
                            y={labelY}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill={fill}
                            fontWeight="600"
                            className="chart-data-label"
                            style={{ animationDelay: `${i * 35 + sIndex * 20 + 120}ms` }}
                          >
                            {labelInfo.main}
                          </text>
                        );
                      })()}
                    </g>
                  );
                });
              })
            )}
          </g>
        )}

        {/* BAR (HORIZONTAL) CHART */}
        {isBarHorizontal && (
          <g key={`bar-${chartTypeAnimKey}`} className="chart-horizontal-bars">
            {isStacked || isPercentStacked ? (
              // Stacked / PercentStacked Horizontal Bar
              categories.map((_, i) => {
                const band = plotHeight / numCategories;
                const barHeight = Math.max(6, Math.min(30, band * 0.65));
                const y = paddingTop + i * band + (band - barHeight) / 2;
                const total = isPercentStacked ? (catPositiveTotals[i] || 1) : 1;
                let cumVal = 0;

                return (
                  <g key={i}>
                    {chart.series.map((series, sIndex) => {
                      const v = Math.max(0, series.values[i] ?? 0);
                      const color = series.color ?? defaultColors[sIndex % defaultColors.length];
                      const startVal = cumVal;
                      cumVal += v;
                      const endVal = cumVal;

                      const x1 = isPercentStacked
                        ? paddingLeft + (startVal / total) * plotWidth
                        : getX(startVal);
                      const x2 = isPercentStacked
                        ? paddingLeft + (endVal / total) * plotWidth
                        : getX(endVal);
                      const barX = Math.min(x1, x2);
                      const barW = Math.max(0, Math.abs(x2 - x1));

                      return (
                        <g key={`${sIndex}-${i}`}>
                          <rect
                            x={barX}
                            y={y}
                            width={barW}
                            height={barHeight}
                            fill={color}
                            stroke="#ffffff"
                            strokeWidth={0.5}
                            className="chart-horiz-bar chart-elem-transition"
                            style={{ animationDelay: `${i * 35 + sIndex * 20}ms` }}
                          />
                          {showDataLabels && barW > 14 && (() => {
                            const pos = chart.dataLabelPosition ?? 'center';
                            const labelInfo = getDataLabelText(
                              chart.dataLabels,
                              v,
                              categories[i] ?? '',
                              series.name,
                              total,
                              chart.dataLabelFormat,
                            );
                            let labelX = barX + barW / 2;
                            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                            let fill = '#ffffff';

                            if (pos === 'inside-end' && barW >= 24) {
                              labelX = barX + barW - 5;
                              textAnchor = 'end';
                            } else if (pos === 'inside-base' && barW >= 24) {
                              labelX = barX + 5;
                              textAnchor = 'start';
                            } else if (pos === 'outside-end' && sIndex === chart.series.length - 1) {
                              labelX = barX + barW + 5;
                              textAnchor = 'start';
                              fill = '#24292f';
                            }

                            const displayText = isPercentStacked && (!chart.dataLabels || chart.dataLabels === 'none' || chart.dataLabels === 'percent')
                              ? `${Math.round((v / total) * 100)}%`
                              : labelInfo.main;

                            return (
                              <text
                                x={labelX}
                                y={y + barHeight / 2 + 3.5}
                                textAnchor={textAnchor}
                                fontSize="9"
                                fill={fill}
                                fontWeight="600"
                                className="chart-data-label"
                                style={{ animationDelay: `${i * 35 + sIndex * 20 + 120}ms` }}
                              >
                                {displayText}
                              </text>
                            );
                          })()}
                        </g>
                      );
                    })}
                  </g>
                );
              })
            ) : (
              // Clustered Horizontal Bar
              chart.series.map((series, sIndex) => {
                const color = series.color ?? defaultColors[sIndex % defaultColors.length];
                const band = plotHeight / numCategories;
                const barHeight = Math.max(
                  4,
                  Math.min(24, (band * 0.75) / seriesCount),
                );

                return series.values.map((v, i) => {
                  const y = paddingTop + i * band + sIndex * barHeight + (band - seriesCount * barHeight) / 2;
                  const barW = Math.max(0, getX(v) - paddingLeft);

                  return (
                    <g key={`${sIndex}-${i}`}>
                      <rect
                        x={paddingLeft}
                        y={y}
                        width={barW}
                        height={barHeight}
                        fill={color}
                        rx={1.5}
                        className="chart-horiz-bar chart-elem-transition"
                        style={{ animationDelay: `${i * 35 + sIndex * 20}ms` }}
                      />
                      {showDataLabels && (() => {
                        const pos = chart.dataLabelPosition ?? 'outside-end';
                        const labelInfo = getDataLabelText(
                          chart.dataLabels,
                          v,
                          categories[i] ?? '',
                          series.name,
                          0,
                          chart.dataLabelFormat,
                        );
                        let labelX = paddingLeft + barW + 5;
                        let textAnchor: 'start' | 'middle' | 'end' = 'start';
                        let fill = '#24292f';

                        if (pos === 'inside-end') {
                          if (barW >= 24) {
                            labelX = paddingLeft + barW - 6;
                            textAnchor = 'end';
                            fill = '#ffffff';
                          } else {
                            labelX = paddingLeft + barW + 5;
                            textAnchor = 'start';
                            fill = '#24292f';
                          }
                        } else if (pos === 'center') {
                          if (barW >= 20) {
                            labelX = paddingLeft + barW / 2;
                            textAnchor = 'middle';
                            fill = '#ffffff';
                          } else {
                            labelX = paddingLeft + barW + 5;
                            textAnchor = 'start';
                            fill = '#24292f';
                          }
                        } else if (pos === 'inside-base') {
                          if (barW >= 20) {
                            labelX = paddingLeft + 6;
                            textAnchor = 'start';
                            fill = '#ffffff';
                          } else {
                            labelX = paddingLeft + barW + 5;
                            textAnchor = 'start';
                            fill = '#24292f';
                          }
                        }

                        return (
                          <text
                            x={labelX}
                            y={y + barHeight / 2 + 3}
                            textAnchor={textAnchor}
                            fontSize="9.5"
                            fill={fill}
                            className="chart-data-label"
                            style={{ animationDelay: `${i * 35 + sIndex * 20 + 120}ms` }}
                          >
                            {labelInfo.main}
                          </text>
                        );
                      })()}
                    </g>
                  );
                });
              })
            )}
          </g>
        )}

        {/* LINE / COMBO CHART */}
        {(isLine || isCombo) && (
          <g key={`line-${chartTypeAnimKey}`} className="chart-lines-group">
            {chart.series.map((series, sIndex) => {
              if (isCombo && sIndex === 0 && chart.series.length > 1) return null;
              const color = series.color ?? defaultColors[sIndex % defaultColors.length];
              const step = plotWidth / Math.max(series.values.length - 1, 1);

              const points = series.values.map((v, i) => ({
                x: paddingLeft + i * step + (isCombo ? plotWidth / numCategories / 2 : 0),
                y: getY(v),
                val: v,
              }));

              const pathD = points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                .join(' ');

              return (
                <g key={sIndex}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth={2.5}
                    className="chart-line-path chart-elem-transition"
                  />
                  {points.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={3.5}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth={2}
                      className="chart-point-dot chart-elem-transition"
                      style={{ animationDelay: `${i * 35}ms` }}
                    />
                  ))}
                  {showDataLabels &&
                    points.map((pt, i) => {
                      const pos = chart.dataLabelPosition ?? 'outside-end';
                      const labelInfo = getDataLabelText(
                        chart.dataLabels,
                        pt.val,
                        categories[i] ?? '',
                        series.name,
                        0,
                        chart.dataLabelFormat,
                      );
                      const labelY = pos === 'inside-end' ? pt.y + 14 : pos === 'center' ? pt.y + 3.5 : pt.y - 7;
                      return (
                        <text
                          key={i}
                          x={pt.x}
                          y={labelY}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill={color}
                          fontWeight="600"
                          className="chart-data-label"
                          style={{ animationDelay: `${i * 35 + 140}ms` }}
                        >
                          {labelInfo.main}
                        </text>
                      );
                    })}
                </g>
              );
            })}
          </g>
        )}

        {/* AREA CHART */}
        {isArea && (
          <g key={`area-${chartTypeAnimKey}`} className="chart-area-group">
            {chart.series.map((series, sIndex) => {
              const color = series.color ?? defaultColors[sIndex % defaultColors.length];
              const step = plotWidth / Math.max(series.values.length - 1, 1);
              const points = series.values.map((v, i) => ({
                x: paddingLeft + i * step,
                y: getY(v),
              }));
              const lineD = points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
                .join(' ');
              const areaD = `${lineD} L${paddingLeft + plotWidth},${paddingTop + plotHeight} L${paddingLeft},${paddingTop + plotHeight} Z`;

              return (
                <g key={sIndex}>
                  <path
                    d={areaD}
                    fill={color}
                    opacity={0.35}
                    className="chart-area-fill chart-elem-transition"
                  />
                  <path
                    d={lineD}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    className="chart-line-path chart-elem-transition"
                  />
                  {showDataLabels &&
                    points.map((pt, i) => {
                      const pos = chart.dataLabelPosition ?? 'outside-end';
                      const labelInfo = getDataLabelText(
                        chart.dataLabels,
                        series.values[i] ?? 0,
                        categories[i] ?? '',
                        series.name,
                        0,
                        chart.dataLabelFormat,
                      );
                      const labelY =
                        pos === 'inside-end'
                          ? paddingTop + plotHeight - 8
                          : pos === 'center'
                            ? (pt.y + paddingTop + plotHeight) / 2
                            : Math.max(paddingTop + 10, pt.y - 6);
                      return (
                        <text
                          key={`area-lbl-${i}`}
                          x={pt.x}
                          y={labelY}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill={color}
                          fontWeight="600"
                          className="chart-data-label"
                          style={{ animationDelay: `${i * 35 + 140}ms` }}
                        >
                          {labelInfo.main}
                        </text>
                      );
                    })}
                </g>
              );
            })}
          </g>
        )}

        {/* SCATTER CHART */}
        {isScatter && (
          <g key={`scatter-${chartTypeAnimKey}`} className="chart-scatter-group">
            {chart.series.map((series, sIndex) => {
              const color = series.color ?? defaultColors[sIndex % defaultColors.length];
              const step = plotWidth / Math.max(series.values.length, 1);
              return series.values.map((v, i) => {
                const x = paddingLeft + i * step + step / 2;
                const y = getY(v);
                return (
                  <g key={`${sIndex}-${i}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={4.5}
                      fill={color}
                      opacity={0.85}
                      className="chart-point-dot chart-elem-transition"
                      style={{ animationDelay: `${i * 25}ms` }}
                    />
                    {showDataLabels && (() => {
                      const pos = chart.dataLabelPosition ?? 'outside-end';
                      const labelInfo = getDataLabelText(
                        chart.dataLabels,
                        v,
                        categories[i] ?? '',
                        series.name,
                        0,
                        chart.dataLabelFormat,
                      );
                      const labelY = pos === 'inside-end' ? y + 14 : pos === 'center' ? y + 3.5 : y - 7;
                      return (
                        <text
                          x={x}
                          y={labelY}
                          textAnchor="middle"
                          fontSize="9"
                          fill={color}
                          fontWeight="500"
                          className="chart-data-label"
                          style={{ animationDelay: `${i * 25 + 120}ms` }}
                        >
                          {labelInfo.main}
                        </text>
                      );
                    })()}
                  </g>
                );
              });
            })}
          </g>
        )}

        {/* RADAR CHART */}
        {isRadar && (
          <g key={`radar-${chartTypeAnimKey}`} className="chart-radar-group">
            {(() => {
              const cx = paddingLeft + plotWidth / 2;
              const cy = paddingTop + plotHeight / 2;
              const radius = Math.min(plotWidth, plotHeight) / 2.2;
              const count = Math.max(numCategories, 3);
              const vertex = (fraction: number, idx: number): string => {
                const angle = -Math.PI / 2 + (idx / count) * Math.PI * 2;
                return `${(cx + radius * fraction * Math.cos(angle)).toFixed(1)},${(cy + radius * fraction * Math.sin(angle)).toFixed(1)}`;
              };

              return (
                <>
                  {[0.25, 0.5, 0.75, 1].map((lvl) => (
                    <polygon
                      key={lvl}
                      points={Array.from({ length: count }, (_, i) => vertex(lvl, i)).join(' ')}
                      fill="none"
                      stroke="#e1e4e8"
                      strokeWidth={1}
                    />
                  ))}
                  {chart.series.map((series, sIndex) => {
                    const color = series.color ?? defaultColors[sIndex % defaultColors.length];
                    const pts = series.values
                      .map((v, i) => vertex(Math.min(1, Math.max(0, v / scale.max)), i))
                      .join(' ');
                    return (
                      <g key={sIndex}>
                        <polygon
                          points={pts}
                          fill={color}
                          opacity={0.3}
                          stroke={color}
                          strokeWidth={2}
                          className="chart-radar-poly chart-elem-transition"
                          style={{ transformOrigin: `${cx}px ${cy}px` }}
                        />
                        {showDataLabels &&
                          series.values.map((v, i) => {
                            const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
                            const fraction = Math.min(1, Math.max(0, v / scale.max));
                            const pos = chart.dataLabelPosition ?? 'outside-end';
                            const offsetR = pos === 'inside-end' ? -12 : pos === 'center' ? -4 : 10;
                            const lx = cx + (radius * fraction + offsetR) * Math.cos(angle);
                            const ly = cy + (radius * fraction + offsetR) * Math.sin(angle);
                            const labelInfo = getDataLabelText(
                              chart.dataLabels,
                              v,
                              categories[i] ?? '',
                              series.name,
                              0,
                              chart.dataLabelFormat,
                            );
                            return (
                              <text
                                key={`radar-lbl-${sIndex}-${i}`}
                                x={lx}
                                y={ly + 3}
                                textAnchor="middle"
                                fontSize="8.5"
                                fill={color}
                                fontWeight="600"
                                className="chart-data-label"
                              >
                                {labelInfo.main}
                              </text>
                            );
                          })}
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </g>
        )}

        {/* Value Axis Title */}
        {hasValAxisTitle && (
          <text
            x={paddingLeft - (hasValAxisTitle ? 32 : 24)}
            y={paddingTop + plotHeight / 2}
            transform={`rotate(-90 ${paddingLeft - (hasValAxisTitle ? 32 : 24)} ${paddingTop + plotHeight / 2})`}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="#5f6368"
          >
            {chart.axisTitles?.value}
          </text>
        )}

        {/* Category Axis Title */}
        {hasCatAxisTitle && (
          <text
            x={paddingLeft + plotWidth / 2}
            y={paddingTop + plotHeight + 32}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="#5f6368"
          >
            {chart.axisTitles?.category}
          </text>
        )}
      </svg>
        </motion.div>
      </AnimatePresence>

      {/* Legend with Motion layout transition */}
      {showLegend && (
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`chart-legend legend-${legendPos}`}
          style={{
            position: 'absolute',
            ...(legendPos === 'right'
              ? { top: paddingTop, right: 10, width: legendWidth }
              : legendPos === 'left'
                ? { top: paddingTop, left: 10, width: legendWidth }
                : legendPos === 'top'
                  ? { top: titleHeight + 2, left: 0, width: '100%', display: 'flex', justifyContent: 'center' }
                  : { bottom: 6, left: 0, width: '100%', display: 'flex', justifyContent: 'center' }),
            display: 'flex',
            flexDirection: legendPos === 'right' || legendPos === 'left' ? 'column' : 'row',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11px',
            color: '#444',
            overflow: 'hidden',
          }}
        >
          {legendItems.map((item, index) => (
            <motion.div
              key={index}
              className="chart-legend-item"
              whileHover={{ x: 2 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                maxWidth: '120px',
              }}
            >
              <span
                className="chart-legend-color-dot"
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: item.color,
                  flexShrink: 0,
                  transition: 'background-color 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease',
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={item.name}
              >
                {item.name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
