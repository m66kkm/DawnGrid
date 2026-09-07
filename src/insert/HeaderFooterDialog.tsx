import { useState } from "react";

export interface HeaderFooterData {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

interface HeaderFooterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: HeaderFooterData;
  onApply: (data: HeaderFooterData) => void;
}

export function HeaderFooterDialog({
  isOpen,
  onClose,
  initialData,
  onApply,
}: HeaderFooterDialogProps) {
  const [data, setData] = useState<HeaderFooterData>(() => ({
    headerLeft: initialData?.headerLeft ?? "",
    headerCenter: initialData?.headerCenter ?? "",
    headerRight: initialData?.headerRight ?? "",
    footerLeft: initialData?.footerLeft ?? "",
    footerCenter: initialData?.footerCenter ?? "第 &[页码] 页，共 &[总页数] 页",
    footerRight: initialData?.footerRight ?? "",
  }));

  if (!isOpen) return null;

  function insertCode(field: keyof HeaderFooterData, code: string) {
    setData((prev) => ({
      ...prev,
      [field]: prev[field] + code,
    }));
  }

  function handleSave() {
    onApply(data);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "640px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>页眉与页脚 (Header & Footer)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {/* Header Section */}
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#217346", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🗎</span> 打印页眉 (Header)
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  左侧节
                </label>
                <textarea
                  rows={3}
                  value={data.headerLeft}
                  onChange={(e) => setData({ ...data, headerLeft: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  中间节
                </label>
                <textarea
                  rows={3}
                  value={data.headerCenter}
                  onChange={(e) => setData({ ...data, headerCenter: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  右侧节
                </label>
                <textarea
                  rows={3}
                  value={data.headerRight}
                  onChange={(e) => setData({ ...data, headerRight: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#217346", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🗎</span> 打印页脚 (Footer)
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  左侧节
                </label>
                <textarea
                  rows={3}
                  value={data.footerLeft}
                  onChange={(e) => setData({ ...data, footerLeft: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  中间节
                </label>
                <textarea
                  rows={3}
                  value={data.footerCenter}
                  onChange={(e) => setData({ ...data, footerCenter: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#57606a", display: "block", marginBottom: "4px" }}>
                  右侧节
                </label>
                <textarea
                  rows={3}
                  value={data.footerRight}
                  onChange={(e) => setData({ ...data, footerRight: e.target.value })}
                  style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d0d7de", borderRadius: "4px" }}
                />
              </div>
            </div>
          </div>

          {/* Field Code Quick Insert Bar */}
          <div style={{ background: "#f6f8fa", padding: "10px", borderRadius: "6px", border: "1px solid #d0d7de" }}>
            <span style={{ fontSize: "11px", color: "#57606a", marginRight: "8px", fontWeight: 600 }}>
              快捷代码插入 (向中间页脚添加):
            </span>
            <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
              <button
                type="button"
                className="pivot-btn"
                style={{ fontSize: "11px", padding: "2px 8px" }}
                onClick={() => insertCode("footerCenter", " &[页码] ")}
              >
                # 页码
              </button>
              <button
                type="button"
                className="pivot-btn"
                style={{ fontSize: "11px", padding: "2px 8px" }}
                onClick={() => insertCode("footerCenter", " &[总页数] ")}
              >
                ## 总页数
              </button>
              <button
                type="button"
                className="pivot-btn"
                style={{ fontSize: "11px", padding: "2px 8px" }}
                onClick={() => insertCode("footerRight", " &[日期] ")}
              >
                📅 当前日期
              </button>
              <button
                type="button"
                className="pivot-btn"
                style={{ fontSize: "11px", padding: "2px 8px" }}
                onClick={() => insertCode("footerLeft", " &[工作表名] ")}
              >
                📑 工作表名
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
