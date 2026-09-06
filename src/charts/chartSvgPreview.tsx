// src/charts/chartSvgPreview.tsx
// Live SVG preview generator based on actual selection data for Recommended Charts dialog and thumbnails

import React from 'react';
import type { ParsedChartData, RecommendedKind } from './types';

const PALETTE = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'];

interface PreviewSeries {
  color: string;
  points: number[];
}

function previewSeries(parsed: ParsedChartData, maxPoints: number): PreviewSeries[] {
  const series = parsed.series.slice(0, 3);
  const sliced = series.map((entry) => entry.values.slice(0, maxPoints));
  const flat = sliced.flat();
  const top = Math.max(...flat, 0);
  const bottom = Math.min(...flat, 0);
  const span = top - bottom || 1;
  return sliced.map((values, index) => ({
    color: PALETTE[index % PALETTE.length] ?? '#4472c4',
    points: values.map((value) => (value - bottom) / span),
  }));
}

function linePath(points: number[], plotWidth: number, pad: number, height: number): string {
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  return points
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${(pad + index * step).toFixed(1)},${(height - pad - value * (height - pad * 2)).toFixed(1)}`,
    )
    .join(' ');
}

function pieSlices(
  values: number[],
  cx: number,
  cy: number,
  r: number,
): { d: string; color: string }[] {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  let angle = -Math.PI / 2;
  return values.slice(0, 8).map((value, index) => {
    const sweep = (Math.max(value, 0) / total) * Math.PI * 2;
    const from = angle;
    angle += sweep;
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    return {
      d: `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`,
      color: PALETTE[index % PALETTE.length] ?? '#4472c4',
    };
  });
}

export function ChartSvgPreview({
  kind,
  parsed,
  width = 180,
  height = 110,
}: {
  readonly kind: RecommendedKind;
  readonly parsed: ParsedChartData;
  readonly width?: number;
  readonly height?: number;
}): React.JSX.Element {
  const pad = Math.max(8, width * 0.05);
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;

  const renderContent = (): React.JSX.Element => {
    switch (kind) {
      case 'pie':
      case 'doughnut': {
        const first = parsed.series[0];
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.min(plotWidth, plotHeight) / 2;
        const slices = pieSlices(first?.values ?? [10, 20, 30], cx, cy, r);
        return (
          <>
            {slices.map((slice, index) => (
              <path key={index} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth={1} />
            ))}
            {kind === 'doughnut' && (
              <circle cx={cx} cy={cy} r={r * 0.55} fill="#ffffff" />
            )}
          </>
        );
      }

      case 'bar': {
        const series = previewSeries(parsed, 6);
        const groups = series[0]?.points.length ?? 0;
        const band = plotHeight / Math.max(groups, 1);
        const barHeight = Math.max(3, Math.min(12, (band * 0.7) / Math.max(series.length, 1)));
        return (
          <>
            {series.map((entry, seriesIndex) =>
              entry.points.map((value, index) => (
                <rect
                  key={`${seriesIndex}-${index}`}
                  x={pad}
                  y={pad + index * band + seriesIndex * barHeight + band * 0.1}
                  width={Math.max(2, value * plotWidth)}
                  height={barHeight}
                  fill={entry.color}
                  rx={1}
                />
              )),
            )}
          </>
        );
      }

      case 'line':
      case 'area': {
        const series = previewSeries(parsed, 12);
        return (
          <>
            {series.map((entry, index) => (
              <g key={index}>
                {kind === 'area' && (
                  <path
                    d={`${linePath(entry.points, plotWidth, pad, height)} L${width - pad},${height - pad} L${pad},${height - pad} Z`}
                    fill={entry.color}
                    opacity={0.3}
                  />
                )}
                <path
                  d={linePath(entry.points, plotWidth, pad, height)}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                />
                {entry.points.map((pt, i) => {
                  const step = entry.points.length > 1 ? plotWidth / (entry.points.length - 1) : 0;
                  return (
                    <circle
                      key={i}
                      cx={pad + i * step}
                      cy={height - pad - pt * (height - pad * 2)}
                      r={2}
                      fill={entry.color}
                    />
                  );
                })}
              </g>
            ))}
          </>
        );
      }

      case 'scatter': {
        const [xs, ys] = previewSeries(parsed, 20);
        const points = ys ?? xs;
        const xPoints = ys ? (xs?.points ?? []) : [];
        return (
          <>
            {(points?.points ?? []).map((value, index) => {
              const xPos =
                pad +
                (xPoints[index] ?? index / Math.max((points?.points.length ?? 1) - 1, 1)) *
                  plotWidth;
              const yPos = height - pad - value * plotHeight;
              return <circle key={index} cx={xPos} cy={yPos} r={3} fill={PALETTE[0]} opacity={0.85} />;
            })}
          </>
        );
      }

      case 'radar': {
        const series = previewSeries(parsed, 6);
        const count = Math.max(series[0]?.points.length ?? 3, 3);
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(plotWidth, plotHeight) / 2;
        const vertex = (value: number, index: number): string => {
          const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
          return `${(cx + radius * value * Math.cos(angle)).toFixed(1)},${(cy + radius * value * Math.sin(angle)).toFixed(1)}`;
        };
        return (
          <>
            <polygon
              points={Array.from({ length: count }, (_, index) => vertex(1, index)).join(' ')}
              fill="none"
              stroke="#e1e4e8"
              strokeWidth={1}
            />
            <polygon
              points={Array.from({ length: count }, (_, index) => vertex(0.5, index)).join(' ')}
              fill="none"
              stroke="#e1e4e8"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            {series.map((entry, seriesIndex) => (
              <polygon
                key={seriesIndex}
                points={entry.points.map((value, index) => vertex(value, index)).join(' ')}
                fill={entry.color}
                opacity={0.35}
                stroke={entry.color}
                strokeWidth={1.5}
              />
            ))}
          </>
        );
      }

      case 'combo': {
        const series = previewSeries(parsed, 8);
        const bars = series[0];
        const line = series[1] ?? series[0];
        const groups = bars?.points.length ?? 0;
        const band = plotWidth / Math.max(groups, 1);
        return (
          <>
            {(bars?.points ?? []).map((value, index) => (
              <rect
                key={index}
                x={pad + index * band + band * 0.15}
                y={height - pad - value * plotHeight}
                width={Math.max(3, band * 0.7)}
                height={Math.max(2, value * plotHeight)}
                fill={PALETTE[0]}
                rx={1}
              />
            ))}
            {line && (
              <path
                d={linePath(line.points, plotWidth, pad, height)}
                fill="none"
                stroke={PALETTE[1]}
                strokeWidth={2}
              />
            )}
          </>
        );
      }

      default: {
        // column
        const series = previewSeries(parsed, 8);
        const groups = series[0]?.points.length ?? 0;
        const band = plotWidth / Math.max(groups, 1);
        const barWidth = Math.max(2, Math.min(14, (band * 0.75) / Math.max(series.length, 1)));
        return (
          <>
            {series.map((entry, seriesIndex) =>
              entry.points.map((value, index) => (
                <rect
                  key={`${seriesIndex}-${index}`}
                  x={pad + index * band + seriesIndex * barWidth + band * 0.1}
                  y={height - pad - value * plotHeight}
                  width={barWidth}
                  height={Math.max(2, value * plotHeight)}
                  fill={entry.color}
                  rx={1}
                />
              )),
            )}
          </>
        );
      }
    }
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Base baseline for Cartesian coordinates */}
      {kind !== 'pie' && kind !== 'doughnut' && kind !== 'radar' && (
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="#d0d7de"
          strokeWidth={1}
        />
      )}
      {renderContent()}
    </svg>
  );
}
