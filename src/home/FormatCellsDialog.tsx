import { useState } from "react";
import type { SelectionFormat } from "../shared/selection-format";
import { fontFamilyGroups, useSystemFontFamilies } from "../shared/system-fonts";

interface FormatCellsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectionFormat: SelectionFormat | null;
  onApply: (patch: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    fontColor?: string;
    fillColor?: string;
    align?: string;
    valign?: string;
    wrap?: boolean;
    numberFormat?: string;
  }) => void;
}

export function FormatCellsDialog({
  isOpen,
  onClose,
  selectionFormat,
  onApply,
}: FormatCellsDialogProps) {
  const [activeTab, setActiveTab] = useState<"number" | "alignment" | "font" | "fill">("font");

  const [fontFamily, setFontFamily] = useState(selectionFormat?.fontFamily || "Aptos");
  const { families: systemFontFamilies, load: loadSystemFonts } = useSystemFontFamilies();
  const fontGroups = fontFamilyGroups(systemFontFamilies, fontFamily);
  const [fontSize, setFontSize] = useState(selectionFormat?.fontSize || 11);
  const [bold, setBold] = useState(selectionFormat?.bold || false);
  const [italic, setItalic] = useState(selectionFormat?.italic || false);
  const [underline, setUnderline] = useState(selectionFormat?.underline || false);
  const [strike, setStrike] = useState(selectionFormat?.strike || false);
  const [fontColor, setFontColor] = useState(selectionFormat?.fontColor || "#000000");
  const [fillColor, setFillColor] = useState(selectionFormat?.fillColor || "#ffffff");
  const [align, setAlign] = useState(selectionFormat?.horizontalAlignment || "left");
  const [valign, setValign] = useState(selectionFormat?.verticalAlignment || "middle");
  const [wrap, setWrap] = useState(selectionFormat?.wrap || false);
  const [numFmt, setNumFmt] = useState(selectionFormat?.numberFormat || "General");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply({
      fontFamily,
      fontSize,
      bold,
      italic,
      underline,
      strike,
      fontColor,
      fillColor,
      align,
      valign,
      wrap,
      numberFormat: numFmt,
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window format-cells-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>设置单元格格式</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-tabs">
          <button
            className={`dialog-tab ${activeTab === "number" ? "active" : ""}`}
            onClick={() => setActiveTab("number")}
          >
            数字
          </button>
          <button
            className={`dialog-tab ${activeTab === "alignment" ? "active" : ""}`}
            onClick={() => setActiveTab("alignment")}
          >
            对齐
          </button>
          <button
            className={`dialog-tab ${activeTab === "font" ? "active" : ""}`}
            onClick={() => setActiveTab("font")}
          >
            字体
          </button>
          <button
            className={`dialog-tab ${activeTab === "fill" ? "active" : ""}`}
            onClick={() => setActiveTab("fill")}
          >
            填充
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          {activeTab === "number" && (
            <div className="dialog-panel">
              <label className="dialog-field">
                <span>格式分类:</span>
                <select
                  value={numFmt}
                  onChange={(e) => setNumFmt(e.target.value)}
                  className="dialog-select"
                >
                  <option value="General">常规 (不包含任何特定的数字格式)</option>
                  <option value="0.00">数值 (保留2位小数)</option>
                  <option value="¥#,##0.00">货币 (人民币 ¥#,##0.00)</option>
                  <option value="$#,##0.00">货币 (美元 $#,##0.00)</option>
                  <option value="yyyy-mm-dd">短日期 (2026-09-05)</option>
                  <option value="0.00%">百分比 (0.00%)</option>
                  <option value="#,##0">千分位整数 (#,##0)</option>
                  <option value="@">文本格式</option>
                </select>
              </label>
            </div>
          )}

          {activeTab === "alignment" && (
            <div className="dialog-panel">
              <div className="dialog-row">
                <label className="dialog-field">
                  <span>水平对齐:</span>
                  <select
                    value={align}
                    onChange={(e) => setAlign(e.target.value)}
                    className="dialog-select"
                  >
                    <option value="left">左对齐</option>
                    <option value="center">居中</option>
                    <option value="right">右对齐</option>
                  </select>
                </label>
                <label className="dialog-field">
                  <span>垂直对齐:</span>
                  <select
                    value={valign}
                    onChange={(e) => setValign(e.target.value)}
                    className="dialog-select"
                  >
                    <option value="top">靠上对齐</option>
                    <option value="middle">垂直居中</option>
                    <option value="bottom">靠下对齐</option>
                  </select>
                </label>
              </div>
              <label className="dialog-checkbox">
                <input
                  type="checkbox"
                  checked={wrap}
                  onChange={(e) => setWrap(e.target.checked)}
                />
                <span>自动换行</span>
              </label>
            </div>
          )}

          {activeTab === "font" && (
            <div className="dialog-panel">
              <div className="dialog-row">
                <label className="dialog-field">
                  <span>字体:</span>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    onFocus={loadSystemFonts}
                    className="dialog-select"
                  >
                    <optgroup label="常用字体">
                      {fontGroups.common.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </optgroup>
                    {fontGroups.system.length > 0 && (
                      <optgroup label="所有系统字体">
                        {fontGroups.system.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                <label className="dialog-field">
                  <span>字号:</span>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="dialog-select"
                  >
                    {[9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="dialog-checks-row">
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={bold}
                    onChange={(e) => setBold(e.target.checked)}
                  />
                  <span>加粗 (Bold)</span>
                </label>
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={italic}
                    onChange={(e) => setItalic(e.target.checked)}
                  />
                  <span>斜体 (Italic)</span>
                </label>
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={underline}
                    onChange={(e) => setUnderline(e.target.checked)}
                  />
                  <span>下划线 (Underline)</span>
                </label>
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={strike}
                    onChange={(e) => setStrike(e.target.checked)}
                  />
                  <span>删除线 (Strikethrough)</span>
                </label>
              </div>

              <label className="dialog-field" style={{ marginTop: 12 }}>
                <span>字体颜色:</span>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                />
              </label>
            </div>
          )}

          {activeTab === "fill" && (
            <div className="dialog-panel">
              <label className="dialog-field">
                <span>单元格背景颜色:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                  />
                  <button
                    type="button"
                    className="dialog-btn secondary"
                    onClick={() => setFillColor("#ffffff")}
                  >
                    无填充色
                  </button>
                </div>
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
