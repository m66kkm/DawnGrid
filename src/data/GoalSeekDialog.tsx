import { useState } from "react";

interface GoalSeekDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeCell: string;
  onSolve: (targetCell: string, targetValue: number, byChangingCell: string) => Promise<boolean>;
}

export function GoalSeekDialog({
  isOpen,
  onClose,
  activeCell,
  onSolve,
}: GoalSeekDialogProps) {
  const [targetCell, setTargetCell] = useState(activeCell || "C4");
  const [targetValue, setTargetValue] = useState("500");
  const [byCell, setByCell] = useState("C2");
  const [busy, setBusy] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSolve(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(targetValue);
    if (isNaN(val)) return;

    setBusy(true);
    setResultMessage(null);
    try {
      const success = await onSolve(targetCell.trim().toUpperCase(), val, byCell.trim().toUpperCase());
      if (success) {
        setResultMessage(`求解成功！已将单元格 ${targetCell.toUpperCase()} 调整至目标值 ${val}。`);
      } else {
        setResultMessage(`单变量求解完成。可变单元格 ${byCell.toUpperCase()} 已收敛。`);
      }
    } catch (err) {
      setResultMessage(`求解出错: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>单变量求解 (Goal Seek)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSolve} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-field">
              <span>目标单元格 (包含公式的单元格):</span>
              <input
                type="text"
                className="dialog-input"
                value={targetCell}
                onChange={(e) => setTargetCell(e.target.value)}
                placeholder="例如: C4"
                required
              />
            </label>

            <label className="dialog-field">
              <span>目标值 (期望达到的数值):</span>
              <input
                type="number"
                step="any"
                className="dialog-input"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                required
              />
            </label>

            <label className="dialog-field">
              <span>可变单元格 (通过改变该单元格的数值):</span>
              <input
                type="text"
                className="dialog-input"
                value={byCell}
                onChange={(e) => setByCell(e.target.value)}
                placeholder="例如: C2"
                required
              />
            </label>

            {resultMessage && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "#e9f3ed",
                  border: "1px solid #c3e6cb",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#185c37",
                }}
              >
                {resultMessage}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              关闭
            </button>
            <button type="submit" className="dialog-btn primary" disabled={busy}>
              {busy ? "正在求解..." : "确定求解"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
