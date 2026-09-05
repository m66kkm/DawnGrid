import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretIcon } from "./ribbon-icons";

export interface MenuSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  sep?: boolean;
}

export interface MenuSelectProps {
  label: string;
  title?: string;
  className?: string;
  cover?: boolean;
  display?: React.ReactNode;
  value?: string;
  options: readonly MenuSelectOption[];
  onPick: (value: string) => void;
  style?: React.CSSProperties;
}

export function MenuSelect({
  label,
  title,
  className = "",
  cover = false,
  display,
  value = "",
  options,
  onPick,
  style,
}: MenuSelectProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Position calculation and popover toggle
  const toggleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownMinWidth = Math.max(rect.width, 148);

    // Default: anchor below the trigger
    let top = rect.bottom + 3;
    let left = rect.left;

    // Flip leftwards if near right edge
    if (left + dropdownMinWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownMinWidth - 12);
    }

    // Flip upwards if near bottom edge
    if (top + 280 > window.innerHeight - 12) {
      top = Math.max(12, rect.top - 280);
    }

    setCoords({ top, left, minWidth: dropdownMinWidth });
    setOpen(true);
  };

  // Click outside and escape key handling
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      if (dropRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <div
      ref={triggerRef}
      className={`menu-select${cover ? " menu-select-cover" : ""}`}
      style={style}
    >
      <button
        type="button"
        className={cover ? "cover-select" : className}
        title={title || label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {!cover && (
          <>
            <span className="menu-select-value">{display ?? label}</span>
            <CaretIcon />
          </>
        )}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={dropRef}
            className="menu-select-drop"
            role="listbox"
            aria-label={label}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
              zIndex: 99999,
            }}
          >
            {options.map((option) => {
              const isSelected = value !== "" && option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`menu-select-item${isSelected ? " on" : ""}${option.sep ? " sep-above" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onPick(option.value);
                  }}
                >
                  <span className="menu-select-item-label">
                    {option.icon && <span className="menu-select-item-icon">{option.icon}</span>}
                    {option.label}
                  </span>
                  {isSelected && <span className="menu-select-item-check">✓</span>}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export interface EditableMenuSelectProps {
  label: string;
  title?: string;
  className?: string;
  value: string;
  options: readonly { value: string; label: string; sep?: boolean }[];
  onOpen?: () => void;
  onPick: (value: string) => void;
  commit: (text: string) => void;
}

export function EditableMenuSelect({
  label,
  title,
  className = "",
  value,
  options,
  onOpen,
  onPick,
  commit,
}: EditableMenuSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraftState] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null): void => {
    draftRef.current = next;
    setDraftState(next);
  };
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const dropdownMinWidth = Math.max(rect.width, 148);
    let top = rect.bottom + 3;
    let left = rect.left;
    if (left + dropdownMinWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownMinWidth - 12);
    }
    if (top + 280 > window.innerHeight - 12) {
      top = Math.max(12, rect.top - 280);
    }
    setCoords({ top, left, minWidth: dropdownMinWidth });
    if (!open) onOpen?.();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || dropRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      if (dropRef.current?.contains(target) || wrapRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const commitDraft = (): void => {
    const text = draftRef.current?.trim();
    if (text && text !== value) commit(text);
    setDraft(null);
  };

  return (
    <div ref={wrapRef} className="menu-select">
      <span className={`${className} menu-select-edit`} title={title || label}>
        <input
          value={draft ?? value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (
              wrapRef.current?.contains(e.relatedTarget as Node) ||
              dropRef.current?.contains(e.relatedTarget as Node)
            ) {
              return;
            }
            commitDraft();
          }}
        />
        <button
          type="button"
          className="menu-select-caret"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggleOpen}
        >
          <CaretIcon />
        </button>
      </span>

      {open &&
        coords &&
        createPortal(
          <div
            ref={dropRef}
            className="menu-select-drop"
            role="listbox"
            aria-label={label}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
              zIndex: 99999,
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`menu-select-item${isSelected ? " on" : ""}${option.sep ? " sep-above" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setDraft(null);
                    onPick(option.value);
                  }}
                >
                  <span
                    className="menu-select-item-label"
                    style={className.includes("font-name") ? { fontFamily: `"${option.value}", sans-serif` } : undefined}
                  >
                    {option.label}
                  </span>
                  {isSelected && <span className="menu-select-item-check">✓</span>}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
