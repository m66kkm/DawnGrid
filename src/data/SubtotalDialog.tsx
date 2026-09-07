import { useState } from "react";
import type { PivotField } from "../insert/PivotDialog";

interface SubtotalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fields: PivotField[];
  onApply: (groupCol: number, valueCol: number, fn: "SUM" | "AVERAGE" | "COUNT") => void;
}

export function SubtotalDialog({
  isOpen,
  onClose,
  fields,
  onApply,
}: SubtotalDialogProps) {
  const [groupCol, setGroupCol] = useState(fields[0]?.colIndex ?? 0);
  const [valCol, setValCol] = useState(fields[1]?.colIndex ?? fields[0]?.colIndex ?? 0);
  const [fn, setFn] = useState<"SUM" | "AVERAGE" | "COUNT">("SUM");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply(Number(groupCol), Number(valCol), fn);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>分类汇总 (Subtotal)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-field">
              <span>分类字段 (每当下列字段改变时):</span>
              <select
                className="dialog-select"
                value={groupCol}
                onChange={(e) => setGroupCol(Number(e.target.value))}
              >
                {fields.length > 0 ? (
                  fields.map((f) => (
                    <option key={f.colIndex} value={f.colIndex}>
                      {f.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={0}>列 A</option>
                    <option value={1}>列 B</option>
                  </>
                )}
              </select>
            </label>

            <label className="dialog-field">
              <span>使用函数:</span>
              <select
                className="dialog-select"
                value={fn}
                onChange={(e) => setFn(e.target.value as any)}
              >
                <option value="SUM">求和 (SUM)</option>
                <option value="AVERAGE">平均值 (AVERAGE)</option>
                <option value="COUNT">计数 (COUNT)</option>
              </select>
            </label>

            <label className="dialog-field">
              <span>选定汇总项 (添加分类汇总到):</span>
              <select
                className="dialog-select"
                value={valCol}
                onChange={(e) => setValCol(Number(e.target.value))}
              >
                {fields.length > 0 ? (
                  fields.map((f) => (
                    <option key={f.colIndex} value={f.colIndex}>
                      {f.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1}>列 B</option>
                    <option value={2}>列 C</option>
                  </>
                )}
              </select>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              确定汇总
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
