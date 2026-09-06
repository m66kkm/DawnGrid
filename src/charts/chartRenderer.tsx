// src/charts/chartRenderer.tsx
// Full-featured SVG Chart renderer for on-sheet interactive visual objects

import React from 'react';
import type { ChartVisualState } from './types';
import { COLOR_PALETTES } from './types';
import { formatCategoryLabel, valueAxisScale } from './chartVisual';

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
      className="chart-container-inner"
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

      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
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
          <g className="chart-pie-group">
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
                    const labelDist = radius * 0.7;
                    const labelX = cx + labelDist * Math.cos(mid);
                    const labelY = cy + labelDist * Math.sin(mid);
                    const color =
                      primarySeries?.pointColors?.find((p) => p.index === i)?.color ??
                      defaultColors[i % defaultColors.length];

                    const d = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
                    const pct = ((Math.max(v, 0) / total) * 100).toFixed(0);

                    return (
                      <g key={i}>
                        <path d={d} fill={color} stroke="#ffffff" strokeWidth={1.5} />
                        {showDataLabels && sweep > 0.15 && (
                          <text
                            x={labelX}
                            y={labelY + 3}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#ffffff"
                          >
                            {pct}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {isDoughnut && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius * ((chart.holeSizePct ?? 50) / 100)}
                      fill="#ffffff"
                    />
                  )}
                </>
              );
            })()}
          </g>
        )}

        {/* COLUMN CHART */}
        {!isPie && !isBarHorizontal && !isRadar && !isLine && !isArea && (
          <g className="chart-bars-group">
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
                          />
                          {showDataLabels && barH > 14 && (
                            <text
                              x={x + barWidth / 2}
                              y={barY + barH / 2 + 3.5}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#ffffff"
                              fontWeight="600"
                            >
                              {isPercentStacked ? `${Math.round((v / total) * 100)}%` : v}
                            </text>
                          )}
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
                      />
                      {showDataLabels && (
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(paddingTop + 10, y - 4)}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill="#333"
                          fontWeight="500"
                        >
                          {v}
                        </text>
                      )}
                    </g>
                  );
                });
              })
            )}
          </g>
        )}

        {/* BAR (HORIZONTAL) CHART */}
        {isBarHorizontal && (
          <g className="chart-horizontal-bars">
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
                          />
                          {showDataLabels && barW > 18 && (
                            <text
                              x={barX + barW / 2}
                              y={y + barHeight / 2 + 3.5}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#ffffff"
                              fontWeight="600"
                            >
                              {isPercentStacked ? `${Math.round((v / total) * 100)}%` : v}
                            </text>
                          )}
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
                      />
                      {showDataLabels && (
                        <text
                          x={paddingLeft + barW + 5}
                          y={y + barHeight / 2 + 3}
                          fontSize="9.5"
                          fill="#333"
                        >
                          {v}
                        </text>
                      )}
                    </g>
                  );
                });
              })
            )}
          </g>
        )}

        {/* LINE / COMBO CHART */}
        {(isLine || isCombo) && (
          <g className="chart-lines-group">
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
                  <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} />
                  {points.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill="#ffffff" stroke={color} strokeWidth={2} />
                  ))}
                  {showDataLabels &&
                    points.map((pt, i) => (
                      <text
                        key={i}
                        x={pt.x}
                        y={pt.y - 7}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill={color}
                        fontWeight="600"
                      >
                        {pt.val}
                      </text>
                    ))}
                </g>
              );
            })}
          </g>
        )}

        {/* AREA CHART */}
        {isArea && (
          <g className="chart-area-group">
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
                  <path d={areaD} fill={color} opacity={0.35} />
                  <path d={lineD} fill="none" stroke={color} strokeWidth={2} />
                  {showDataLabels &&
                    points.map((pt, i) => (
                      <text
                        key={`area-lbl-${i}`}
                        x={pt.x}
                        y={Math.max(paddingTop + 10, pt.y - 6)}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill={color}
                        fontWeight="600"
                      >
                        {series.values[i]}
                      </text>
                    ))}
                </g>
              );
            })}
          </g>
        )}

        {/* SCATTER CHART */}
        {isScatter && (
          <g className="chart-scatter-group">
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
                      r={4}
                      fill={color}
                      opacity={0.8}
                    />
                    {showDataLabels && (
                      <text
                        x={x}
                        y={y - 7}
                        textAnchor="middle"
                        fontSize="9"
                        fill={color}
                        fontWeight="500"
                      >
                        {v}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </g>
        )}

        {/* RADAR CHART */}
        {isRadar && (
          <g className="chart-radar-group">
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
                        <polygon points={pts} fill={color} opacity={0.3} stroke={color} strokeWidth={2} />
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

      {/* Legend */}
      {showLegend && (
        <div
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
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                maxWidth: '120px',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: item.color,
                  flexShrink: 0,
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
