import { useState } from "react";

interface RecommendedChartsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChart: (type: string) => void;
}

const RECO_CHARTS = [
  {
    type: "column",
    title: "簇状柱形图 (Clustered Column)",
    symbol: "▮▬",
    desc: "用于跨类别比较值。当类别顺序并不重要时可以使用。",
  },
  {
    type: "line",
    title: "折线图 (Line)",
    symbol: "📈",
    desc: "用于显示随时间或有序类别的趋势，特别适合多个系列的数据趋势展示。",
  },
  {
    type: "bar",
    title: "簇状条形图 (Clustered Bar)",
    symbol: "▤",
    desc: "横向比较不同项目之间的大小，适合标签文本较长的情况。",
  },
  {
    type: "pie",
    title: "饼图 (Pie)",
    symbol: "◔",
    desc: "用于显示各项占总体的比例关系。所有数据点总和为 100%。",
  },
  {
    type: "area",
    title: "面积图 (Area)",
    symbol: "◪",
    desc: "用于强调数量随时间变化的程度，并引起对总值趋势的注意。",
  },
  {
    type: "scatter",
    title: "散点图 (Scatter)",
    symbol: "∴",
    desc: "用于显示若干数据系列中各数值之间的关系，或绘制两组数字作为一组坐标。",
  },
];

export function RecommendedChartsDialog({
  isOpen,
  onClose,
  onSelectChart,
}: RecommendedChartsDialogProps) {
  const [selectedType, setSelectedType] = useState("column");

  if (!isOpen) return null;

  const current = RECO_CHARTS.find((c) => c.type === selectedType) || RECO_CHARTS[0];

  function handleInsert() {
    onSelectChart(selectedType);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "650px", height: "460px", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>插入图表 - 推荐的图表 (Recommended Charts)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, display: "flex", overflow: "hidden", padding: 0 }}>
          {/* Left chart list */}
          <div
            style={{
              width: "240px",
              borderRight: "1px solid #e1e4e8",
              background: "#f8f9fa",
              overflowY: "auto",
              padding: "8px",
            }}
          >
            {RECO_CHARTS.map((chart) => (
              <div
                key={chart.type}
                onClick={() => setSelectedType(chart.type)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginBottom: "4px",
                  background: selectedType === chart.type ? "#e9f3ed" : "transparent",
                  border: selectedType === chart.type ? "1px solid #217346" : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: "20px" }}>{chart.symbol}</span>
                <span style={{ fontSize: "12px", fontWeight: selectedType === chart.type ? 600 : "normal" }}>
                  {chart.title.split(" (")[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Right preview details */}
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", color: "#217346" }}>{current.title}</h4>
            <p style={{ fontSize: "12.5px", color: "#57606a", lineHeight: "1.6", marginBottom: "20px" }}>
              {current.desc}
            </p>

            <div
              style={{
                flex: 1,
                border: "1px dashed #d0d7de",
                borderRadius: "6px",
                background: "#fafbfc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "64px" }}>{current.symbol}</span>
              <span style={{ fontSize: "12px", color: "#8c959f" }}>基于当前活动选区的数据结构智能推荐</span>
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
          <button className="pivot-btn primary" onClick={handleInsert}>
            确定插入
          </button>
        </div>
      </div>
    </div>
  );
}
