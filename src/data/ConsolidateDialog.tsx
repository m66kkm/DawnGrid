import { useState } from "react";

interface ConsolidateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRef: string;
  onConsolidate: (fn: string, refs: string[]) => void;
}

export function ConsolidateDialog({
  isOpen,
  onClose,
  defaultRef,
  onConsolidate,
}: ConsolidateDialogProps) {
  const [fn, setFn] = useState("SUM");
  const [inputRef, setInputRef] = useState(defaultRef || "A1:C10");
  const [refList, setRefList] = useState<string[]>([defaultRef || "A1:C10"]);

  if (!isOpen) return null;

  function handleAdd() {
    const trimmed = inputRef.trim().toUpperCase();
    if (trimmed && !refList.includes(trimmed)) {
      setRefList([...refList, trimmed]);
      setInputRef("");
    }
  }

  function handleRemove(idx: number) {
    setRefList(refList.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (refList.length === 0 && inputRef.trim()) {
      onConsolidate(fn, [inputRef.trim().toUpperCase()]);
    } else {
      onConsolidate(fn, refList);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ width: 450 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>合并计算 (Consolidate)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <div className="dialog-panel">
            <label className="dialog-field">
              <span>合并计算函数:</span>
              <select
                className="dialog-select"
                value={fn}
                onChange={(e) => setFn(e.target.value)}
              >
                <option value="SUM">求和 (SUM)</option>
                <option value="AVERAGE">平均值 (AVERAGE)</option>
                <option value="COUNT">计数 (COUNT)</option>
                <option value="MAX">最大值 (MAX)</option>
                <option value="MIN">最小值 (MIN)</option>
              </select>
            </label>

            <label className="dialog-field">
              <span>引用位置区域:</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="dialog-input"
                  style={{ flex: 1 }}
                  value={inputRef}
                  onChange={(e) => setInputRef(e.target.value)}
                  placeholder="例如: Sheet1!A1:C10"
                />
                <button
                  type="button"
                  className="dialog-btn secondary"
                  onClick={handleAdd}
                >
                  添加
                </button>
              </div>
            </label>

            <label className="dialog-field">
              <span>所有引用区域:</span>
              <div
                style={{
                  height: 100,
                  border: "1px solid #d0d7de",
                  borderRadius: 4,
                  overflowY: "auto",
                  background: "#ffffff",
                  padding: 4,
                }}
              >
                {refList.map((ref, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "4px 8px",
                      fontSize: 12,
                      borderBottom: "1px solid #f0f2f5",
                    }}
                  >
                    <span>{ref}</span>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#cf222e",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      onClick={() => handleRemove(idx)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              确定合并计算
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
