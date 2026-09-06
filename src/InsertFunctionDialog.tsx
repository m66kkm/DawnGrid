import { useState, useMemo, useEffect, useRef } from "react";

export interface FunctionSpec {
  readonly name: string;
  readonly category: string;
  readonly syntax: string;
  readonly desc: string;
  readonly isCommon?: boolean;
}

export const FUNCTION_CATALOG: readonly FunctionSpec[] = [
  // ── Math (数学与三角) ──
  {
    name: "SUM",
    category: "Math",
    syntax: "SUM(number1, [number2], …)",
    desc: "计算区域内所有数值的和。",
    isCommon: true,
  },
  {
    name: "SUMIF",
    category: "Math",
    syntax: "SUMIF(range, criteria, [sum_range])",
    desc: "对满足条件的单元格求和。",
    isCommon: true,
  },
  {
    name: "SUMIFS",
    category: "Math",
    syntax: "SUMIFS(sum_range, criteria_range1, criteria1, …)",
    desc: "对满足多个条件的单元格求和。",
    isCommon: true,
  },
  {
    name: "SUMPRODUCT",
    category: "Math",
    syntax: "SUMPRODUCT(array1, [array2], …)",
    desc: "返回对应数组元素乘积之和。",
  },
  {
    name: "SUBTOTAL",
    category: "Math",
    syntax: "SUBTOTAL(function_num, ref1, …)",
    desc: "返回列表的分类汇总，忽略其他分类汇总（9 = SUM）。",
  },
  {
    name: "ROUND",
    category: "Math",
    syntax: "ROUND(number, num_digits)",
    desc: "按指定位数对数值四舍五入。",
    isCommon: true,
  },
  {
    name: "ROUNDUP",
    category: "Math",
    syntax: "ROUNDUP(number, num_digits)",
    desc: "向绝对值增大的方向舍入数值。",
  },
  {
    name: "ROUNDDOWN",
    category: "Math",
    syntax: "ROUNDDOWN(number, num_digits)",
    desc: "向零的方向舍入数值。",
  },
  {
    name: "ABS",
    category: "Math",
    syntax: "ABS(number)",
    desc: "返回数值的绝对值。",
  },
  {
    name: "INT",
    category: "Math",
    syntax: "INT(number)",
    desc: "将数值向下取整为最接近的整数。",
  },
  {
    name: "MOD",
    category: "Math",
    syntax: "MOD(number, divisor)",
    desc: "返回两数相除的余数。",
  },
  {
    name: "POWER",
    category: "Math",
    syntax: "POWER(number, power)",
    desc: "返回数值的乘幂。",
  },
  {
    name: "SQRT",
    category: "Math",
    syntax: "SQRT(number)",
    desc: "返回正平方根。",
  },
  {
    name: "RAND",
    category: "Math",
    syntax: "RAND()",
    desc: "返回 0 到 1 之间的随机数（会重算）。",
  },
  {
    name: "RANDBETWEEN",
    category: "Math",
    syntax: "RANDBETWEEN(bottom, top)",
    desc: "返回两个值之间的随机整数。",
  },

  // ── Statistical (统计) ──
  {
    name: "AVERAGE",
    category: "Statistical",
    syntax: "AVERAGE(number1, [number2], …)",
    desc: "返回参数的算术平均值。",
    isCommon: true,
  },
  {
    name: "AVERAGEIF",
    category: "Statistical",
    syntax: "AVERAGEIF(range, criteria, [average_range])",
    desc: "返回满足条件的单元格的平均值。",
  },
  {
    name: "AVERAGEIFS",
    category: "Statistical",
    syntax: "AVERAGEIFS(average_range, criteria_range1, criteria1, …)",
    desc: "返回满足多个条件的单元格的平均值。",
  },
  {
    name: "COUNT",
    category: "Statistical",
    syntax: "COUNT(value1, [value2], …)",
    desc: "计算包含数字的单元格个数。",
    isCommon: true,
  },
  {
    name: "COUNTA",
    category: "Statistical",
    syntax: "COUNTA(value1, [value2], …)",
    desc: "计算非空单元格的个数。",
    isCommon: true,
  },
  {
    name: "COUNTIF",
    category: "Statistical",
    syntax: "COUNTIF(range, criteria)",
    desc: "计算满足条件的单元格个数。",
    isCommon: true,
  },
  {
    name: "COUNTIFS",
    category: "Statistical",
    syntax: "COUNTIFS(criteria_range1, criteria1, …)",
    desc: "计算满足多个条件的单元格个数。",
    isCommon: true,
  },
  {
    name: "MIN",
    category: "Statistical",
    syntax: "MIN(number1, [number2], …)",
    desc: "返回参数中的最小值。",
    isCommon: true,
  },
  {
    name: "MAX",
    category: "Statistical",
    syntax: "MAX(number1, [number2], …)",
    desc: "返回参数中的最大值。",
    isCommon: true,
  },
  {
    name: "MEDIAN",
    category: "Statistical",
    syntax: "MEDIAN(number1, [number2], …)",
    desc: "返回给定数值的中值。",
  },
  {
    name: "RANK",
    category: "Statistical",
    syntax: "RANK(number, ref, [order])",
    desc: "返回数值在列表中的排位。",
  },
  {
    name: "LARGE",
    category: "Statistical",
    syntax: "LARGE(array, k)",
    desc: "返回数据集中第 k 个最大值。",
  },
  {
    name: "SMALL",
    category: "Statistical",
    syntax: "SMALL(array, k)",
    desc: "返回数据集中第 k 个最小值。",
  },

  // ── Logical (逻辑) ──
  {
    name: "IF",
    category: "Logical",
    syntax: "IF(logical_test, value_if_true, [value_if_false])",
    desc: "条件为真时返回一个值，否则返回另一个值。",
    isCommon: true,
  },
  {
    name: "IFERROR",
    category: "Logical",
    syntax: "IFERROR(value, value_if_error)",
    desc: "表达式出错时返回备用值。",
    isCommon: true,
  },
  {
    name: "IFS",
    category: "Logical",
    syntax: "IFS(logical_test1, value_if_true1, …)",
    desc: "检查是否满足一个或多个条件并返回与第一个 TRUE 条件对应的值。",
  },
  {
    name: "AND",
    category: "Logical",
    syntax: "AND(logical1, [logical2], …)",
    desc: "所有参数为 TRUE 时返回 TRUE。",
  },
  {
    name: "OR",
    category: "Logical",
    syntax: "OR(logical1, [logical2], …)",
    desc: "任一参数为 TRUE 时返回 TRUE。",
  },
  {
    name: "NOT",
    category: "Logical",
    syntax: "NOT(logical)",
    desc: "对参数的逻辑值求反。",
  },

  // ── Lookup (查找与引用) ──
  {
    name: "VLOOKUP",
    category: "Lookup",
    syntax: "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])",
    desc: "在首列查找值，返回同一行其他列的值。",
    isCommon: true,
  },
  {
    name: "XLOOKUP",
    category: "Lookup",
    syntax: "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode])",
    desc: "在区域或数组中搜索匹配项并返回相应项。",
    isCommon: true,
  },
  {
    name: "HLOOKUP",
    category: "Lookup",
    syntax: "HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])",
    desc: "VLOOKUP 的按行版本。",
  },
  {
    name: "INDEX",
    category: "Lookup",
    syntax: "INDEX(array, row_num, [column_num])",
    desc: "返回区域中指定位置的值。",
    isCommon: true,
  },
  {
    name: "MATCH",
    category: "Lookup",
    syntax: "MATCH(lookup_value, lookup_array, [match_type])",
    desc: "返回值在区域中的位置。",
    isCommon: true,
  },
  {
    name: "CHOOSE",
    category: "Lookup",
    syntax: "CHOOSE(index_num, value1, [value2], …)",
    desc: "按索引从列表中选取值。",
  },

  // ── Text (文本) ──
  {
    name: "CONCATENATE",
    category: "Text",
    syntax: "CONCATENATE(text1, [text2], …)",
    desc: "将多个文本串连接为一个。",
    isCommon: true,
  },
  {
    name: "TEXTJOIN",
    category: "Text",
    syntax: "TEXTJOIN(delimiter, ignore_empty, text1, …)",
    desc: "使用指定分隔符将多个文本串合并为一个。",
  },
  {
    name: "TEXT",
    category: "Text",
    syntax: "TEXT(value, format_text)",
    desc: "按指定格式将数值转为文本。",
  },
  {
    name: "LEFT",
    category: "Text",
    syntax: "LEFT(text, [num_chars])",
    desc: "返回文本串开头的字符。",
  },
  {
    name: "RIGHT",
    category: "Text",
    syntax: "RIGHT(text, [num_chars])",
    desc: "返回文本串末尾的字符。",
  },
  {
    name: "MID",
    category: "Text",
    syntax: "MID(text, start_num, num_chars)",
    desc: "返回文本串中间的字符。",
  },
  {
    name: "LEN",
    category: "Text",
    syntax: "LEN(text)",
    desc: "返回文本串的字符数。",
  },
  {
    name: "TRIM",
    category: "Text",
    syntax: "TRIM(text)",
    desc: "删除文本中多余的空格。",
  },
  {
    name: "UPPER",
    category: "Text",
    syntax: "UPPER(text)",
    desc: "将文本转换为大写。",
  },
  {
    name: "LOWER",
    category: "Text",
    syntax: "LOWER(text)",
    desc: "将文本转换为小写。",
  },
  {
    name: "SUBSTITUTE",
    category: "Text",
    syntax: "SUBSTITUTE(text, old_text, new_text, [instance_num])",
    desc: "替换文本中出现的指定内容。",
  },

  // ── Date & Time (日期和时间) ──
  {
    name: "TODAY",
    category: "Date & Time",
    syntax: "TODAY()",
    desc: "返回当前日期（会重算）。",
    isCommon: true,
  },
  {
    name: "NOW",
    category: "Date & Time",
    syntax: "NOW()",
    desc: "返回当前日期和时间（会重算）。",
    isCommon: true,
  },
  {
    name: "DATE",
    category: "Date & Time",
    syntax: "DATE(year, month, day)",
    desc: "由年、月、日构成日期。",
  },
  {
    name: "YEAR",
    category: "Date & Time",
    syntax: "YEAR(serial_number)",
    desc: "返回日期的年份。",
  },
  {
    name: "MONTH",
    category: "Date & Time",
    syntax: "MONTH(serial_number)",
    desc: "返回日期的月份（1–12）。",
  },
  {
    name: "DAY",
    category: "Date & Time",
    syntax: "DAY(serial_number)",
    desc: "返回日期在当月的天数（1–31）。",
  },
  {
    name: "EDATE",
    category: "Date & Time",
    syntax: "EDATE(start_date, months)",
    desc: "返回某日期之前或之后指定月数的日期。",
  },

  // ── Financial (财务) ──
  {
    name: "PMT",
    category: "Financial",
    syntax: "PMT(rate, nper, pv, [fv], [type])",
    desc: "计算等额还款的每期付款额。",
    isCommon: true,
  },
  {
    name: "FV",
    category: "Financial",
    syntax: "FV(rate, nper, pmt, [pv], [type])",
    desc: "计算投资的未来值。",
  },
  {
    name: "PV",
    category: "Financial",
    syntax: "PV(rate, nper, pmt, [fv], [type])",
    desc: "计算投资的现值。",
  },
  {
    name: "RATE",
    category: "Financial",
    syntax: "RATE(nper, pmt, pv, [fv], [type], [guess])",
    desc: "计算每期利率。",
  },
  {
    name: "NPER",
    category: "Financial",
    syntax: "NPER(rate, pmt, pv, [fv], [type])",
    desc: "计算投资的期数。",
  },
  {
    name: "NPV",
    category: "Financial",
    syntax: "NPV(rate, value1, [value2], …)",
    desc: "按贴现率计算现金流的净现值。",
  },
  {
    name: "IRR",
    category: "Financial",
    syntax: "IRR(values, [guess])",
    desc: "计算一系列现金流的内部收益率。",
  },
];

export const CATEGORIES = [
  { key: "Common", label: "常用" },
  { key: "All", label: "全部" },
  { key: "Math", label: "数学与三角" },
  { key: "Statistical", label: "统计" },
  { key: "Logical", label: "逻辑" },
  { key: "Lookup", label: "查找与引用" },
  { key: "Text", label: "文本" },
  { key: "Date & Time", label: "日期和时间" },
  { key: "Financial", label: "财务" },
] as const;

function normalizeCategory(cat?: string): string {
  if (!cat) return "Common";
  const upper = cat.trim().toUpperCase();
  if (upper === "ALL" || cat === "全部") return "All";
  if (upper === "COMMON" || cat === "常用" || cat === "最近使用") return "Common";
  if (upper === "MATH" || cat.includes("数学")) return "Math";
  if (upper === "STATISTICAL" || cat.includes("统计")) return "Statistical";
  if (upper === "LOGICAL" || cat.includes("逻辑")) return "Logical";
  if (upper === "LOOKUP" || cat.includes("查找")) return "Lookup";
  if (upper === "TEXT" || cat.includes("文本")) return "Text";
  if (upper.includes("DATE") || upper.includes("TIME") || cat.includes("日期")) return "Date & Time";
  if (upper === "FINANCIAL" || cat.includes("财务")) return "Financial";
  return "Common";
}

export interface InsertFunctionDialogProps {
  readonly isOpen: boolean;
  readonly targetLabel?: string;
  readonly initialCategory?: string;
  readonly onClose: () => void;
  readonly onApply?: (formula: string) => string | null;
  readonly onInsert?: (formula: string) => void;
}

export function InsertFunctionDialog({
  isOpen,
  targetLabel = "A1",
  initialCategory,
  onClose,
  onApply,
  onInsert,
}: InsertFunctionDialogProps) {
  const [category, setCategory] = useState<string>(() => normalizeCategory(initialCategory));
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FunctionSpec | null>(null);
  const [formula, setFormula] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initialCategory on dialog open
  useEffect(() => {
    if (isOpen) {
      const normalized = normalizeCategory(initialCategory);
      setCategory(normalized);
      setQuery("");
      setError(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialCategory]);

  // Filter functions by category and search keyword
  const matches = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return FUNCTION_CATALOG.filter((spec) => {
      const matchCat =
        category === "All"
          ? true
          : category === "Common"
          ? !!spec.isCommon
          : spec.category === category;
      const matchQuery =
        needle === "" ||
        spec.name.toUpperCase().includes(needle) ||
        spec.desc.toUpperCase().includes(needle);
      return matchCat && matchQuery;
    });
  }, [category, query]);

  // Auto-pick first match if none picked or picked not in matches
  useEffect(() => {
    if (matches.length > 0) {
      if (!picked || !matches.some((m) => m.name === picked.name)) {
        const first = matches[0];
        setPicked(first);
        setFormula(`=${first.name}(${first.syntax.endsWith("()") ? ")" : ""}`);
      }
    } else {
      setPicked(null);
      setFormula("");
    }
  }, [matches]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pick = (spec: FunctionSpec) => {
    setPicked(spec);
    setFormula(`=${spec.name}(${spec.syntax.endsWith("()") ? ")" : ""}`);
    setError(null);
  };

  const submitFormula = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const finalFormula = trimmed.startsWith("=") ? trimmed : `=${trimmed}`;

    if (onApply) {
      const failure = onApply(finalFormula);
      if (failure) {
        setError(failure);
        return;
      }
    } else if (onInsert) {
      onInsert(finalFormula);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window insert-function-dialog"
        role="dialog"
        aria-label="Insert Function"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{`插入函数 — 目标 ${targetLabel}`}</h3>
          <button className="modal-close-btn" onClick={onClose} title="关闭 (Esc)">
            ✕
          </button>
        </div>

        <div className="dialog-body">
          {/* Top Search and Category Filter Row */}
          <div className="fn-filter-row">
            <input
              ref={searchInputRef}
              className="dialog-input fn-search-input"
              placeholder="搜索函数名或描述…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="dialog-select fn-category-select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setError(null);
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Function List */}
          <div className="fn-list" role="listbox">
            {matches.map((spec) => (
              <button
                key={spec.name}
                type="button"
                className={`fn-row${picked?.name === spec.name ? " active" : ""}`}
                role="option"
                aria-selected={picked?.name === spec.name}
                onClick={() => pick(spec)}
                onDoubleClick={() => {
                  pick(spec);
                  const autoFormula = `=${spec.name}(${spec.syntax.endsWith("()") ? ")" : ""}`;
                  submitFormula(autoFormula);
                }}
              >
                <strong>{spec.name}</strong>
                <span>{spec.desc}</span>
              </button>
            ))}
            {matches.length === 0 && (
              <div className="fn-empty-state">没有找到匹配的函数</div>
            )}
          </div>

          {/* Syntax and Description Card */}
          {picked && (
            <div className="fn-syntax-card">
              <div className="fn-syntax-code">
                <code>{picked.syntax}</code>
              </div>
              <div className="fn-syntax-desc">{picked.desc}</div>
            </div>
          )}

          {/* Formula Editing Input */}
          <label className="fn-formula-group">
            <span className="fn-formula-title">公式</span>
            <input
              className="dialog-input fn-formula-input"
              value={formula}
              placeholder="先选择函数，再补全参数"
              onChange={(e) => {
                setFormula(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitFormula(formula);
                }
              }}
            />
          </label>

          {/* Error Message */}
          {error && (
            <div className="fn-error" role="alert">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="dialog-btn primary"
              disabled={formula.trim() === ""}
              onClick={() => submitFormula(formula)}
            >
              插入函数
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
