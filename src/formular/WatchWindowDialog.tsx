import { useState } from "react";
import { WatchCellItem } from "./types";

export interface WatchWindowDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly watchList: readonly WatchCellItem[];
  readonly onAddWatch: () => void;
  readonly onDeleteWatch: (id: string) => void;
  readonly onRefresh: () => void;
  readonly onJumpToCell?: (sheetName: string, cellAddress: string) => void;
}

export function WatchWindowDialog({
  isOpen,
  onClose,
  watchList,
  onAddWatch,
  onDeleteWatch,
  onRefresh,
  onJumpToCell,
}: WatchWindowDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window watch-window-dialog"
        style={{ width: "640px", maxHeight: "80vh" }}
        role="dialog"
        aria-label="监视窗口"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>监视窗口 (Watch Window)</h3>
          <button className="modal-close-btn" onClick={onClose} title="关闭 (Esc)">
            ✕
          </button>
        </div>

        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Action Toolbar */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="dialog-btn primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              onClick={onAddWatch}
            >
              <span>+</span> 添加监视(A)
            </button>
            <button
              type="button"
              className="dialog-btn secondary"
              disabled={!selectedId}
              onClick={() => {
                if (selectedId) {
                  onDeleteWatch(selectedId);
                  setSelectedId(null);
                }
              }}
            >
              删除监视(D)
            </button>
            <button
              type="button"
              className="dialog-btn secondary"
              onClick={onRefresh}
            >
              ⟳ 刷新(R)
            </button>
            <span style={{ fontSize: "11px", color: "#6e7781", marginLeft: "auto" }}>
              双击表格行可跳转至该单元格
            </span>
          </div>

          {/* Table of Watched Cells */}
          <div
            style={{
              height: "260px",
              overflowY: "auto",
              border: "1px solid #d0d7de",
              borderRadius: "6px",
              background: "#ffffff",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "#f6f8fa", borderBottom: "1px solid #d0d7de", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 10px", fontWeight: 600, color: "#24292f" }}>工作簿</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, color: "#24292f" }}>工作表</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, color: "#24292f" }}>单元格</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, color: "#24292f" }}>当前值</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, color: "#24292f" }}>公式</th>
                </tr>
              </thead>
              <tbody>
                {watchList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "36px 0",
                        textAlign: "center",
                        color: "#8c959f",
                        fontStyle: "italic",
                      }}
                    >
                      暂无监视的单元格。点击上方“+ 添加监视”将当前选定单元格加入监视列表。
                    </td>
                  </tr>
                ) : (
                  watchList.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #f0f2f5",
                          cursor: "pointer",
                          background: isSelected ? "#eef8f1" : "transparent",
                          color: isSelected ? "#107c41" : "#24292f",
                          fontWeight: isSelected ? 600 : "normal",
                        }}
                        onClick={() => setSelectedId(item.id)}
                        onDoubleClick={() => onJumpToCell?.(item.sheetName, item.cellAddress)}
                      >
                        <td style={{ padding: "6px 10px" }}>{item.workbookName}</td>
                        <td style={{ padding: "6px 10px" }}>{item.sheetName}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{item.cellAddress}</td>
                        <td style={{ padding: "6px 10px" }}>{String(item.value ?? "")}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0969da" }}>
                          {item.formula || "（无公式）"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div className="modal-actions" style={{ marginTop: "6px", paddingTop: "10px" }}>
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
