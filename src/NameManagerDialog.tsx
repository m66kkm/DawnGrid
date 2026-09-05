import { useState } from "react";

export interface DefinedNameRow {
  name: string;
  ref: string;
  scope: string;
}

interface NameManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  names: DefinedNameRow[];
  onAdd: (name: string, ref: string, scope: string) => void;
  onDelete: (name: string) => void;
}

export function NameManagerDialog({
  isOpen,
  onClose,
  names,
  onAdd,
  onDelete,
}: NameManagerDialogProps) {
  const [selectedName, setSelectedName] = useState<DefinedNameRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newScope, setNewScope] = useState("工作簿");

  if (!isOpen) return null;

  function handleSaveAdd() {
    if (!newName.trim() || !newRef.trim()) return;
    onAdd(newName.trim(), newRef.trim(), newScope);
    setIsAdding(false);
    setNewName("");
    setNewRef("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "620px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>名称管理器 (Name Manager)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              className="pivot-btn primary"
              style={{ padding: "6px 12px" }}
              onClick={() => setIsAdding(true)}
            >
              新建(N)...
            </button>
            <button
              className="pivot-btn danger"
              style={{
                padding: "6px 12px",
                background: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
              }}
              disabled={!selectedName}
              onClick={() => {
                if (selectedName) {
                  onDelete(selectedName.name);
                  setSelectedName(null);
                }
              }}
            >
              删除(D)
            </button>
          </div>

          {isAdding && (
            <div
              style={{
                border: "1px solid #217346",
                background: "#f8fdf9",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#217346" }}>新建名称</h4>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px", alignItems: "center" }}>
                <label style={{ fontSize: "12px" }}>名称(M):</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: SalesTotal"
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #d0d7de",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
                <label style={{ fontSize: "12px" }}>范围(S):</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #d0d7de",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  <option value="工作簿">工作簿</option>
                  <option value="Sheet1">Sheet1</option>
                </select>
                <label style={{ fontSize: "12px" }}>引用位置(R):</label>
                <input
                  type="text"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  placeholder="例如: =Sheet1!$A$1:$D$10"
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #d0d7de",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  className="pivot-btn"
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                  onClick={() => setIsAdding(false)}
                >
                  取消
                </button>
                <button
                  className="pivot-btn primary"
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                  onClick={handleSaveAdd}
                >
                  保存
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              border: "1px solid #d0d7de",
              borderRadius: "4px",
              minHeight: "180px",
              maxHeight: "240px",
              overflowY: "auto",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f6f8fa", borderBottom: "1px solid #d0d7de", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>名称</th>
                  <th style={{ padding: "6px 8px" }}>引用位置</th>
                  <th style={{ padding: "6px 8px" }}>范围</th>
                </tr>
              </thead>
              <tbody>
                {names.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: "24px", color: "#8c959f" }}>
                      未定义任何名称
                    </td>
                  </tr>
                ) : (
                  names.map((item) => {
                    const isSelected = selectedName?.name === item.name;
                    return (
                      <tr
                        key={item.name}
                        onClick={() => setSelectedName(item)}
                        style={{
                          cursor: "pointer",
                          background: isSelected ? "#e9f3ed" : "transparent",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                      >
                        <td style={{ padding: "6px 8px", fontWeight: isSelected ? 600 : "normal" }}>
                          🏷 {item.name}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#57606a", fontFamily: "monospace" }}>
                          {item.ref}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#57606a" }}>{item.scope}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedName && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#57606a" }}>
              当前引用位置: <code style={{ color: "#217346", fontWeight: 600 }}>{selectedName.ref}</code>
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 16px",
            borderTop: "1px solid #e1e4e8",
          }}
        >
          <button className="pivot-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
