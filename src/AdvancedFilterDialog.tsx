import { useState } from "react";
import type { PivotField } from "./PivotDialog";

interface AdvancedFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fields: PivotField[];
  onApply: (colIndex: number, op1: string, val1: string, logic: "AND" | "OR", op2?: string, val2?: string) => void;
}

export function AdvancedFilterDialog({
  isOpen,
  onClose,
  fields,
  onApply,
}: AdvancedFilterDialogProps) {
  const [colIndex, setColIndex] = useState(fields[0]?.colIndex ?? 0);
  const [op1, setOp1] = useState("equal");
  const [val1, setVal1] = useState("");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [op2, setOp2] = useState("equal");
  const [val2, setVal2] = useState("");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply(Number(colIndex), op1, val1, logic, val2 ? op2 : undefined, val2 ? val2 : undefined);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>自定义高级筛选 (Advanced Filter)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-field">
              <span>筛选目标列:</span>
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
                    <option value={0}>列 A</option>
                    <option value={1}>列 B</option>
                    <option value={2}>列 C</option>
                  </>
                )}
              </select>
            </label>

            <div className="dialog-row">
              <label className="dialog-field">
                <span>条件 1:</span>
                <select
                  className="dialog-select"
                  value={op1}
                  onChange={(e) => setOp1(e.target.value)}
                >
                  <option value="equal">等于</option>
                  <option value="notEqual">不等于</option>
                  <option value="greaterThan">大于</option>
                  <option value="greaterThanOrEqual">大于或等于</option>
                  <option value="lessThan">小于</option>
                  <option value="lessThanOrEqual">小于或等于</option>
                  <option value="contains">包含</option>
                </select>
              </label>

              <label className="dialog-field">
                <span>条件值:</span>
                <input
                  type="text"
                  className="dialog-input"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="值..."
                  required
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 16, margin: "4px 0" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="logic"
                  checked={logic === "AND"}
                  onChange={() => setLogic("AND")}
                />
                <span>与 (AND)</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="logic"
                  checked={logic === "OR"}
                  onChange={() => setLogic("OR")}
                />
                <span>或 (OR)</span>
              </label>
            </div>

            <div className="dialog-row">
              <label className="dialog-field">
                <span>条件 2 (可选):</span>
                <select
                  className="dialog-select"
                  value={op2}
                  onChange={(e) => setOp2(e.target.value)}
                >
                  <option value="equal">等于</option>
                  <option value="notEqual">不等于</option>
                  <option value="greaterThan">大于</option>
                  <option value="greaterThanOrEqual">大于或等于</option>
                  <option value="lessThan">小于</option>
                  <option value="lessThanOrEqual">小于或等于</option>
                  <option value="contains">包含</option>
                </select>
              </label>

              <label className="dialog-field">
                <span>条件值:</span>
                <input
                  type="text"
                  className="dialog-input"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="留空则仅执行条件 1"
                />
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              应用筛选
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
