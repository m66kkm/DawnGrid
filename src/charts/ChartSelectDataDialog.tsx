// src/charts/ChartSelectDataDialog.tsx
// Excel-style Select Data Source modal dialog

import React, { useState } from 'react';
import type { ChartStateEdit, ChartVisualState } from './types';
import { transposeChartSeries } from './chartVisual';
import { useCssTransitionMount } from './useCssTransitionMount';

interface ChartSelectDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chart: ChartVisualState | null;
  onApply: (edit: ChartStateEdit) => void;
}

interface ChartSelectDataDialogContentProps {
  chart: ChartVisualState;
  state: 'open' | 'closed';
  onClose: () => void;
  onApply: (edit: ChartStateEdit) => void;
}

interface SeriesRow {
  name: string;
  valuesRange: string;
  categoriesRange: string;
  source: number | null;
}

function ChartSelectDataDialogContent({
  chart,
  state,
  onClose,
  onApply,
}: ChartSelectDataDialogContentProps): React.JSX.Element {
  const [rows, setRows] = useState<SeriesRow[]>(
    chart.series.map((series, index) => ({
      name: series.name,
      valuesRange: series.valuesRef ?? '',
      categoriesRange: series.categoriesRef ?? '',
      source: index,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const patchRow = (index: number, patch: Partial<SeriesRow>) => {
    setRows((prev) => prev.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      const row = next[index];
      const other = next[target];
      if (!row || !other) return prev;
      next[index] = other;
      next[target] = row;
      return next;
    });
  };

  const handleAddSeries = () => {
    setRows((prev) => [
      ...prev,
      {
        name: `系列 ${prev.length + 1}`,
        valuesRange: '',
        categoriesRange: '',
        source: null,
      },
    ]);
  };

  const handleRemoveSeries = (index: number) => {
    if (rows.length <= 1) {
      setError('图表必须保留至少一个数据系列。');
      return;
    }
    setRows((prev) => prev.filter((_, at) => at !== index));
  };

  const handleSwitchRowCol = () => {
    const seriesSet = transposeChartSeries(chart.series, (n) => `系列 ${n}`);
    if (!seriesSet) {
      setError('当前图表无有效类别标签，无法进行行/列互换。');
      return;
    }
    onApply({ seriesSet });
    onClose();
  };

  const handleSave = () => {
    if (rows.length === 0) {
      setError('图表必须包含至少一个有效系列。');
      return;
    }

    const fallbackCategories = chart.series[0]?.categories ?? [];
    const seriesSet: NonNullable<ChartStateEdit['seriesSet']> = rows.map((row, idx) => {
      const original = row.source !== null ? chart.series[row.source] : undefined;
      return {
        name: row.name.trim() || `系列 ${idx + 1}`,
        values: original?.values ?? [10, 20, 30],
        categories: original?.categories ?? fallbackCategories,
        valuesRef: row.valuesRange || undefined,
        categoriesRef: row.categoriesRange || undefined,
        color: original?.color,
      };
    });

    onApply({ seriesSet });
    onClose();
  };

  return (
    <div className="modal-backdrop" data-state={state} onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-window"
        data-state={state}
        style={{
          width: '680px',
          maxHeight: '560px',
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
            <span style={{ fontSize: '18px' }}>📊</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1f2328' }}>
              选择数据源 (Select Data Source)
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

        {/* Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#24292f' }}>
              图例项 (系列)：
            </span>
            <button
              type="button"
              onClick={handleSwitchRowCol}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #217346',
                background: '#e8f5e9',
                color: '#1b5e20',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              ⇄ 切换行/列 (Switch Row/Column)
            </button>
          </div>

          {/* Series Table */}
          <div
            style={{
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr 80px',
                background: '#f6f8fa',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#57606a',
                borderBottom: '1px solid #d0d7de',
              }}
            >
              <span>系列名称</span>
              <span>值范围</span>
              <span>轴标签范围</span>
              <span style={{ textAlign: 'center' }}>排序/操作</span>
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {rows.map((row, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 1fr 80px',
                    padding: '6px 12px',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: index < rows.length - 1 ? '1px solid #f0f2f5' : 'none',
                    background: index % 2 === 0 ? '#ffffff' : '#fafbfc',
                  }}
                >
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => patchRow(index, { name: e.target.value })}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d0d7de',
                      borderRadius: '4px',
                    }}
                    placeholder={`系列 ${index + 1}`}
                  />
                  <input
                    type="text"
                    value={row.valuesRange}
                    onChange={(e) => patchRow(index, { valuesRange: e.target.value })}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d0d7de',
                      borderRadius: '4px',
                    }}
                    placeholder="Sheet1!$B$2:$B$10"
                  />
                  <input
                    type="text"
                    value={row.categoriesRange}
                    onChange={(e) => patchRow(index, { categoriesRange: e.target.value })}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #d0d7de',
                      borderRadius: '4px',
                    }}
                    placeholder="Sheet1!$A$2:$A$10"
                  />
                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveRow(index, -1)}
                      style={{
                        padding: '2px 5px',
                        fontSize: '11px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        background: '#fff',
                        border: '1px solid #d0d7de',
                        borderRadius: '3px',
                      }}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                      style={{
                        padding: '2px 5px',
                        fontSize: '11px',
                        cursor: index === rows.length - 1 ? 'not-allowed' : 'pointer',
                        background: '#fff',
                        border: '1px solid #d0d7de',
                        borderRadius: '3px',
                      }}
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSeries(index)}
                      style={{
                        padding: '2px 5px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        background: '#fff',
                        border: '1px solid #d0d7de',
                        borderRadius: '3px',
                        color: '#cf222e',
                      }}
                      title="删除系列"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={handleAddSeries}
              disabled={rows.length >= 16}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #d0d7de',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              + 添加系列 (Add)
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                background: '#ffebe9',
                border: '1px solid #ff8182',
                color: '#cf222e',
                fontSize: '12px',
              }}
            >
              {error}
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
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChartSelectDataDialog({
  isOpen,
  onClose,
  chart,
  onApply,
}: ChartSelectDataDialogProps): React.JSX.Element | null {
  const { mounted, state } = useCssTransitionMount(isOpen);

  if (!mounted || !chart) return null;

  return (
    <ChartSelectDataDialogContent
      chart={chart}
      state={state}
      onClose={onClose}
      onApply={onApply}
    />
  );
}
