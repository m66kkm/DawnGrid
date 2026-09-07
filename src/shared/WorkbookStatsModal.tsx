interface WorkbookStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    sheetCount: number;
    cellCount: number;
    formulaCount: number;
    rowCount: number;
    colCount: number;
  };
}

export function WorkbookStatsModal({ isOpen, onClose, stats }: WorkbookStatsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "420px", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>工作簿统计信息 (Workbook Statistics)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: "16px" }}>
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#217346", fontWeight: 600 }}>
              当前工作表
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              <div style={{ color: "#57606a" }}>使用单元格数:</div>
              <div style={{ fontWeight: 600, color: "#24292f" }}>{stats.cellCount.toLocaleString()}</div>

              <div style={{ color: "#57606a" }}>包含公式单元格:</div>
              <div style={{ fontWeight: 600, color: "#24292f" }}>{stats.formulaCount.toLocaleString()}</div>

              <div style={{ color: "#57606a" }}>数据最大行数:</div>
              <div style={{ fontWeight: 600, color: "#24292f" }}>{stats.rowCount.toLocaleString()}</div>

              <div style={{ color: "#57606a" }}>数据最大列数:</div>
              <div style={{ fontWeight: 600, color: "#24292f" }}>{stats.colCount.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e1e4e8", paddingTop: "12px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#217346", fontWeight: 600 }}>
              整个工作簿
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              <div style={{ color: "#57606a" }}>工作表总数:</div>
              <div style={{ fontWeight: 600, color: "#24292f" }}>{stats.sheetCount}</div>
            </div>
          </div>
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
          <button className="pivot-btn primary" onClick={onClose}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
