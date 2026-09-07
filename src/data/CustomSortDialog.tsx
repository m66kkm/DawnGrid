import { useState } from "react";
import type { PivotField } from "../insert/PivotDialog";

interface CustomSortDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fields: PivotField[];
  onSort: (colIndex: number, ascending: boolean, hasHeader: boolean) => void;
}

export function CustomSortDialog({
  isOpen,
  onClose,
  fields,
  onSort,
}: CustomSortDialogProps) {
  const [colIndex, setColIndex] = useState(fields[0]?.colIndex ?? 0);
  const [ascending, setAscending] = useState(true);
  const [hasHeader, setHasHeader] = useState(true);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSort(Number(colIndex), ascending, hasHeader);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>自定义排序 (Custom Sort)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-checkbox" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />
              <span>数据包含标题行</span>
            </label>

            <div className="dialog-row">
              <label className="dialog-field">
                <span>主要关键字 (列):</span>
                <select
                  className="dialog-select"
                  value={colIndex}
                  onChange={(e) => setColIndex(Number(e.target.value))}
                >
                  {fields.length > 0 ? (
                    fields.map((f) => (
                      <option key={f.colIndex} value={f.colIndex}>
                        {f.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={0}>第 1 列 (A)</option>
                      <option value={1}>第 2 列 (B)</option>
                      <option value={2}>第 3 列 (C)</option>
                    </>
                  )}
                </select>
              </label>

              <label className="dialog-field">
                <span>排序次序:</span>
                <select
                  className="dialog-select"
                  value={ascending ? "asc" : "desc"}
                  onChange={(e) => setAscending(e.target.value === "asc")}
                >
                  <option value="asc">升序 (A 到 Z / 小到大)</option>
                  <option value="desc">降序 (Z 到 A / 大到小)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              执行排序
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
