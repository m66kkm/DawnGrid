import { useState } from "react";

export interface PivotField {
  label: string;
  colIndex: number;
}

export interface PivotConfig {
  sourceRange: string;
  rowColIndex: number;
  valColIndex: number;
  agg: "SUM" | "COUNT" | "AVERAGE" | "MAX" | "MIN";
  targetCell: string;
}

interface PivotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fields: PivotField[];
  defaultRange: string;
  onCreate: (config: PivotConfig) => void;
}

export function PivotDialog({
  isOpen,
  onClose,
  fields,
  defaultRange,
  onCreate,
}: PivotDialogProps) {
  const [sourceRange, setSourceRange] = useState(defaultRange || "A1:C4");
  const [rowCol, setRowCol] = useState(fields[0]?.colIndex ?? 0);
  const [valCol, setValCol] = useState(fields[1]?.colIndex ?? fields[0]?.colIndex ?? 0);
  const [agg, setAgg] = useState<PivotConfig["agg"]>("SUM");
  const [targetCell, setTargetCell] = useState("E2");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({
      sourceRange: sourceRange.trim().toUpperCase(),
      rowColIndex: Number(rowCol),
      valColIndex: Number(valCol),
      agg,
      targetCell: targetCell.trim().toUpperCase(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>创建数据透视表 (Create Pivot Table)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-field">
              <span>选择数据源区域 (例如: A1:C10):</span>
              <input
                type="text"
                className="dialog-input"
                value={sourceRange}
                onChange={(e) => setSourceRange(e.target.value)}
                required
              />
            </label>

            <div className="dialog-row">
              <label className="dialog-field">
                <span>行维度字段:</span>
                <select
                  className="dialog-select"
                  value={rowCol}
                  onChange={(e) => setRowCol(Number(e.target.value))}
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

              <label className="dialog-field">
                <span>汇总数值字段:</span>
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

            <div className="dialog-row">
              <label className="dialog-field">
                <span>汇总计算方式:</span>
                <select
                  className="dialog-select"
                  value={agg}
                  onChange={(e) => setAgg(e.target.value as any)}
                >
                  <option value="SUM">求和 (SUM)</option>
                  <option value="COUNT">计数 (COUNT)</option>
                  <option value="AVERAGE">平均值 (AVERAGE)</option>
                  <option value="MAX">最大值 (MAX)</option>
                  <option value="MIN">最小值 (MIN)</option>
                </select>
              </label>

              <label className="dialog-field">
                <span>输出起始单元格:</span>
                <input
                  type="text"
                  className="dialog-input"
                  value={targetCell}
                  onChange={(e) => setTargetCell(e.target.value)}
                  placeholder="E2"
                  required
                />
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              生成透视表
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
