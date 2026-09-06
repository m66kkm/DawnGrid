// src/charts/ChartOverlay.tsx
// Interactive on-sheet overlay rendering movable, resizable chart objects

import React, { useEffect, useRef, useState } from 'react';
import type { SheetVisual } from './types';
import { ChartRenderer } from './chartRenderer';

interface ChartOverlayProps {
  charts: SheetVisual[];
  activeChartId: string | null;
  onSelectChart: (id: string | null) => void;
  onUpdateChartPos: (id: string, pos: SheetVisual['pos']) => void;
  onOpenSelectData: (chart: SheetVisual) => void;
  onOpenFormatPane: (chart: SheetVisual) => void;
  onSwitchRowCol: (chart: SheetVisual) => void;
  onDeleteChart: (id: string) => void;
}

export function ChartOverlay({
  charts,
  activeChartId,
  onSelectChart,
  onUpdateChartPos,
  onOpenSelectData,
  onOpenFormatPane,
  onSwitchRowCol,
  onDeleteChart,
}: ChartOverlayProps): React.JSX.Element {
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'resize';
    handle?: string;
    startX: number;
    startY: number;
    origPos: SheetVisual['pos'];
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Drag and resize mouse move / up listeners
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const { id, mode, handle, origPos } = dragState;

      if (mode === 'move') {
        onUpdateChartPos(id, {
          ...origPos,
          x: Math.max(10, origPos.x + dx),
          y: Math.max(10, origPos.y + dy),
        });
      } else if (mode === 'resize' && handle) {
        let newX = origPos.x;
        let newY = origPos.y;
        let newW = origPos.width;
        let newH = origPos.height;

        if (handle.includes('e')) newW = Math.max(260, origPos.width + dx);
        if (handle.includes('s')) newH = Math.max(180, origPos.height + dy);
        if (handle.includes('w')) {
          const maxDx = origPos.width - 260;
          const appliedDx = Math.min(dx, maxDx);
          newX = origPos.x + appliedDx;
          newW = origPos.width - appliedDx;
        }
        if (handle.includes('n')) {
          const maxDy = origPos.height - 180;
          const appliedDy = Math.min(dy, maxDy);
          newY = origPos.y + appliedDy;
          newH = origPos.height - appliedDy;
        }

        onUpdateChartPos(id, { x: newX, y: newY, width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onUpdateChartPos]);

  // Keyboard delete shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeChartId) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        onDeleteChart(activeChartId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChartId, onDeleteChart]);

  return (
    <div
      ref={containerRef}
      className="charts-canvas-overlay"
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onSelectChart(null);
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'visible',
      }}
    >
      {charts.map((chartItem) => {
        const isActive = chartItem.id === activeChartId;
        const { x, y, width, height } = chartItem.pos;

        return (
          <div
            key={chartItem.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChart(chartItem.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onOpenFormatPane(chartItem);
            }}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width,
              height,
              pointerEvents: 'auto',
              border: isActive ? '2px solid #217346' : '1px solid #d0d7de',
              boxShadow: isActive
                ? '0 6px 24px rgba(33, 115, 70, 0.2), 0 0 0 1px rgba(33, 115, 70, 0.3)'
                : '0 4px 14px rgba(0, 0, 0, 0.08)',
              borderRadius: '6px',
              background: '#ffffff',
              cursor: isActive ? 'default' : 'pointer',
              transition: dragState?.id === chartItem.id ? 'none' : 'box-shadow 0.15s ease',
            }}
          >
            {/* Move Drag Bar */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectChart(chartItem.id);
                setDragState({
                  id: chartItem.id,
                  mode: 'move',
                  startX: e.clientX,
                  startY: e.clientY,
                  origPos: chartItem.pos,
                });
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '24px',
                cursor: 'grab',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                background: isActive ? 'rgba(33, 115, 70, 0.08)' : 'transparent',
                borderRadius: '5px 5px 0 0',
              }}
              title="按住拖拽移动图表位置"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isActive && (
                  <span style={{ fontSize: '10px', color: '#217346', fontWeight: 600 }}>
                    ⠿ 移动图表
                  </span>
                )}
              </div>
            </div>

            {/* Contextual Quick Actions Floating Toolstrip */}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '-34px',
                  right: 0,
                  display: 'flex',
                  gap: '4px',
                  background: '#ffffff',
                  border: '1px solid #217346',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  zIndex: 30,
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpenSelectData(chartItem)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    border: '1px solid #d0d7de',
                    borderRadius: '3px',
                    background: '#f6f8fa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  title="选择图表数据源"
                >
                  📊 选择数据
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchRowCol(chartItem)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    border: '1px solid #d0d7de',
                    borderRadius: '3px',
                    background: '#f6f8fa',
                    cursor: 'pointer',
                  }}
                  title="切换行/列"
                >
                  ⇄ 切换行列
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFormatPane(chartItem)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    border: '1px solid #d0d7de',
                    borderRadius: '3px',
                    background: '#f6f8fa',
                    cursor: 'pointer',
                  }}
                  title="设置图表格式"
                >
                  🎨 设置格式
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteChart(chartItem.id)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    border: '1px solid #ff8182',
                    borderRadius: '3px',
                    background: '#ffebe9',
                    color: '#cf222e',
                    cursor: 'pointer',
                  }}
                  title="删除图表"
                >
                  🗑 删除
                </button>
              </div>
            )}

            {/* Chart SVG Rendering */}
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              <ChartRenderer chart={chartItem.chart} width={width} height={height} />
            </div>

            {/* 8 Resize Handles when Active */}
            {isActive &&
              ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                let top: number | string = 'auto';
                let left: number | string = 'auto';
                let cursor = `${handle}-resize`;

                if (handle.includes('n')) top = -5;
                else if (handle.includes('s')) top = height - 5;
                else top = height / 2 - 5;

                if (handle.includes('w')) left = -5;
                else if (handle.includes('e')) left = width - 5;
                else left = width / 2 - 5;

                return (
                  <div
                    key={handle}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({
                        id: chartItem.id,
                        mode: 'resize',
                        handle,
                        startX: e.clientX,
                        startY: e.clientY,
                        origPos: chartItem.pos,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width: '10px',
                      height: '10px',
                      background: '#ffffff',
                      border: '1.5px solid #217346',
                      borderRadius: '2px',
                      cursor,
                      zIndex: 25,
                    }}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
