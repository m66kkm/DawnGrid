import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectionFormat } from "./selection-format";
import {
  CaretIcon,
  RedoIcon,
  SaveAsIcon,
  SaveIcon,
  ToolSymbol,
  UndoIcon,
} from "./ribbon-icons";
import { MenuSelect, EditableMenuSelect } from "./MenuSelect";
import { fontFamilyGroups, useSystemFontFamilies } from "./system-fonts";

export interface RibbonProps {
  onCommand: (command: string, ...args: any[]) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onNewWorkbook?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onSaveAsCsv?: () => void;
  onOpenFile?: () => void;
  fileName?: string;
  statusMessage?: string;
  selectionFormat?: SelectionFormat | null;
  sheetProtected?: boolean;
  workbookProtected?: boolean;
  formulaBarVisible?: boolean;
  crossHighlightVisible?: boolean;
  showGridlines?: boolean;
  showHeadings?: boolean;
  printGridlines?: boolean;
  printHeadings?: boolean;
  pageBreakPreview?: boolean;
  calcManual?: boolean;
  selectedChart?: boolean;
  hasCharts?: boolean;
  definedNames?: string[];
}

const TABS = ["开始", "插入", "页面布局", "公式", "数据", "审阅", "视图"] as const;
type TabType = typeof TABS[number] | "图表设计";

function LargeMenu({
  label,
  symbol,
  title,
  options,
  onPick,
}: {
  label: string;
  symbol: string;
  title: string;
  options: readonly { value: string; label: string }[];
  onPick: (val: string) => void;
}) {
  return (
    <div className="ribbon-tool large" title={title} style={{ position: "relative" }}>
      <span className="tool-icon-row">
        <ToolSymbol symbol={symbol} />
        <CaretIcon />
      </span>
      <span>
        <strong>{label}</strong>
      </span>
      <MenuSelect cover label={label} options={options} onPick={onPick} />
    </div>
  );
}

export function Ribbon({
  onCommand,
  canUndo = true,
  canRedo = true,
  onUndo,
  onRedo,
  onNewWorkbook,
  onSave,
  onSaveAs,
  onSaveAsCsv,
  onOpenFile,
  fileName = "未命名表格.xlsx",
  statusMessage = "",
  selectionFormat,
  sheetProtected = false,
  workbookProtected = false,
  formulaBarVisible = true,
  crossHighlightVisible = false,
  showGridlines = true,
  showHeadings = true,
  printGridlines = false,
  printHeadings = false,
  pageBreakPreview = false,
  calcManual = false,
  selectedChart = false,
  hasCharts = false,
  definedNames = [],
}: RibbonProps) {
  const [activeTab, setActiveTab] = useState<TabType>("开始");
  const [autoSave, setAutoSave] = useState(true);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    }
    if (isFileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFileMenuOpen]);

  // Active formatting state
  const [fontFamily, setFontFamily] = useState("Aptos");
  const [fontSize, setFontSize] = useState("11");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [strike, setStrike] = useState(false);
  const [fontColor, setFontColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("#FFF2CC");
  const [borderColor, setBorderColor] = useState("#000000");
  const [numberFormat, setNumberFormat] = useState("常规");

  // System font discovery (100% Windows + browser parity)
  const { families: systemFontFamilies, load: loadSystemFonts } = useSystemFontFamilies();
  const fontGroups = fontFamilyGroups(systemFontFamilies, fontFamily);
  const familyOptions = [
    ...fontGroups.common.map((family) => ({ value: family, label: family })),
    ...fontGroups.system.map((family, index) => ({
      value: family,
      label: family,
      sep: index === 0,
    })),
  ];

  // Keep toolbar controls in sync with active cell selection
  useEffect(() => {
    if (selectionFormat) {
      if (selectionFormat.fontFamily) setFontFamily(selectionFormat.fontFamily);
      if (selectionFormat.fontSize) setFontSize(String(selectionFormat.fontSize));
      setBold(selectionFormat.bold);
      setItalic(selectionFormat.italic);
      setUnderline(selectionFormat.underline);
      setStrike(selectionFormat.strike);
      if (selectionFormat.fontColor) setFontColor(selectionFormat.fontColor);
      if (selectionFormat.fillColor) setFillColor(selectionFormat.fillColor);
      if (selectionFormat.numberFormat) setNumberFormat(selectionFormat.numberFormat);
    }
  }, [selectionFormat]);

  // If a chart is selected, switch to or allow "图表设计"
  useEffect(() => {
    if (selectedChart && activeTab !== "图表设计") {
      setActiveTab("图表设计");
    } else if (!selectedChart && !hasCharts && activeTab === "图表设计") {
      setActiveTab("开始");
    }
  }, [selectedChart, hasCharts]);

  // Ribbon horizontal overflow management (< and > scroll buttons)
  const ribbonRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ribbonRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  // Recalculate on tab switch or DOM resize
  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;

    checkScroll();

    const ro = new ResizeObserver(() => {
      checkScroll();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [activeTab, checkScroll]);

  const handleScrollLeft = () => {
    if (ribbonRef.current) {
      ribbonRef.current.scrollBy({ left: -260, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (ribbonRef.current) {
      ribbonRef.current.scrollBy({ left: 260, behavior: "smooth" });
    }
  };

  const handleRibbonWheel = (e: React.WheelEvent) => {
    const el = ribbonRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }
  };

  // Prevent button clicks from stealing focus from Univer canvas
  const handlePreventFocusLoss = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "SELECT" && target.tagName !== "INPUT") {
      e.preventDefault();
    }
  };

  const visibleTabs: TabType[] = selectedChart || hasCharts
    ? [...TABS, "图表设计"]
    : [...TABS];

  return (
    <div className="excel-header">
      {/* Top Tab & Quick Access Row */}
      <nav className="ribbon-tabs" onMouseDown={handlePreventFocusLoss}>
        <button
          type="button"
          className="qa-btn"
          title="打开文件 (Ctrl+O)"
          onClick={onOpenFile}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          type="button"
          className="qa-btn"
          title="保存 (Ctrl+S)"
          onClick={onSave}
        >
          <SaveIcon />
        </button>
        <button
          type="button"
          className="qa-btn"
          title="另存为"
          onClick={onSaveAs}
        >
          <SaveAsIcon />
        </button>
        <button
          type="button"
          className="qa-btn"
          title="撤销 (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="qa-btn"
          title="重做 (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <RedoIcon />
        </button>

        <label
          className={`autosave-toggle ${autoSave ? "on" : ""}`}
          title="自动保存改动"
        >
          <span className="autosave-knob" />
          <span className="autosave-text">自动保存</span>
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(e) => setAutoSave(e.target.checked)}
          />
        </label>

        <span className="qa-sep" aria-hidden="true" />

        <div className="file-menu-container" ref={fileMenuRef}>
          <button
            type="button"
            className={`tab-btn file-tab-btn ${isFileMenuOpen ? "active" : ""}`}
            onClick={() => setIsFileMenuOpen((prev) => !prev)}
            title="文件菜单 (新建、打开、保存、另存为、导出)"
          >
            文件
          </button>
          {isFileMenuOpen && (
            <div className="file-menu-dropdown">
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onNewWorkbook?.();
                }}
              >
                <span className="file-menu-icon">📄</span>
                <span className="file-menu-label">新建表格</span>
                <span className="file-menu-shortcut">Ctrl+N</span>
              </div>
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onOpenFile?.();
                }}
              >
                <span className="file-menu-icon">📂</span>
                <span className="file-menu-label">打开文件...</span>
                <span className="file-menu-shortcut">Ctrl+O</span>
              </div>
              <div className="file-menu-separator" />
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onSave?.();
                }}
              >
                <span className="file-menu-icon">💾</span>
                <span className="file-menu-label">保存</span>
                <span className="file-menu-shortcut">Ctrl+S</span>
              </div>
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onSaveAs?.();
                }}
              >
                <span className="file-menu-icon">💾</span>
                <span className="file-menu-label">另存为 (Excel / CSV)...</span>
                <span className="file-menu-shortcut">F12</span>
              </div>
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onSaveAsCsv?.();
                }}
              >
                <span className="file-menu-icon">📑</span>
                <span className="file-menu-label">另存为 CSV 文件...</span>
              </div>
              <div className="file-menu-separator" />
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onCommand("export-pdf");
                }}
              >
                <span className="file-menu-icon">📑</span>
                <span className="file-menu-label">导出为 PDF...</span>
              </div>
              <div
                className="file-menu-item"
                onClick={() => {
                  setIsFileMenuOpen(false);
                  onCommand("workbook-stats");
                }}
              >
                <span className="file-menu-icon">📊</span>
                <span className="file-menu-label">工作簿统计信息</span>
              </div>
            </div>
          )}
        </div>

        {visibleTabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${tab === activeTab ? "active" : ""} ${
              tab === "图表设计" ? "contextual" : ""
            }`}
            onClick={() => {
              setActiveTab(tab);
              if (tab === "图表设计") {
                onCommand("activate-chart-tab");
              }
            }}
          >
            {tab}
          </button>
        ))}

        <span className="ribbon-tabs-spacer" />
        <span className="workbook-status" title={statusMessage || fileName}>
          {statusMessage || fileName}
        </span>
      </nav>

      {/* Main Ribbon Tool Band */}
      <div className="ribbon-scroll-container">
        {canScrollLeft && (
          <button
            type="button"
            className="ribbon-nav-btn ribbon-nav-left"
            title="向左滚动功能区"
            aria-label="向左滚动"
            onClick={handleScrollLeft}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div
          ref={ribbonRef}
          className="ribbon"
          onMouseDown={handlePreventFocusLoss}
          onScroll={checkScroll}
          onWheel={handleRibbonWheel}
        >
        {/* ========================================================= */}
        {/* 1. 开始 (Home)                                             */}
        {/* ========================================================= */}
        {activeTab === "开始" && (
          <>
            {/* 1. AI 助手 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large ai-entry"
                  onClick={() => onCommand("ai-chat")}
                  title="启动 DawnAI 助手"
                >
                  <span className="tool-icon-row">
                    <span className="ai-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2.5L14.4 8.6L20.5 11L14.4 13.4L12 19.5L9.6 13.4L3.5 11L9.6 8.6L12 2.5Z" />
                        <path d="M18.5 3.5L19.5 6L22 7L19.5 8L18.5 10.5L17.5 8L15 7L17.5 6L18.5 3.5Z" />
                      </svg>
                    </span>
                  </span>
                  <span>
                    <strong>DawnAI</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large ai-entry"
                  onClick={() => onCommand("ai-check")}
                  title="智能校验表格数据错误"
                >
                  <span className="tool-icon-row">
                    <span className="ai-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 3.25C15.2802 3.25 18.75 6.71979 18.75 11C18.75 15.2802 15.2802 18.75 11 18.75C6.71979 18.75 3.25 15.2802 3.25 11C3.25 6.71979 6.71979 3.25 11 3.25Z" />
                        <path d="M7.5 10.8235L9.64097 12.9645C9.93755 13.2611 10.4177 13.2634 10.7171 12.9697L14.7647 9" />
                        <path d="M20 20.5L16.5 17" />
                      </svg>
                    </span>
                  </span>
                  <span>
                    <strong>AI 校验</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large ai-entry"
                  onClick={() => onCommand("ai-analyze")}
                  title="智能分析表格数据趋势"
                >
                  <span className="tool-icon-row">
                    <span className="ai-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.88589 14.2073H8.48682" />
                        <path d="M3.88589 19.0112H8.48682" />
                        <path d="M3.88589 9.40369H11.692" />
                        <path d="M3.88589 4.59998H19.1645" />
                        <path d="M15.1995 10.5445C15.3784 10.0908 16.0206 10.0908 16.1996 10.5445L16.706 11.8286C17.0338 12.6598 17.6918 13.3178 18.523 13.6456L19.8071 14.1521C20.2608 14.331 20.2608 14.9732 19.8071 15.1522L18.523 15.6586C17.6918 15.9864 17.0338 16.6444 16.706 17.4756L16.1996 18.7597C16.0206 19.2134 15.3784 19.2134 15.1995 18.7597L14.693 17.4756C14.3652 16.6444 13.7072 15.9864 12.876 15.6586L11.592 15.1522C11.1382 14.9732 11.1382 14.331 11.592 14.1521L12.876 13.6456C13.7072 13.3178 14.3652 12.6598 14.693 11.8286L15.1995 10.5445Z" />
                      </svg>
                    </span>
                  </span>
                  <span>
                    <strong>AI 分析</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 剪贴板 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="粘贴 (Ctrl+V)"
                  onClick={() => onCommand("paste")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📋" />
                  </span>
                  <span>
                    <strong>粘贴</strong>
                  </span>
                </button>
                <LargeMenu
                  label="选择性粘贴"
                  symbol="📑"
                  title="选择性粘贴指定格式"
                  options={[
                    { value: "paste-special:value", label: "仅粘贴数值" },
                    { value: "paste-special:formula", label: "仅粘贴公式" },
                    { value: "paste-special:format", label: "仅粘贴格式" },
                    { value: "paste-special:col-width", label: "保持源列宽" },
                    { value: "paste-special:besides-border", label: "除边框外的所有内容" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <div className="tool-stack">
                  <button title="剪切 (Ctrl+X)" onClick={() => onCommand("cut")}>
                    <ToolSymbol symbol="✂" />
                  </button>
                  <button title="复制 (Ctrl+C)" onClick={() => onCommand("copy")}>
                    <ToolSymbol symbol="⧉" />
                  </button>
                  <button title="格式刷" onClick={() => onCommand("format-painter")}>
                    <ToolSymbol symbol="🖌" />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. 字体 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="ribbon-rows">
                  <div className="inline-tools">
                    <EditableMenuSelect
                      className="select-like font-name"
                      label="Font family"
                      title="字体"
                      value={fontFamily}
                      options={familyOptions}
                      onOpen={loadSystemFonts}
                      onPick={(value) => {
                        setFontFamily(value);
                        onCommand("font-family", value);
                      }}
                      commit={(text) => {
                        setFontFamily(text);
                        onCommand("font-family", text);
                      }}
                    />

                    <EditableMenuSelect
                      className="select-like font-size"
                      label="Font size"
                      title="字号"
                      value={fontSize}
                      options={[9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36].map((sz) => ({
                        value: String(sz),
                        label: String(sz),
                      }))}
                      onPick={(value) => {
                        setFontSize(value);
                        onCommand("font-size", Number(value));
                      }}
                      commit={(text) => {
                        const size = Number(text.replace(",", "."));
                        if (Number.isFinite(size) && size >= 1 && size <= 409) {
                          setFontSize(String(size));
                          onCommand("font-size", size);
                        }
                      }}
                    />

                    <button
                      title="增大字号"
                      onClick={() => {
                        const next = Number(fontSize) + 1;
                        setFontSize(String(next));
                        onCommand("font-size", next);
                      }}
                    >
                      <ToolSymbol symbol="A↑" />
                    </button>
                    <button
                      title="减小字号"
                      onClick={() => {
                        const next = Math.max(8, Number(fontSize) - 1);
                        setFontSize(String(next));
                        onCommand("font-size", next);
                      }}
                    >
                      <ToolSymbol symbol="A↓" />
                    </button>
                  </div>

                  <div className="inline-tools">
                    <button
                      className={bold ? "is-active" : ""}
                      title="加粗 (Ctrl+B)"
                      onClick={() => {
                        setBold(!bold);
                        onCommand("bold");
                      }}
                    >
                      <b>B</b>
                    </button>
                    <button
                      className={italic ? "is-active" : ""}
                      title="斜体 (Ctrl+I)"
                      onClick={() => {
                        setItalic(!italic);
                        onCommand("italic");
                      }}
                    >
                      <em>I</em>
                    </button>
                    <button
                      className={underline ? "is-active" : ""}
                      title="下划线 (Ctrl+U)"
                      onClick={() => {
                        setUnderline(!underline);
                        onCommand("underline");
                      }}
                    >
                      <u>U</u>
                    </button>
                    <button
                      title="双下划线"
                      onClick={() => onCommand("underline:double")}
                    >
                      <u style={{ textDecorationStyle: "double" }}>D</u>
                    </button>
                    <button
                      className={strike ? "is-active" : ""}
                      title="删除线"
                      onClick={() => {
                        setStrike(!strike);
                        onCommand("strike");
                      }}
                    >
                      <s>S</s>
                    </button>

                    <label className="color-tool" title="字体颜色">
                      <span className="swatch-letter">
                        A<i style={{ background: fontColor }} />
                      </span>
                      <CaretIcon />
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => {
                          setFontColor(e.target.value);
                          onCommand("font-color", e.target.value);
                        }}
                      />
                    </label>

                    <label className="color-tool" title="填充颜色">
                      <span className="swatch-letter">
                        <ToolSymbol symbol="◧" />
                        <i style={{ background: fillColor }} />
                      </span>
                      <CaretIcon />
                      <input
                        type="color"
                        value={fillColor}
                        onChange={(e) => {
                          setFillColor(e.target.value);
                          onCommand("fill", e.target.value);
                        }}
                      />
                    </label>

                    <MenuSelect
                      className="select-like compact"
                      label="边框"
                      title="边框"
                      display={<><ToolSymbol symbol="⊡" /> 边框</>}
                      options={[
                        { value: "all", label: "田 所有边框" },
                        { value: "outer", label: "外侧边框" },
                        { value: "thick-outer", label: "粗外框" },
                        { value: "top", label: "上边框" },
                        { value: "bottom", label: "下边框" },
                        { value: "left", label: "左边框" },
                        { value: "right", label: "右边框" },
                        { value: "none", label: "无边框" },
                      ]}
                      onPick={(val) => onCommand("border", val, borderColor)}
                    />

                    <label className="color-tool" title="边框颜色">
                      <span className="swatch-letter">
                        <ToolSymbol symbol="⊡" />
                        <i style={{ background: borderColor }} />
                      </span>
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 对齐方式 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="ribbon-rows">
                  <div className="inline-tools alignment-tools">
                    <button title="顶端对齐" onClick={() => onCommand("valign", "top")}>
                      <ToolSymbol symbol="⤒" />
                    </button>
                    <button title="垂直居中" onClick={() => onCommand("valign", "middle")}>
                      <ToolSymbol symbol="↕" />
                    </button>
                    <button title="底端对齐" onClick={() => onCommand("valign", "bottom")}>
                      <ToolSymbol symbol="⤓" />
                    </button>
                    <button title="自动换行" onClick={() => onCommand("wrap")}>
                      <ToolSymbol symbol="↩" />
                    </button>
                    <MenuSelect
                      className="select-like compact"
                      label="文本方向"
                      title="文本方向"
                      display={<ToolSymbol symbol="⤴" />}
                      options={[
                        { value: "45", label: "逆时针旋转 45°" },
                        { value: "-45", label: "顺时针旋转 45°" },
                        { value: "vertical", label: "竖排文本" },
                        { value: "90", label: "向上旋转文本 90°" },
                        { value: "-90", label: "向下旋转文本 -90°" },
                        { value: "0", label: "清除旋转" },
                      ]}
                      onPick={(val) => onCommand(`rotate:${val}`)}
                    />
                  </div>
                  <div className="inline-tools alignment-tools">
                    <button title="左对齐" onClick={() => onCommand("align", "left")}>
                      <ToolSymbol symbol="≡" />
                    </button>
                    <button title="水平居中" onClick={() => onCommand("align", "center")}>
                      <ToolSymbol symbol="≣" />
                    </button>
                    <button title="右对齐" onClick={() => onCommand("align", "right")}>
                      <ToolSymbol symbol="☰" />
                    </button>
                    <MenuSelect
                      className="select-like compact merge-btn"
                      label="合并单元格"
                      title="合并单元格"
                      display={<><ToolSymbol symbol="⇔" /> 合并</>}
                      options={[
                        { value: "center", label: "田 合并并居中" },
                        { value: "across", label: "跨越合并" },
                        { value: "cells", label: "合并单元格" },
                        { value: "unmerge", label: "取消合并" },
                      ]}
                      onPick={(val) => onCommand("merge", val)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 数字 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="ribbon-rows">
                  <MenuSelect
                    className="select-like number-format"
                    label="数字格式"
                    title="数字格式"
                    value={numberFormat}
                    display={
                      [
                        { value: "常规", label: "常规" },
                        { value: "0.00", label: "数字" },
                        { value: "¥#,##0.00", label: "货币 (¥)" },
                        { value: "$#,##0.00", label: "货币 ($)" },
                        { value: "yyyy-mm-dd", label: "短日期" },
                        { value: "0.00%", label: "百分比" },
                        { value: "@", label: "文本" },
                      ].find((opt) => opt.value === numberFormat)?.label ?? numberFormat
                    }
                    options={[
                      { value: "常规", label: "常规" },
                      { value: "0.00", label: "数字" },
                      { value: "¥#,##0.00", label: "货币 (¥)" },
                      { value: "$#,##0.00", label: "货币 ($)" },
                      { value: "yyyy-mm-dd", label: "短日期" },
                      { value: "0.00%", label: "百分比" },
                      { value: "@", label: "文本" },
                    ]}
                    onPick={(val) => {
                      setNumberFormat(val);
                      onCommand("format", val);
                    }}
                  />

                  <div className="inline-tools">
                    <button title="货币格式" onClick={() => onCommand("format", "$#,##0.00")}>
                      $
                    </button>
                    <button title="百分比" onClick={() => onCommand("format", "0.00%")}>
                      %
                    </button>
                    <button title="千位分隔符" onClick={() => onCommand("format", "#,##0")}>
                      ,
                    </button>
                    <button title="增加小数位数" onClick={() => onCommand("decimal-inc")}>
                      .0+
                    </button>
                    <button title="减少小数位数" onClick={() => onCommand("decimal-dec")}>
                      .0−
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. 样式 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="styles-stack">
                  <button
                    className="styles-row as-button"
                    onClick={() => onCommand("cf-open")}
                    title="条件格式"
                  >
                    <ToolSymbol symbol="▤" />
                    <span>条件格式</span>
                    <CaretIcon />
                  </button>
                  <div className="styles-row as-button" title="套用表格格式" style={{ position: "relative" }}>
                    <ToolSymbol symbol="▦" />
                    <span>套用表格格式</span>
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="套用表格格式"
                      options={[
                        { value: "TableStyleLight1", label: "浅色样式 1" },
                        { value: "TableStyleLight9", label: "浅色样式 9" },
                        { value: "TableStyleMedium2", label: "中度深浅 2" },
                        { value: "TableStyleMedium4", label: "中度深浅 4" },
                        { value: "TableStyleMedium7", label: "中度深浅 7" },
                        { value: "TableStyleDark2", label: "深色样式 2" },
                      ]}
                      onPick={(val) => onCommand(`format-as-table:${val}`)}
                    />
                  </div>
                  <div className="styles-row as-button" title="单元格样式" style={{ position: "relative" }}>
                    <ToolSymbol symbol="🎨" />
                    <span>单元格样式</span>
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="单元格样式"
                      options={[
                        { value: "good", label: "好 (Good)" },
                        { value: "bad", label: "差 (Bad)" },
                        { value: "neutral", label: "适中 (Neutral)" },
                        { value: "input", label: "输入 (Input)" },
                        { value: "output", label: "输出 (Output)" },
                        { value: "calculation", label: "计算 (Calculation)" },
                        { value: "warning-text", label: "警告文本 (Warning)" },
                        { value: "title", label: "标题 (Title)" },
                        { value: "heading-1", label: "标题 1 (Heading 1)" },
                        { value: "heading-2", label: "标题 2 (Heading 2)" },
                        { value: "total", label: "汇总 (Total)" },
                        { value: "accent1-20", label: "20% - 强调文字颜色 1" },
                        { value: "accent1-40", label: "40% - 强调文字颜色 1" },
                        { value: "accent1", label: "强调文字颜色 1" },
                      ]}
                      onPick={(val) => onCommand(`cell-style:${val}`)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 7. 单元格 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="ribbon-rows">
                  <button
                    className="styles-row as-button"
                    onClick={() => onCommand("format-cells")}
                    title="设置单元格格式 (Ctrl+1)"
                  >
                    <ToolSymbol symbol="🎨" />
                    <span>设置单元格格式 Ctrl+1</span>
                    <CaretIcon />
                  </button>
                  <div className="inline-tools cell-tools">
                    <button
                      className="labeled"
                      title="插入行"
                      onClick={() => onCommand("insert-row-here")}
                    >
                      <ToolSymbol symbol="⤒" /> 插入 ▾
                    </button>
                    <button
                      className="labeled"
                      title="删除行"
                      onClick={() => onCommand("delete-row-here")}
                    >
                      <ToolSymbol symbol="⤓" /> 删除 ▾
                    </button>
                    <button
                      className="labeled"
                      title="插入列"
                      onClick={() => onCommand("insert-col-here")}
                    >
                      <ToolSymbol symbol="⇤" />
                    </button>
                    <button
                      className="labeled"
                      title="删除列"
                      onClick={() => onCommand("delete-col-here")}
                    >
                      <ToolSymbol symbol="⇥" />
                    </button>
                    <MenuSelect
                      className="select-like compact"
                      label="格式"
                      title="格式 (Format)"
                      display={<><ToolSymbol symbol="⇳" /> 格式</>}
                      options={[
                        { value: "row-height-open", label: "行高..." },
                        { value: "col-width-open", label: "列宽..." },
                      ]}
                      onPick={(val) => onCommand(val)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 8. 编辑 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="ribbon-rows">
                  <div className="inline-tools">
                    <MenuSelect
                      className="select-like compact"
                      label="填充"
                      title="填充 (Fill)"
                      display={<><ToolSymbol symbol="↓" /> 填充</>}
                      options={[
                        { value: "fill-down", label: "向下填充" },
                        { value: "fill-right", label: "向右填充" },
                      ]}
                      onPick={(val) => onCommand(val)}
                    />
                    <MenuSelect
                      className="select-like compact"
                      label="清除"
                      title="清除 (Clear)"
                      display={<><ToolSymbol symbol="⌫" /> 清除</>}
                      options={[
                        { value: "clear-all", label: "全部清除" },
                        { value: "clear-formats", label: "清除格式" },
                        { value: "clear-contents", label: "清除内容" },
                      ]}
                      onPick={(val) => onCommand(val)}
                    />
                  </div>
                  <div className="inline-tools">
                    <button
                      className="labeled"
                      title="查找 (Ctrl+F)"
                      onClick={() => onCommand("find")}
                    >
                      <ToolSymbol symbol="🔍" /> 查找 ▾
                    </button>
                    <button
                      className="labeled"
                      title="替换 (Ctrl+H)"
                      onClick={() => onCommand("replace")}
                    >
                      <ToolSymbol symbol="⇄" /> 替换 ▾
                    </button>
                    <button
                      className="labeled"
                      title="定位 (Ctrl+G)"
                      onClick={() => onCommand("goto-open")}
                    >
                      <ToolSymbol symbol="🎯" /> 定位
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 2. 插入 (Insert)                                           */}
        {/* ========================================================= */}
        {activeTab === "插入" && (
          <>
            {/* 1. 表格 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="数据透视表：来自所选内容汇总"
                  onClick={() => onCommand("pivot-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⊞" />
                  </span>
                  <span>
                    <strong>数据透视表</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="编辑透视表：更改字段设置"
                  onClick={() => onCommand("pivot-edit")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⊞" />
                  </span>
                  <span>
                    <strong>编辑透视表</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="表格：创建正式 Excel 表格"
                  onClick={() => onCommand("format-as-table")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="▦" />
                  </span>
                  <span>
                    <strong>表格</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 插图 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="图片：插入本地图片 (常见图片格式)"
                  onClick={() => onCommand("insert-picture")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🖼" />
                  </span>
                  <span>
                    <strong>图片</strong>
                  </span>
                </button>
                <div className="row-stack">
                  <span className="styles-row" title="插入图形形状" style={{ position: "relative" }}>
                    <ToolSymbol symbol="◇" />
                    形状
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="形状"
                      options={[
                        { value: "rect", label: "矩形" },
                        { value: "roundRect", label: "圆角矩形" },
                        { value: "ellipse", label: "椭圆 / 圆形" },
                        { value: "triangle", label: "三角形" },
                        { value: "rightArrow", label: "右向箭头" },
                      ]}
                      onPick={(val) => onCommand(`insert-shape:${val}`)}
                    />
                  </span>
                  <button
                    className="styles-row as-button"
                    title="插入专业图标"
                    onClick={() => onCommand("insert-icons")}
                  >
                    <ToolSymbol symbol="✧" />
                    图标
                  </button>
                  <button
                    className="styles-row as-button"
                    title="屏幕截图"
                    onClick={() => onCommand("insert-screenshot")}
                  >
                    <ToolSymbol symbol="⧉" />
                    屏幕截图
                  </button>
                </div>
              </div>
            </div>

            {/* 3. 复选框 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="复选框：在所选单元格插入交互复选框"
                  onClick={() => onCommand("insert-checkbox")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="☑" />
                  </span>
                  <span>
                    <strong>复选框</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 4. 图表 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="推荐的图表：来自所选内容推荐"
                  onClick={() => onCommand("recommended-charts-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>推荐的图表</strong>
                  </span>
                </button>
                <div className="chart-grid">
                  <button title="柱形图" onClick={() => onCommand("insert-chart:column")}>
                    <ToolSymbol symbol="▮▬" />
                  </button>
                  <button title="条形图" onClick={() => onCommand("insert-chart:bar")}>
                    <ToolSymbol symbol="▤" />
                  </button>
                  <button title="折线图" onClick={() => onCommand("insert-chart:line")}>
                    <ToolSymbol symbol="📈" />
                  </button>
                  <button title="面积图" onClick={() => onCommand("insert-chart:area")}>
                    <ToolSymbol symbol="◪" />
                  </button>
                  <button title="饼图" onClick={() => onCommand("insert-chart:pie")}>
                    <ToolSymbol symbol="◔" />
                  </button>
                  <button title="散点图" onClick={() => onCommand("insert-chart:scatter")}>
                    <ToolSymbol symbol="∴" />
                  </button>
                  <button title="雷达图" onClick={() => onCommand("insert-chart:radar")}>
                    <ToolSymbol symbol="✳" />
                  </button>
                  <button title="圆环图" onClick={() => onCommand("insert-chart:doughnut")}>
                    <ToolSymbol symbol="◍" />
                  </button>
                  <button title="组合图" onClick={() => onCommand("insert-chart:combo")}>
                    <ToolSymbol symbol="𝄜" />
                  </button>
                </div>
                <LargeMenu
                  label="数据透视图"
                  symbol="🗠"
                  title="插入关联数据透视图"
                  options={[
                    { value: "insert-pivot-chart:column", label: "柱形透视图" },
                    { value: "insert-pivot-chart:bar", label: "条形透视图" },
                    { value: "insert-pivot-chart:line", label: "折线透视图" },
                    { value: "insert-pivot-chart:pie", label: "饼图透视图" },
                    { value: "insert-pivot-chart:doughnut", label: "圆环透视图" },
                    { value: "insert-pivot-chart:radar", label: "雷达透视图" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 5. 迷你图 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="迷你图"
                  symbol="〜"
                  title="单元格嵌入式微图表"
                  options={[
                    { value: "sparkline:line", label: "折线图" },
                    { value: "sparkline:column", label: "柱形图" },
                    { value: "sparkline:stacked", label: "盈亏图" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 6. 筛选器 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="插入切片器以直观筛选数据"
                    onClick={() => onCommand("slicer-open")}
                  >
                    <ToolSymbol symbol="▥" />
                    切片器
                  </button>
                  <button
                    className="styles-row as-button"
                    title="插入日程表筛选日期范围"
                    onClick={() => onCommand("timeline-open")}
                  >
                    <ToolSymbol symbol="🕒" />
                    日程表
                  </button>
                </div>
              </div>
            </div>

            {/* 7. 链接 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="链接：在所选单元格创建超链接"
                  onClick={() => onCommand("link-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🔗" />
                  </span>
                  <span>
                    <strong>链接</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 8. 批注 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="新建批注：在所选单元格添加批注"
                  onClick={() => onCommand("note-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗨" />
                  </span>
                  <span>
                    <strong>新建批注</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 9. 文本 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="文本框：在所选区域绘制文本框"
                  onClick={() => onCommand("insert-textbox")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="A" />
                  </span>
                  <span>
                    <strong>文本框</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="页眉和页脚：设置打印页面页眉与页脚"
                  onClick={() => onCommand("header-footer-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗎" />
                  </span>
                  <span>
                    <strong>页眉和页脚</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 10. 符号 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="插入数学公式"
                    onClick={() => onCommand("insert-equation")}
                  >
                    <ToolSymbol symbol="π" />
                    公式
                  </button>
                  <button
                    className="styles-row as-button"
                    title="插入特殊符号与字符"
                    onClick={() => onCommand("insert-symbol")}
                  >
                    <ToolSymbol symbol="Ω" />
                    符号
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 3. 页面布局 (Page Layout)                                 */}
        {/* ========================================================= */}
        {activeTab === "页面布局" && (
          <>
            {/* 1. 主题 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="主题"
                  symbol="🎨"
                  title="更改文档整体外观设计"
                  options={[
                    { value: "page-layout:theme:office", label: "Office 默认" },
                    { value: "page-layout:theme:blue", label: "浅蓝 (Facet)" },
                    { value: "page-layout:theme:integral", label: "基础 (Integral)" },
                    { value: "page-layout:theme:ion", label: "灵感 (Ion)" },
                    { value: "page-layout:theme:organic", label: "纸张 (Organic)" },
                    { value: "page-layout:theme:retrospect", label: "离子 (Retrospect)" },
                    { value: "page-layout:theme:slice", label: "探索 (Slice)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <div className="row-stack">
                  <span className="styles-row" title="更改主题配色方案" style={{ position: "relative" }}>
                    <ToolSymbol symbol="▤" />
                    颜色
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="颜色方案"
                      options={[
                        { value: "office", label: "Office 方案" },
                        { value: "grayscale", label: "灰度方案" },
                        { value: "bluegreen", label: "蓝绿方案" },
                        { value: "warm", label: "浅红暖色" },
                      ]}
                      onPick={(val) => onCommand(`page-layout:theme-colors:${val}`)}
                    />
                  </span>
                  <span className="styles-row" title="更改主题字体方案" style={{ position: "relative" }}>
                    <ToolSymbol symbol="A" />
                    字体
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="字体方案"
                      options={[
                        { value: "office", label: "Office 经典" },
                        { value: "calibri", label: "Calibri 系列" },
                        { value: "aptos", label: "Aptos 现代" },
                        { value: "arial", label: "Arial 系列" },
                      ]}
                      onPick={(val) => onCommand(`page-layout:theme-fonts:${val}`)}
                    />
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 页面设置 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="页边距"
                  symbol="⿴"
                  title="设置打印页边距"
                  options={[
                    { value: "page-layout:margins:normal", label: "普通 (Normal)" },
                    { value: "page-layout:margins:wide", label: "宽 (Wide)" },
                    { value: "page-layout:margins:narrow", label: "窄 (Narrow)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="纸张方向"
                  symbol="⤢"
                  title="设置纵向或横向布局"
                  options={[
                    { value: "page-layout:orientation:portrait", label: "纵向 (Portrait)" },
                    { value: "page-layout:orientation:landscape", label: "横向 (Landscape)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="纸张大小"
                  symbol="▭"
                  title="选择纸张规格"
                  options={[
                    { value: "page-layout:paper:9", label: "A4 (210 × 297 毫米)" },
                    { value: "page-layout:paper:8", label: "A3 (297 × 420 毫米)" },
                    { value: "page-layout:paper:11", label: "A5 (148 × 210 毫米)" },
                    { value: "page-layout:paper:1", label: "Letter (8.5 × 11 英寸)" },
                    { value: "page-layout:paper:5", label: "Legal (8.5 × 14 英寸)" },
                    { value: "page-layout:paper:3", label: "Tabloid (11 × 17 英寸)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="打印区域"
                  symbol="⬚"
                  title="设置或清除打印区域"
                  options={[
                    { value: "page-layout:print-area:set", label: "设置打印区域" },
                    { value: "page-layout:print-area:clear", label: "清除打印区域" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="分页符"
                  symbol="┆"
                  title="插入或调整分页符"
                  options={[
                    { value: "page-layout:breaks:insert", label: "插入分页符" },
                    { value: "page-layout:breaks:remove", label: "删除分页符" },
                    { value: "page-layout:breaks:reset", label: "重置所有分页符" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="打印标题"
                  symbol="▤"
                  title="指定在每一页重复出现的行列"
                  options={[
                    { value: "page-layout:print-titles:first-row", label: "顶端标题行 (重复首行)" },
                    { value: "page-layout:print-titles:selection", label: "左端标题列 (重复选定列)" },
                    { value: "page-layout:print-titles:clear", label: "清除打印标题" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 3. 调整为合适大小 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="row-stack">
                  <label className="styles-row" title="宽度缩放">
                    <ToolSymbol symbol="↔" />
                    宽度:
                    <MenuSelect
                      className="select-like compact"
                      label="宽度缩放"
                      value="0"
                      display="自动"
                      options={[
                        { value: "0", label: "自动" },
                        { value: "1", label: "1 页" },
                        { value: "2", label: "2 页" },
                        { value: "3", label: "3 页" },
                      ]}
                      onPick={(val) => onCommand(`page-layout:fit-width:${val}`)}
                    />
                  </label>
                  <label className="styles-row" title="高度缩放">
                    <ToolSymbol symbol="↕" />
                    高度:
                    <MenuSelect
                      className="select-like compact"
                      label="高度缩放"
                      value="0"
                      display="自动"
                      options={[
                        { value: "0", label: "自动" },
                        { value: "1", label: "1 页" },
                        { value: "2", label: "2 页" },
                        { value: "3", label: "3 页" },
                      ]}
                      onPick={(val) => onCommand(`page-layout:fit-height:${val}`)}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 4. 工作表选项 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="check-column">
                  <span className="check-head">网格线</span>
                  <button
                    className="check-item"
                    title="在屏幕上查看网格线"
                    onClick={() => onCommand("toggle-gridlines")}
                  >
                    <i className="check-box">{showGridlines ? "✓" : ""}</i>
                    查看
                  </button>
                  <button
                    className="check-item"
                    title="在打印输出中包含网格线"
                    onClick={() => onCommand(`page-layout:print-gridlines:${printGridlines ? "0" : "1"}`)}
                  >
                    <i className="check-box">{printGridlines ? "✓" : ""}</i>
                    打印
                  </button>
                </div>
                <div className="check-column">
                  <span className="check-head">标题</span>
                  <button
                    className="check-item"
                    title="在屏幕上查看行列标号"
                    onClick={() => onCommand("toggle-headings")}
                  >
                    <i className="check-box">{showHeadings ? "✓" : ""}</i>
                    查看
                  </button>
                  <button
                    className="check-item"
                    title="在打印输出中包含行号列标"
                    onClick={() => onCommand(`page-layout:print-headings:${printHeadings ? "0" : "1"}`)}
                  >
                    <i className="check-box">{printHeadings ? "✓" : ""}</i>
                    打印
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 4. 公式 (Formulas)                                         */}
        {/* ========================================================= */}
        {activeTab === "公式" && (
          <>
            {/* 1. 函数库 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="插入函数：浏览函数目录"
                  onClick={() => onCommand("insert-function-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="ƒx" />
                  </span>
                  <span>
                    <strong>插入函数</strong>
                  </span>
                </button>
                <LargeMenu
                  label="自动求和"
                  symbol="Σ"
                  title="快速计算所选单元格的常见汇总函数"
                  options={[
                    { value: "autofn:SUM", label: "求和 (SUM)" },
                    { value: "autofn:AVERAGE", label: "平均值 (AVERAGE)" },
                    { value: "autofn:COUNT", label: "计数 (COUNT)" },
                    { value: "autofn:MAX", label: "最大值 (MAX)" },
                    { value: "autofn:MIN", label: "最小值 (MIN)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <button
                  className="ribbon-tool as-button large"
                  title="最近使用的函数：常用函数"
                  onClick={() => onCommand("insert-function-open:Common")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🕘" />
                  </span>
                  <span>
                    <strong>最近使用</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="财务函数：计算投资、折旧与现金流"
                  onClick={() => onCommand("insert-function-open:Financial")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="$" />
                  </span>
                  <span>
                    <strong>财务</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="逻辑函数：AND、OR、IF 等条件判断"
                  onClick={() => onCommand("insert-function-open:Logical")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="?" />
                  </span>
                  <span>
                    <strong>逻辑</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="文本函数：字符串处理与拼接"
                  onClick={() => onCommand("insert-function-open:Text")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="A" />
                  </span>
                  <span>
                    <strong>文本</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="日期与时间函数：日期计算与时钟处理"
                  onClick={() => onCommand("insert-function-open:Date & Time")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🕐" />
                  </span>
                  <span>
                    <strong>日期与时间</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="查找与引用函数：VLOOKUP、XLOOKUP、MATCH 等"
                  onClick={() => onCommand("insert-function-open:Lookup")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🔍" />
                  </span>
                  <span>
                    <strong>查找与引用</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="数学和三角函数：代数几何运算"
                  onClick={() => onCommand("insert-function-open:Math")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="θ" />
                  </span>
                  <span>
                    <strong>数学与三角</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="其它函数：全部函数目录"
                  onClick={() => onCommand("insert-function-open:All")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⋯" />
                  </span>
                  <span>
                    <strong>其它函数</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 已定义名称 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="名称管理器：定义与管理单元格及区域名称"
                  onClick={() => onCommand("name-manager-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🏷" />
                  </span>
                  <span>
                    <strong>名称管理器</strong>
                  </span>
                </button>
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="为所选单元格定义名称"
                    onClick={() => onCommand("name-manager-open")}
                  >
                    <ToolSymbol symbol="🏷" />
                    定义名称
                  </button>
                  <span className="styles-row" title="在当前公式中使用名称" style={{ position: "relative" }}>
                    <ToolSymbol symbol="ƒ" />
                    用于公式
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="用于公式"
                      options={
                        definedNames.length > 0
                          ? definedNames.map((n) => ({ value: `use-in-formula:${n}`, label: n }))
                          : [{ value: "name-manager-open", label: "暂无已定义名称" }]
                      }
                      onPick={(cmd) => onCommand(cmd)}
                    />
                  </span>
                  <span className="styles-row" title="从所选内容快速创建名称" style={{ position: "relative" }}>
                    <ToolSymbol symbol="⊞" />
                    根据所选内容创建
                    <CaretIcon />
                    <MenuSelect
                      cover
                      label="从所选内容创建"
                      options={[
                        { value: "create-names:top", label: "首行作为名称" },
                        { value: "create-names:left", label: "最左列作为名称" },
                      ]}
                      onPick={(cmd) => onCommand(cmd)}
                    />
                  </span>
                </div>
              </div>
            </div>

            {/* 3. 公式审核 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="追踪引用单元格"
                    onClick={() => onCommand("trace-precedents")}
                  >
                    <ToolSymbol symbol="⇢" />
                    追踪引用
                  </button>
                  <button
                    className="styles-row as-button"
                    title="追踪从属单元格"
                    onClick={() => onCommand("trace-dependents")}
                  >
                    <ToolSymbol symbol="⇠" />
                    追踪从属
                  </button>
                  <button
                    className="styles-row as-button"
                    title="移去追踪箭头"
                    onClick={() => onCommand("remove-arrows")}
                  >
                    <ToolSymbol symbol="⌫" />
                    移去箭头
                  </button>
                </div>
                <button
                  className="ribbon-tool as-button large"
                  title="显示公式：在单元格中显示公式而非计算结果"
                  onClick={() => onCommand("toggle-show-formulas")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="ƒ" />
                  </span>
                  <span>
                    <strong>显示公式</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="错误检查：查找潜在的公式错误并提供排错建议"
                  onClick={() => onCommand("error-checking")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⚠" />
                  </span>
                  <span>
                    <strong>错误检查</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="监视窗口：打开监视窗口实时监视单元格及其公式变化"
                  onClick={() => onCommand("watch-window")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="👓" />
                  </span>
                  <span>
                    <strong>监视窗口</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 4. 计算 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="计算选项"
                  symbol="🧮"
                  title="控制公式自动计算或手动计算"
                  options={[
                    { value: "calc-mode:auto", label: `自动计算 ${calcManual ? "" : "✓"}` },
                    { value: "calc-mode:manual", label: `手动计算 ${calcManual ? "✓" : ""}` },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="立即重新计算整个工作簿"
                    onClick={() => onCommand("calculate-now")}
                  >
                    <ToolSymbol symbol="⟳" />
                    立即计算
                  </button>
                  <button
                    className="styles-row as-button"
                    title="重新计算当前活动工作表"
                    onClick={() => onCommand("calculate-sheet")}
                  >
                    <ToolSymbol symbol="▦" />
                    计算工作表
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 5. 数据 (Data) - 100% GenOffice Parity                    */}
        {/* ========================================================= */}
        {activeTab === "数据" && (
          <>
            {/* 1. 数据透视表 (Pivot Table) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="数据透视表：汇总分析与动态多维报表"
                  onClick={() => onCommand("pivot-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⊞" />
                  </span>
                  <span>
                    <strong>数据透视表</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="刷新：刷新当前透视表缓存与数据"
                  onClick={() => onCommand("pivot-refresh")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⟳" />
                  </span>
                  <span>
                    <strong>刷新</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 获取数据 (Get Data) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="从文本/CSV：导入外部 CSV/文本数据"
                  onClick={() => onCommand("import-csv")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗎" />
                  </span>
                  <span>
                    <strong>从文本/CSV</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="合并工作簿：整合合并多个工作簿到当前表格"
                  onClick={() => onCommand("merge-workbooks")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⧉" />
                  </span>
                  <span>
                    <strong>合并工作簿</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="全部刷新：刷新当前工作簿所有外部链接及透视表"
                  onClick={() => onCommand("refresh-all")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⟳" />
                  </span>
                  <span>
                    <strong>全部刷新</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 3. 排序和筛选 (Sort & Filter) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="排序"
                  symbol="⇅"
                  title="数据升序、降序或多条件自定义排序"
                  options={[
                    { value: "sort:asc", label: "升序排序 (A 到 Z)" },
                    { value: "sort:desc", label: "降序排序 (Z 到 A)" },
                    { value: "sort-custom-open", label: "自定义排序..." },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <button
                  className="ribbon-tool as-button large"
                  title="筛选：开启或关闭自动筛选，快速过滤数据"
                  onClick={() => onCommand("filter-toggle")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="▽" />
                  </span>
                  <span>
                    <strong>筛选</strong>
                  </span>
                </button>
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="清除筛选条件"
                    onClick={() => onCommand("filter-clear")}
                  >
                    <ToolSymbol symbol="⊘" />
                    清除
                  </button>
                  <button
                    className="styles-row as-button"
                    title="重新应用当前筛选"
                    onClick={() => onCommand("filter-reapply")}
                  >
                    <ToolSymbol symbol="↻" />
                    重新应用
                  </button>
                  <button
                    className="styles-row as-button"
                    title="高级条件筛选"
                    onClick={() => onCommand("filter-advanced")}
                  >
                    <ToolSymbol symbol="▽" />
                    高级
                  </button>
                </div>
              </div>
            </div>

            {/* 4. 数据工具 (Data Tools) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="分列"
                  symbol="⇶"
                  title="文本分列向导：按逗号、空格、分号或制表符拆分"
                  options={[
                    { value: "text-to-columns:1", label: "按制表符分列 (Tab)" },
                    { value: "text-to-columns:2", label: "按分号分列 (;)" },
                    { value: "text-to-columns:4", label: "按逗号分列 (,)" },
                    { value: "text-to-columns:8", label: "按空格分列 (Space)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <button
                  className="ribbon-tool as-button large"
                  title="快速填充 (Flash Fill)：根据样本规律自动填充其余单元格"
                  onClick={() => onCommand("flash-fill")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⚡" />
                  </span>
                  <span>
                    <strong>快速填充</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="删除重复项：查找并删除选区中的重复数据行"
                  onClick={() => onCommand("remove-duplicates-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⧉" />
                  </span>
                  <span>
                    <strong>删除重复项</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="数据验证：限制单元格中允许输入的数据类型或取值范围"
                  onClick={() => onCommand("dv-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="✓" />
                  </span>
                  <span>
                    <strong>数据验证</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="合并计算：汇总多个区域或工作表的数值"
                  onClick={() => onCommand("consolidate-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⊕" />
                  </span>
                  <span>
                    <strong>合并计算</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 5. 预测 (Forecast) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="模拟分析"
                  symbol="❔"
                  title="模拟分析与单变量求解"
                  options={[
                    { value: "goal-seek-open", label: "单变量求解 (Goal Seek)..." },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 6. 分级显示 (Outline) */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="组合"
                  symbol="⊟"
                  title="将连续的行或列组合分级显示"
                  options={[
                    { value: "outline-group:rows", label: "行组合 (Group Rows)" },
                    { value: "outline-group:cols", label: "列组合 (Group Columns)" },
                    { value: "outline-hide-detail", label: "隐藏明细数据" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="取消组合"
                  symbol="⊞"
                  title="取消行或列的分级组合"
                  options={[
                    { value: "outline-ungroup:rows", label: "取消行组合 (Ungroup Rows)" },
                    { value: "outline-ungroup:cols", label: "取消列组合 (Ungroup Columns)" },
                    { value: "outline-show-detail", label: "显示明细数据" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <button
                  className="ribbon-tool as-button large"
                  title="分类汇总：为分组数据快速插入小计与总计行"
                  onClick={() => onCommand("subtotal-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="∑" />
                  </span>
                  <span>
                    <strong>分类汇总</strong>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 6. 审阅 (Review)                                           */}
        {/* ========================================================= */}
        {activeTab === "审阅" && (
          <>
            {/* 1. 校对 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="工作簿统计信息"
                  onClick={() => onCommand("workbook-statistics")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🧮" />
                  </span>
                  <span>
                    <strong>工作簿统计</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 语言 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="翻译"
                  symbol="文"
                  title="使用 AI 翻译所选单元格内容"
                  options={[
                    { value: "translate:英语", label: "翻译为: 英语 (English)" },
                    { value: "translate:简体中文", label: "翻译为: 简体中文" },
                    { value: "translate:日语", label: "翻译为: 日语 (日本語)" },
                    { value: "translate:法语", label: "翻译为: 法语 (Français)" },
                    { value: "translate:德语", label: "翻译为: 德语 (Deutsch)" },
                    { value: "translate:西班牙语", label: "翻译为: 西班牙语 (Español)" },
                    { value: "translate:俄语", label: "翻译为: 俄语 (Русский)" },
                    { value: "translate:韩语", label: "翻译为: 韩语 (한국어)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 3. 批注 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="新建批注：在所选单元格添加新批注"
                  onClick={() => onCommand("note-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗨" />
                  </span>
                  <span>
                    <strong>新建批注</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="删除批注：清除所选批注"
                  onClick={() => onCommand("note-delete")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗑" />
                  </span>
                  <span>
                    <strong>删除批注</strong>
                  </span>
                </button>
                <div className="row-stack">
                  <button
                    className="styles-row as-button"
                    title="上一条批注"
                    onClick={() => onCommand("note-prev")}
                  >
                    <ToolSymbol symbol="←" />
                    上一条
                  </button>
                  <button
                    className="styles-row as-button"
                    title="下一条批注"
                    onClick={() => onCommand("note-next")}
                  >
                    <ToolSymbol symbol="→" />
                    下一条
                  </button>
                  <button
                    className="styles-row as-button"
                    title="显示或隐藏批注"
                    onClick={() => onCommand("note-show-toggle")}
                  >
                    <ToolSymbol symbol="🗨" />
                    显示批注
                  </button>
                </div>
              </div>
            </div>

            {/* 4. 备注 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="备注：添加或编辑单元格备注"
                  onClick={() => onCommand("note-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗨" />
                  </span>
                  <span>
                    <strong>备注</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 5. 保护 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title={sheetProtected ? "撤销工作表保护：解除限制" : "保护工作表：防止他人对当前工作表的数据进行意外更改"}
                  onClick={() => onCommand("sheet-protect")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol={sheetProtected ? "🔓" : "🔒"} />
                  </span>
                  <span>
                    <strong>{sheetProtected ? "撤销工作表保护" : "保护工作表"}</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title={workbookProtected ? "撤销工作簿保护：解除结构锁定" : "保护工作簿：防止他人对工作簿的结构(如添加删除工作表)进行更改"}
                  onClick={() => onCommand("workbook-protect")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol={workbookProtected ? "🔓" : "🔐"} />
                  </span>
                  <span>
                    <strong>{workbookProtected ? "撤销工作簿保护" : "保护工作簿"}</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="允许编辑区域：设置在工作表受保护时仍可编辑的单元格区域"
                  onClick={() => onCommand("allow-edit-ranges-open")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⬚" />
                  </span>
                  <span>
                    <strong>允许编辑区域</strong>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 7. 视图 (View)                                             */}
        {/* ========================================================= */}
        {activeTab === "视图" && (
          <>
            {/* 1. 工作簿视图 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className={`ribbon-tool as-button large ${!pageBreakPreview ? "active" : ""}`}
                  title="普通视图：在普通视图中查看工作表，默认网格模式"
                  onClick={() => {
                    if (pageBreakPreview) onCommand("toggle-page-break-preview");
                  }}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="▦" />
                  </span>
                  <span>
                    <strong>普通视图</strong>
                  </span>
                </button>
                <button
                  className={`ribbon-tool as-button large ${pageBreakPreview ? "active" : ""}`}
                  title="分页预览：查看打印分页位置与分页符"
                  onClick={() => {
                    if (!pageBreakPreview) onCommand("toggle-page-break-preview");
                  }}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="┆" />
                  </span>
                  <span>
                    <strong>分页预览</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 显示 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <div className="check-column">
                  <button
                    className="check-item"
                    title="显示网格线"
                    onClick={() => onCommand("toggle-gridlines")}
                  >
                    <i className="check-box">{showGridlines ? "✓" : ""}</i>
                    网格线
                  </button>
                  <button
                    className="check-item"
                    title="显示公式编辑栏"
                    onClick={() => onCommand("toggle-formula-bar")}
                  >
                    <i className="check-box">{formulaBarVisible ? "✓" : ""}</i>
                    编辑栏
                  </button>
                  <button
                    className="check-item"
                    title="显示行标和列标"
                    onClick={() => onCommand("toggle-headings")}
                  >
                    <i className="check-box">{showHeadings ? "✓" : ""}</i>
                    标题
                  </button>
                  <button
                    className="check-item"
                    title="十字对齐高亮选区"
                    onClick={() => onCommand("toggle-cross-highlight")}
                  >
                    <i className="check-box">{crossHighlightVisible ? "✓" : ""}</i>
                    十字高亮
                  </button>
                </div>
              </div>
            </div>

            {/* 3. 显示比例 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="显示比例"
                  symbol="🔍"
                  title="缩放工作表显示比例"
                  options={[
                    { value: "zoom:50", label: "50%" },
                    { value: "zoom:75", label: "75%" },
                    { value: "zoom:100", label: "100%" },
                    { value: "zoom:125", label: "125%" },
                    { value: "zoom:150", label: "150%" },
                    { value: "zoom:200", label: "200%" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <button
                  className="ribbon-tool as-button large"
                  title="100%：重置缩放到 100% 实际大小"
                  onClick={() => onCommand("zoom:100")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⊙" />
                  </span>
                  <span>
                    <strong>100%</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="选区缩放：缩放视图以适应当前所选区域"
                  onClick={() => onCommand("zoom-to-selection")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⌖" />
                  </span>
                  <span>
                    <strong>选区缩放</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 4. 窗口 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="冻结窗格"
                  symbol="❄"
                  title="锁定工作表的一部分以便在滚动时保持可见"
                  options={[
                    { value: "freeze-here", label: "冻结拆分单元格" },
                    { value: "freeze-top-row", label: "冻结首行" },
                    { value: "freeze-first-col", label: "冻结首列" },
                    { value: "unfreeze", label: "取消冻结窗格" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* 8. 图表设计 (Chart Design - Contextual)                    */}
        {/* ========================================================= */}
        {activeTab === "图表设计" && (
          <>
            {/* 1. 图表布局 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <LargeMenu
                  label="添加图表元素"
                  symbol="📊"
                  title="添加标题、坐标轴、数据标签或图例"
                  options={[
                    { value: "chart-element-title", label: "图表标题" },
                    { value: "chart-element-axis-cat", label: "横坐标轴标题" },
                    { value: "chart-element-axis-val", label: "纵坐标轴标题" },
                    { value: "chart-labels:value", label: "数据标签 (数值)" },
                    { value: "chart-labels:none", label: "无数据标签" },
                    { value: "chart-legend:right", label: "图例: 靠右" },
                    { value: "chart-legend:top", label: "图例: 靠上" },
                    { value: "chart-legend:bottom", label: "图例: 靠下" },
                    { value: "chart-legend:left", label: "图例: 靠左" },
                    { value: "chart-legend:none", label: "无图例" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="快速布局"
                  symbol="▦"
                  title="切换图例与标签的快速布局预设"
                  options={[
                    { value: "chart-layout:1", label: "布局 1 (右侧图例 + 数据标签)" },
                    { value: "chart-layout:2", label: "布局 2 (顶部图例 + 数据标签)" },
                    { value: "chart-layout:3", label: "布局 3 (底部图例)" },
                    { value: "chart-layout:4", label: "布局 4 (简洁无图例)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
                <LargeMenu
                  label="更改颜色"
                  symbol="🎨"
                  title="更改图表配色方案"
                  options={[
                    { value: "chart-colors:office", label: "Office 调色板" },
                    { value: "chart-colors:blue", label: "蓝调系列" },
                    { value: "chart-colors:green", label: "清新绿意" },
                    { value: "chart-colors:warm", label: "温暖色系" },
                    { value: "chart-colors:gray", label: "高级灰度" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 2. 更改图表类型 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="转换为柱形图"
                  onClick={() => onCommand("chart-type-column")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>柱形图</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="转换为条形图"
                  onClick={() => onCommand("chart-type-bar")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>条形图</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="转换为折线图"
                  onClick={() => onCommand("chart-type-line")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗠" />
                  </span>
                  <span>
                    <strong>折线图</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="转换为面积图"
                  onClick={() => onCommand("chart-type-area")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗠" />
                  </span>
                  <span>
                    <strong>面积图</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="转换为饼图"
                  onClick={() => onCommand("chart-type-pie")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>饼图</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="转换为圆环图"
                  onClick={() => onCommand("chart-type-doughnut")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>圆环图</strong>
                  </span>
                </button>
                <LargeMenu
                  label="堆叠方式"
                  symbol="▤"
                  title="图表系列堆叠方式"
                  options={[
                    { value: "chart-grouping:clustered", label: "簇状 (Clustered)" },
                    { value: "chart-grouping:stacked", label: "堆叠 (Stacked)" },
                    { value: "chart-grouping:percentStacked", label: "百分比堆叠 (100% Stacked)" },
                  ]}
                  onPick={(cmd) => onCommand(cmd)}
                />
              </div>
            </div>

            {/* 3. 数据 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="选择数据：修改图表的数据源与系列范围"
                  onClick={() => onCommand("chart-select-data")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="📊" />
                  </span>
                  <span>
                    <strong>选择数据</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="切换行/列：切换行与列以改变图表轴与系列"
                  onClick={() => onCommand("chart-switch-row-col")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="⇄" />
                  </span>
                  <span>
                    <strong>切换行/列</strong>
                  </span>
                </button>
                <button
                  className="ribbon-tool as-button large"
                  title="设置格式：打开图表格式设置面板，调整样式与属性"
                  onClick={() => onCommand("chart-format-pane")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🎨" />
                  </span>
                  <span>
                    <strong>设置格式</strong>
                  </span>
                </button>
              </div>
            </div>

            {/* 4. 图表操作 */}
            <div className="ribbon-group">
              <div className="ribbon-group-content">
                <button
                  className="ribbon-tool as-button large"
                  title="删除图表：从当前工作表中移除选中的图表"
                  onClick={() => onCommand("chart-delete")}
                >
                  <span className="tool-icon-row">
                    <ToolSymbol symbol="🗑" />
                  </span>
                  <span>
                    <strong>删除图表</strong>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className="ribbon-nav-btn ribbon-nav-right"
            title="向右滚动功能区"
            aria-label="向右滚动"
            onClick={handleScrollRight}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
