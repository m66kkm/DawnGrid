import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export const DEFAULT_FONT_FAMILIES: readonly string[] = [
  "Aptos",
  "微软雅黑",
  "宋体",
  "黑体",
  "楷体",
  "仿宋",
  "等线",
  "Calibri",
  "Arial",
  "Times New Roman",
  "Segoe UI",
];

export const FONT_LOCAL_NAMES: Record<string, string> = {
  "Microsoft YaHei": "微软雅黑",
  "Microsoft YaHei UI": "微软雅黑 UI",
  "SimSun": "宋体",
  "NSimSun": "新宋体",
  "SimHei": "黑体",
  "KaiTi": "楷体",
  "FangSong": "仿宋",
  "DengXian": "等线",
  "Microsoft JhengHei": "微軟正黑體",
  "Microsoft JhengHei UI": "微軟正黑體 UI",
  "YouYuan": "幼圆",
  "STSong": "华文宋体",
  "STFangsong": "华文仿宋",
  "STKaiti": "华文楷体",
  "STHeiti": "华文黑体",
  "STXihei": "华文细黑",
  "STXingkai": "华文行楷",
  "STXinwei": "华文新魏",
  "STZhongsong": "华文中宋",
  "STLiti": "华文隶书",
  "STHupo": "华文琥珀",
  "STCaiyun": "华文彩云",
  "FZShuTi": "方正舒体",
  "FZYaoti": "方正姚体",
  "LiSu": "隶书",
  "PingFang SC": "苹方",
  "Hiragino Sans GB": "冬青黑体",
};

let cached: readonly string[] | null = null;
let pending: Promise<readonly string[]> | null = null;

async function queryFamilies(): Promise<readonly string[]> {
  const families = new Set<string>();

  // 1. Try Tauri backend (Windows registry font enumeration)
  try {
    const sysFonts = await invoke<string[]>("get_system_fonts");
    if (Array.isArray(sysFonts)) {
      for (const font of sysFonts) {
        if (font) {
          const mapped = FONT_LOCAL_NAMES[font] || font;
          if (!DEFAULT_FONT_FAMILIES.includes(mapped) && !DEFAULT_FONT_FAMILIES.includes(font)) {
            families.add(mapped);
          }
        }
      }
    }
  } catch (e) {
    console.warn("invoke get_system_fonts failed:", e);
  }

  // 2. Try window.queryLocalFonts only as fallback (e.g. pure web environment)
  // to avoid triggering the Chromium permission prompt in desktop app
  if (families.size === 0) {
    const query = (window as { queryLocalFonts?: () => Promise<{ readonly family: string }[]> }).queryLocalFonts;
    if (query) {
      try {
        const fonts = await query.call(window);
        for (const font of fonts) {
          if (font.family) {
            const mapped = FONT_LOCAL_NAMES[font.family] || font.family;
            if (!DEFAULT_FONT_FAMILIES.includes(mapped) && !DEFAULT_FONT_FAMILIES.includes(font.family)) {
              families.add(mapped);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Fallback list of common Windows fonts if nothing was returned
  if (families.size === 0) {
    const fallbackList = [
      "仿宋", "华文仿宋", "华文楷体", "华文宋体", "华文细黑", "华文行楷", "华文新魏", "华文中宋",
      "幼圆", "隶书", "Bahnschrift", "Cambria", "Century Gothic", "Comic Sans MS",
      "Consolas", "Courier New", "Franklin Gothic Medium", "Georgia", "Impact",
      "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype", "Tahoma",
      "Trebuchet MS", "Verdana"
    ];
    for (const f of fallbackList) {
      if (!DEFAULT_FONT_FAMILIES.includes(f)) families.add(f);
    }
  }

  return [...families].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function loadSystemFontFamilies(): Promise<readonly string[]> {
  if (cached) return Promise.resolve(cached);
  pending ??= queryFamilies().then((families) => {
    cached = families;
    return families;
  });
  return pending;
}

export function useSystemFontFamilies(): {
  readonly families: readonly string[];
  readonly load: () => void;
} {
  const [families, setFamilies] = useState<readonly string[]>(cached ?? []);

  const load = useCallback(() => {
    void loadSystemFontFamilies().then(setFamilies);
  }, []);

  useEffect(() => {
    void loadSystemFontFamilies().then(setFamilies);
  }, []);

  return { families, load };
}

export function fontFamilyGroups(
  systemFamilies: readonly string[],
  echoFamily: string | null | undefined
): { readonly common: readonly string[]; readonly system: readonly string[] } {
  const norm = echoFamily ? (FONT_LOCAL_NAMES[echoFamily] || echoFamily) : null;
  const known =
    !norm ||
    DEFAULT_FONT_FAMILIES.includes(norm) ||
    DEFAULT_FONT_FAMILIES.includes(echoFamily!) ||
    systemFamilies.includes(norm) ||
    systemFamilies.includes(echoFamily!);

  return {
    common: known ? DEFAULT_FONT_FAMILIES : [norm!, ...DEFAULT_FONT_FAMILIES],
    system: systemFamilies,
  };
}
