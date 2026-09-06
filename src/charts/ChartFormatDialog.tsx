// src/charts/ChartFormatDialog.tsx
// Excel-style Format Chart task dialog / pane

import React, { useState } from 'react';
import type { ChartStateEdit, ChartVisualState } from './types';
import { COLOR_PALETTES } from './types';
import { useCssTransitionMount } from './useCssTransitionMount';

interface ChartFormatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chart: ChartVisualState | null;
  onApply: (edit: ChartStateEdit) => void;
}

interface ChartFormatDialogContentProps {
  chart: ChartVisualState;
  state: 'open' | 'closed';
  onClose: () => void;
  onApply: (edit: ChartStateEdit) => void;
}

function ChartFormatDialogContent({
  chart,
  state,
  onClose,
  onApply,
}: ChartFormatDialogContentProps): React.JSX.Element {
  const [title, setTitle] = useState(chart.title);
  const [legend, setLegend] = useState<ChartVisualState['legend']>(chart.legend ?? 'right');
  const [dataLabels, setDataLabels] = useState<ChartVisualState['dataLabels']>(chart.dataLabels ?? 'none');
  const [dataLabelPos, setDataLabelPos] = useState<ChartVisualState['dataLabelPosition']>(
    chart.dataLabelPosition ?? 'outside-end',
  );
  const [gridlines, setGridlines] = useState(chart.gridlines !== false);
  const [axisMin, setAxisMin] = useState<string>(
    chart.valueAxis?.min !== undefined ? String(chart.valueAxis.min) : '',
  );
  const [axisMax, setAxisMax] = useState<string>(
    chart.valueAxis?.max !== undefined ? String(chart.valueAxis.max) : '',
  );
  const [paletteName, setPaletteName] = useState('office');
  const [gapWidth, setGapWidth] = useState(chart.gapWidthPct ?? 150);
  const [explosion, setExplosion] = useState(chart.series[0]?.explosionPct ?? 0);
  const [holeSize, setHoleSize] = useState(chart.holeSizePct ?? 50);

  const isBar = chart.chartTypes.includes('barChart');
  const isPie = chart.chartTypes.includes('pieChart') || chart.chartTypes.includes('doughnutChart');
  const isDoughnut = chart.chartTypes.includes('doughnutChart');

  const handlePaletteChange = (pal: string) => {
    setPaletteName(pal);
    const colors = COLOR_PALETTES[pal] ?? COLOR_PALETTES.office;
    const seriesColors: Record<string, string> = {};
    chart.series.forEach((_, idx) => {
      seriesColors[String(idx)] = colors[idx % colors.length];
    });
    const pointColors: Record<string, Record<string, string>> = {};
    if (isPie || chart.series.length === 1) {
      const ptMap: Record<string, string> = {};
      const catCount = chart.series[0]?.categories?.length || chart.series[0]?.values?.length || 0;
      for (let i = 0; i < catCount; i++) {
        ptMap[String(i)] = colors[i % colors.length];
      }
      pointColors['0'] = ptMap;
    }
    onApply({ seriesColors, pointColors, palette: pal });
  };

  const handleSave = () => {
    const minNum = axisMin.trim() !== '' ? Number(axisMin) : null;
    const maxNum = axisMax.trim() !== '' ? Number(axisMax) : null;

    const edit: ChartStateEdit = {
      title,
      legend,
      dataLabels,
      dataLabelPosition: dataLabelPos,
      gridlines,
      valueAxis: {
        min: Number.isFinite(minNum) ? minNum : null,
        max: Number.isFinite(maxNum) ? maxNum : null,
      },
      gapWidthPct: gapWidth,
      explosionPct: explosion,
      holeSizePct: holeSize,
      palette: paletteName,
    };

    onApply(edit);
    onClose();
  };

  return (
    <div className="modal-backdrop" data-state={state} onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-window"
        data-state={state}
        style={{
          width: '580px',
          maxHeight: '620px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          background: '#ffffff',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #e1e4e8',
            background: '#f8f9fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎨</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1f2328' }}>
              设置图表格式 (Format Chart)
            </h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#57606a',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. 图表标题 */}
          <div style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
              图表标题 (Chart Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入图表标题..."
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 2. 图例设置 */}
          <div style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
              图例位置 (Legend Position)
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { id: 'right', label: '靠右' },
                { id: 'top', label: '靠上' },
                { id: 'bottom', label: '靠下' },
                { id: 'left', label: '靠左' },
                { id: 'none', label: '无图例' },
              ].map((opt) => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="legendPos"
                    checked={legend === opt.id}
                    onChange={() => setLegend(opt.id as ChartVisualState['legend'])}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* 3. 数据标签 */}
          <div style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
              数据标签 (Data Labels)
            </label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <select
                value={dataLabels}
                onChange={(e) => setDataLabels(e.target.value as ChartVisualState['dataLabels'])}
                style={{
                  padding: '5px 10px',
                  fontSize: '12.5px',
                  border: '1px solid #d0d7de',
                  borderRadius: '4px',
                }}
              >
                <option value="none">无数据标签</option>
                <option value="value">显示具体数值</option>
                {isPie && <option value="percent">显示百分比</option>}
                {isPie && <option value="category-percent">类别名称 + 百分比</option>}
              </select>

              {dataLabels !== 'none' && (
                <select
                  value={dataLabelPos}
                  onChange={(e) => setDataLabelPos(e.target.value as ChartVisualState['dataLabelPosition'])}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12.5px',
                    border: '1px solid #d0d7de',
                    borderRadius: '4px',
                  }}
                >
                  <option value="outside-end">外部居端</option>
                  <option value="inside-end">内部居端</option>
                  <option value="center">居中</option>
                </select>
              )}
            </div>
          </div>

          {/* 4. 网格线与数值轴 */}
          {!isPie && (
            <div style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
                数值轴与网格线 (Value Axis & Gridlines)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="chkGrid"
                  checked={gridlines}
                  onChange={(e) => setGridlines(e.target.checked)}
                />
                <label htmlFor="chkGrid" style={{ fontSize: '12.5px', cursor: 'pointer' }}>
                  显示主水平网格线
                </label>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#57606a' }}>最小值：</span>
                  <input
                    type="number"
                    value={axisMin}
                    onChange={(e) => setAxisMin(e.target.value)}
                    placeholder="自动 (Auto)"
                    style={{ width: '90px', padding: '4px 6px', fontSize: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#57606a' }}>最大值：</span>
                  <input
                    type="number"
                    value={axisMax}
                    onChange={(e) => setAxisMax(e.target.value)}
                    placeholder="自动 (Auto)"
                    style={{ width: '90px', padding: '4px 6px', fontSize: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. 颜色方案 */}
          <div style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
              配色方案 (Color Palette)
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { id: 'office', name: 'Office 标准' },
                { id: 'blue', name: '经典蓝调' },
                { id: 'green', name: '清新绿意' },
                { id: 'warm', name: '温暖色系' },
                { id: 'gray', name: '高级灰度' },
              ].map((pal) => (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => handlePaletteChange(pal.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: paletteName === pal.id ? '1.5px solid #217346' : '1px solid #d0d7de',
                    background: paletteName === pal.id ? '#e8f5e9' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {COLOR_PALETTES[pal.id]?.slice(0, 4).map((c, i) => (
                      <span key={i} style={{ width: '8px', height: '8px', background: c, borderRadius: '1px' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '12px' }}>{pal.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6. 特殊形状属性 (柱形间隙 / 饼图分离 / 圆环内径) */}
          {isBar && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
                条形/柱形间隙宽度 ({gapWidth}%)
              </label>
              <input
                type="range"
                min="0"
                max="400"
                step="10"
                value={gapWidth}
                onChange={(e) => setGapWidth(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {isPie && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
                饼图切片分离度 ({explosion}%)
              </label>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={explosion}
                onChange={(e) => setExplosion(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {isDoughnut && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#24292f', marginBottom: '6px' }}>
                圆环图内径大小 ({holeSize}%)
              </label>
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={holeSize}
                onChange={(e) => setHoleSize(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '12px 20px',
            borderTop: '1px solid #e1e4e8',
            background: '#f8f9fa',
          }}
        >
          <button
            className="pivot-btn"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '4px',
              border: '1px solid #d0d7de',
              background: '#ffffff',
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            className="pivot-btn primary"
            onClick={handleSave}
            style={{
              padding: '6px 20px',
              borderRadius: '4px',
              border: 'none',
              background: '#217346',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            应用设置
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChartFormatDialog({
  isOpen,
  onClose,
  chart,
  onApply,
}: ChartFormatDialogProps): React.JSX.Element | null {
  const { mounted, state } = useCssTransitionMount(isOpen);

  if (!mounted || !chart) return null;

  return (
    <ChartFormatDialogContent
      chart={chart}
      state={state}
      onClose={onClose}
      onApply={onApply}
    />
  );
}
