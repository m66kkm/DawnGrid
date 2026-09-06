// src/charts/RecommendedChartsDialog.tsx
// Recommended Charts dialog with dual-panel layout and live SVG previews

import React, { useState } from 'react';
import type { ChartRecommendations, RecommendedKind } from './types';
import { ChartSvgPreview } from './chartSvgPreview';
import { KIND_NAMES, REASON_DESCRIPTIONS } from './chartRecommend';

interface RecommendedChartsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: ChartRecommendations | null;
  onSelectChart: (kind: RecommendedKind) => void;
}

export function RecommendedChartsDialog({
  isOpen,
  onClose,
  recommendations,
  onSelectChart,
}: RecommendedChartsDialogProps): React.JSX.Element | null {
  const [selectedKind, setSelectedKind] = useState<RecommendedKind>('column');

  if (!isOpen) return null;

  const items = recommendations?.items ?? [
    { kind: 'column', reason: 'comparison' },
    { kind: 'line', reason: 'time' },
    { kind: 'pie', reason: 'proportion' },
    { kind: 'bar', reason: 'longLabels' },
    { kind: 'area', reason: 'manyPoints' },
  ];

  const parsed = recommendations?.parsed ?? {
    byRow: false,
    hasHeaderRow: true,
    hasCategoryColumn: true,
    categories: ['类别 1', '类别 2', '类别 3', '类别 4', '类别 5'],
    series: [
      { name: '系列 1', values: [25, 40, 15, 60, 35], column: 1 },
      { name: '系列 2', values: [30, 20, 45, 30, 50], column: 2 },
    ],
  };

  const activeItem = items.find((it) => it.kind === selectedKind) ?? items[0];
  const activeKind = activeItem?.kind ?? 'column';
  const activeReason = activeItem?.reason ?? 'comparison';
  const kindInfo = KIND_NAMES[activeKind] ?? { zh: activeKind, en: activeKind };
  const reasonInfo = REASON_DESCRIPTIONS[activeReason] ?? {
    title: '智能推荐',
    desc: '根据当前选中的数据结构自动推荐该图表类型。',
  };

  const handleInsert = () => {
    onSelectChart(activeKind);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-window"
        style={{
          width: '780px',
          height: '540px',
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
              插入图表 - 推荐的图表 (Recommended Charts)
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

        {/* Body (Dual-Panel Layout) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel: Recommendations list */}
          <div
            style={{
              width: '310px',
              borderRight: '1px solid #e1e4e8',
              background: '#f6f8fa',
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#57606a', marginBottom: '4px' }}>
              根据当前活动选区结构为您匹配了最佳图表类型：
            </div>
            {items.map((item) => {
              const info = KIND_NAMES[item.kind] ?? { zh: item.kind, en: item.kind };
              const reason = REASON_DESCRIPTIONS[item.reason]?.title ?? '推荐';
              const isSelected = item.kind === selectedKind;

              return (
                <div
                  key={item.kind}
                  onClick={() => setSelectedKind(item.kind)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? '#ffffff' : 'transparent',
                    border: isSelected ? '1.5px solid #217346' : '1px solid #d0d7de',
                    boxShadow: isSelected ? '0 2px 8px rgba(33, 115, 70, 0.12)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#217346' : '#24292f' }}>
                      {info.zh}
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        background: isSelected ? '#e8f5e9' : '#eef0f2',
                        color: isSelected ? '#1b5e20' : '#4a5568',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 500,
                      }}
                    >
                      {reason}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '75px',
                      background: '#fafbfc',
                      borderRadius: '4px',
                      border: '1px solid #e1e4e8',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChartSvgPreview kind={item.kind} parsed={parsed} width={260} height={70} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right panel: Large Live Preview & Descriptions */}
          <div
            style={{
              flex: 1,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              overflowY: 'auto',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#217346', fontWeight: 600 }}>
                  {kindInfo.zh}
                </h4>
                <span style={{ fontSize: '12px', color: '#6e7781' }}>({kindInfo.en})</span>
              </div>
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: '12.5px',
                  color: '#424a53',
                  lineHeight: '1.6',
                  background: '#f4fbf6',
                  borderLeft: '3px solid #217346',
                  padding: '8px 12px',
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <strong>推荐原因：</strong>
                {reasonInfo.desc}
              </p>
            </div>

            {/* Live Chart Preview Box */}
            <div
              style={{
                flex: 1,
                border: '1px solid #d0d7de',
                borderRadius: '6px',
                background: '#ffffff',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <ChartSvgPreview kind={activeKind} parsed={parsed} width={380} height={230} />
            </div>

            <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#8c959f', textAlign: 'center' }}>
              基于选区 {parsed.categories.length} 行 × {parsed.series.length} 列数据实时渲染预览
            </div>
          </div>
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
            onClick={handleInsert}
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
            确定插入
          </button>
        </div>
      </div>
    </div>
  );
}
