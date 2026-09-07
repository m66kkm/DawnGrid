import { useState } from "react";

export interface AllowEditRangeItem {
  title: string;
  ref: string;
}

interface AllowEditRangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ranges: AllowEditRangeItem[];
  onApply: (ranges: AllowEditRangeItem[]) => void;
}

export function AllowEditRangesDialog({
  isOpen,
  onClose,
  ranges,
  onApply,
}: AllowEditRangesDialogProps) {
  const [list, setList] = useState<AllowEditRangeItem[]>(ranges);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [ref, setRef] = useState("");

  if (!isOpen) return null;

  function handleAdd() {
    if (!title.trim() || !ref.trim()) return;
    setList([...list, { title: title.trim(), ref: ref.trim() }]);
    setTitle("");
    setRef("");
  }

  function handleDelete() {
    if (selectedIndex === null) return;
    setList(list.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }

  function handleSave() {
    onApply(list);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "560px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>允许用户编辑区域 (Allow Edit Ranges)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <p style={{ fontSize: "12px", color: "#57606a", marginBottom: "12px" }}>
            在工作表受保护时，指定用户无需密码即可编辑的单元格区域：
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  border: "1px solid #d0d7de",
                  borderRadius: "4px",
                  minHeight: "140px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  background: "#fff",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f6f8fa", borderBottom: "1px solid #d0d7de", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>区域标题</th>
                      <th style={{ padding: "6px 8px" }}>单元格引用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "#8c959f" }}>
                          暂无设置允许编辑的区域
                        </td>
                      </tr>
                    ) : (
                      list.map((item, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setSelectedIndex(idx)}
                          style={{
                            cursor: "pointer",
                            background: selectedIndex === idx ? "#e9f3ed" : "transparent",
                            borderBottom: "1px solid #f0f0f0",
                          }}
                        >
                          <td style={{ padding: "6px 8px", fontWeight: selectedIndex === idx ? 600 : "normal" }}>
                            {item.title}
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#217346" }}>
                            {item.ref}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                className="pivot-btn danger"
                style={{
                  padding: "6px 12px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                }}
                disabled={selectedIndex === null}
                onClick={handleDelete}
              >
                删除(D)
              </button>
            </div>
          </div>

          {/* Add input */}
          <div
            style={{
              border: "1px solid #e1e4e8",
              background: "#f6f8fa",
              borderRadius: "6px",
              padding: "10px",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#24292f" }}>添加新允许区域</h4>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "12px" }}>标题(T):</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如: 录入区"
                style={{
                  padding: "4px 8px",
                  border: "1px solid #d0d7de",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
              <label style={{ fontSize: "12px" }}>引用单元格:</label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="例如: =B2:D20"
                style={{
                  padding: "4px 8px",
                  border: "1px solid #d0d7de",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                className="pivot-btn primary"
                style={{ padding: "4px 12px", fontSize: "12px" }}
                onClick={handleAdd}
              >
                添加到列表
              </button>
            </div>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "12px 16px",
            borderTop: "1px solid #e1e4e8",
          }}
        >
          <button className="pivot-btn" onClick={onClose}>
            取消
          </button>
          <button className="pivot-btn primary" onClick={handleSave}>
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
