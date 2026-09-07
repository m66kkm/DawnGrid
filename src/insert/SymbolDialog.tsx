import { useState } from "react";

interface SymbolDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (char: string) => void;
}

const SYMBOL_CATEGORIES = [
  {
    name: "常用与货币",
    symbols: ["¥", "$", "€", "£", "¢", "₩", "₽", "₹", "©", "®", "™", "§", "¶", "•", "…", "°", "‰", "№"],
  },
  {
    name: "数学运算符",
    symbols: [
      "±", "×", "÷", "≠", "≈", "≤", "≥", "∞", "√", "∑", "∏", "∫", "∂", "∆", "π", "µ", "∈", "∉", "⊂", "⊃", "∩", "∪",
      "∀", "∃", "∅", "∝", "∴", "∵", "⊥", "∥",
    ],
  },
  {
    name: "箭头符号",
    symbols: ["←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓", "⇔", "↗", "↘", "↙", "↖", "↩", "↪", "⇄", "⇅", "↦"],
  },
  {
    name: "希腊字母",
    symbols: [
      "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "λ", "μ", "π", "ρ", "σ", "τ", "φ", "χ", "ψ", "ω", "Α", "Β", "Γ", "Δ",
      "Θ", "Λ", "Σ", "Φ", "Ω",
    ],
  },
  {
    name: "几何与图形",
    symbols: [
      "★", "☆", "●", "○", "◆", "◇", "■", "□", "▲", "△", "▼", "▽", "✓", "✗", "☑", "☐", "♠", "♣", "♥", "♦", "♪", "♫",
      "☀", "☁", "☂", "☎",
    ],
  },
];

export function SymbolDialog({ isOpen, onClose, onInsert }: SymbolDialogProps) {
  const [activeCatIndex, setActiveCatIndex] = useState(0);

  if (!isOpen) return null;

  const currentCat = SYMBOL_CATEGORIES[activeCatIndex];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: "520px", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>插入符号 (Insert Symbol)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e1e4e8", background: "#f6f8fa", padding: "0 8px" }}>
          {SYMBOL_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setActiveCatIndex(idx)}
              style={{
                padding: "8px 12px",
                border: "none",
                background: "none",
                borderBottom: activeCatIndex === idx ? "2px solid #217346" : "2px solid transparent",
                color: activeCatIndex === idx ? "#217346" : "#57606a",
                fontWeight: activeCatIndex === idx ? 600 : "normal",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ padding: "16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "6px",
              maxHeight: "220px",
              overflowY: "auto",
              padding: "4px",
            }}
          >
            {currentCat.symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  onInsert(sym);
                }}
                style={{
                  height: "38px",
                  fontSize: "18px",
                  border: "1px solid #e1e4e8",
                  borderRadius: "4px",
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#217346";
                  e.currentTarget.style.background = "#e9f3ed";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e1e4e8";
                  e.currentTarget.style.background = "#ffffff";
                }}
                title={`点击插入: ${sym}`}
              >
                {sym}
              </button>
            ))}
          </div>
          <p style={{ marginTop: "12px", fontSize: "11px", color: "#8c959f" }}>
            提示：点击符号可直接插入到当前选中的活动单元格中，支持连续点击插入多个符号。
          </p>
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
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
