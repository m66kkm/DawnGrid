import { BooleanNumber, type IStyleData, WrapStrategy } from "@univerjs/core";

export const INDENT_STEP_PX = 8;

export interface SelectionFormat {
  readonly fontFamily: string | null;
  readonly fontSize: number | null;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly wrap: boolean;
  readonly horizontalAlignment: string | null;
  readonly verticalAlignment: string | null;
  readonly textRotation: number | null;
  readonly fontColor: string | null;
  readonly fillColor: string | null;
  readonly numberFormat: string;
  readonly link: string | null;
}

export function normalizeHexColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const value = color.trim();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)) {
    return value.slice(0, 7).toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/.exec(value);
  if (!rgb) return null;
  const hex = rgb
    .slice(1, 4)
    .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`.toUpperCase();
}

const HORIZONTAL_NAMES: Record<number, string> = {
  1: "left",
  2: "center",
  3: "right",
  4: "justify",
  6: "distributed",
};

const VERTICAL_NAMES: Record<number, string> = {
  1: "top",
  2: "center",
  3: "bottom",
};

export function toSelectionFormat(
  style: IStyleData,
  numberFormat: string = "General",
  link: string | null = null,
): SelectionFormat {
  return {
    fontFamily: style.ff ?? null,
    fontSize: style.fs ?? null,
    bold: style.bl === BooleanNumber.TRUE,
    italic: style.it === BooleanNumber.TRUE,
    underline: style.ul?.s === BooleanNumber.TRUE,
    strike: style.st?.s === BooleanNumber.TRUE,
    wrap: style.tb === WrapStrategy.WRAP,
    horizontalAlignment: (style.ht != null && HORIZONTAL_NAMES[style.ht]) || null,
    verticalAlignment: (style.vt != null && VERTICAL_NAMES[style.vt]) || null,
    textRotation: typeof style.tr?.a === "number" ? style.tr.a : null,
    fontColor: normalizeHexColor(style.cl?.rgb ?? null),
    fillColor: normalizeHexColor(style.bg?.rgb ?? null),
    numberFormat: numberFormat || "常规",
    link,
  };
}
