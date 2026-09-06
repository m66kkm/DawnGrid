import { useState, useMemo, useEffect, useRef } from "react";

import {
  FunctionSpec,
  FUNCTION_CATALOG,
  CATEGORIES,
  normalizeCategory,
} from "./formular";

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
