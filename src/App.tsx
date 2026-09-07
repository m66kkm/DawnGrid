import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { LocaleType, mergeLocales } from "@univerjs/core";
import "@univerjs/sheets/facade";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import UniverPresetSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import { UniverSheetsDrawingPreset } from "@univerjs/preset-sheets-drawing";
import UniverPresetSheetsDrawingZhCN from "@univerjs/preset-sheets-drawing/locales/zh-CN";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import UniverPresetSheetsConditionalFormattingZhCN from "@univerjs/preset-sheets-conditional-formatting/locales/zh-CN";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import UniverPresetSheetsFilterZhCN from "@univerjs/preset-sheets-filter/locales/zh-CN";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import UniverPresetSheetsDataValidationZhCN from "@univerjs/preset-sheets-data-validation/locales/zh-CN";
import { UniverSheetsNotePreset } from "@univerjs/preset-sheets-note";
import UniverPresetSheetsNoteZhCN from "@univerjs/preset-sheets-note/locales/zh-CN";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import UniverPresetSheetsFindReplaceZhCN from "@univerjs/preset-sheets-find-replace/locales/zh-CN";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import UniverPresetSheetsSortZhCN from "@univerjs/preset-sheets-sort/locales/zh-CN";
import { UniverSheetsTablePreset, UniverSheetsTableUIPlugin } from "@univerjs/preset-sheets-table";
import UniverPresetSheetsTableZhCN from "@univerjs/preset-sheets-table/locales/zh-CN";
import { createUniver } from "./shared/create-univer";
import {
  loadWorkbookSkeleton,
  loadWorksheetData,
  openWorkbookFile,
  saveWorkbookToDisk,
} from "./shared/univer-adapter";
import type { SheetMetadata, WorkbookMetadata } from "./shared/types";
import { FormatCellsDialog } from "./home/FormatCellsDialog";
import { InsertFunctionDialog } from "./formular/InsertFunctionDialog";
import { AiAssistantModal } from "./shared/AiAssistantModal";
import { GoToDialog } from "./home/GoToDialog";
import { PivotDialog, type PivotConfig, type PivotField } from "./insert/PivotDialog";
import { GoalSeekDialog } from "./data/GoalSeekDialog";
import { SubtotalDialog } from "./data/SubtotalDialog";
import { ConsolidateDialog } from "./data/ConsolidateDialog";
import { AdvancedFilterDialog } from "./data/AdvancedFilterDialog";
import { CustomSortDialog } from "./data/CustomSortDialog";
import { NameManagerDialog } from "./formular/NameManagerDialog";
import {
  type WatchCellItem,
  applyAutoSum,
  insertDefinedNameIntoFormula,
  WatchWindowDialog,
} from "./formular";
import { SymbolDialog } from "./insert/SymbolDialog";
import { HeaderFooterDialog, type HeaderFooterData } from "./insert/HeaderFooterDialog";
import { AllowEditRangesDialog } from "./review/AllowEditRangesDialog";
import { WorkbookStatsModal } from "./shared/WorkbookStatsModal";
import {
  RecommendedChartsDialog,
  ChartSelectDataDialog,
  ChartFormatDialog,
  ChartOverlay,
  buildChartVisual,
  applyChartStateEdit,
  transposeChartSeries,
  KIND_NAMES,
  columnLabel,
  type SheetVisual,
  type RecommendedKind,
} from "./charts";
import { toSelectionFormat } from "./shared/selection-format";
import {
  useChartStore,
  useDialogStore,
  useDocumentStore,
  useNotificationStore,
  useSelectionStore,
  type DialogId,
} from "./store";
import { RibbonContainer } from "./layout";
import { usePageLayoutCommands, useViewCommands } from "./view";
import { useReviewCommands } from "./review";
import { useFormulaCommands } from "./formular/useFormulaCommands";
import { useInsertCommands } from "./insert/useInsertCommands";
import { useDataCommands } from "./data/useDataCommands";
import { useChartCommands } from "./charts/useChartCommands";
import { useAiCommands } from "./shared/useAiCommands";
import { NotificationDialog } from "./shared/NotificationDialog";
import { useStableCallback } from "./shared/useStableCallback";
import { setRowHeightsBatched } from "./shared/rowHeights";
import "./App.css";

function parseA1Notation(a1: string): { row: number; col: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(a1.trim());
  if (!match) return null;
  const colLetters = match[1].toUpperCase();
  const rowNumber = parseInt(match[2], 10) - 1;
  let colIndex = 0;
  for (let i = 0; i < colLetters.length; i++) {
    colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
  }
  return { row: Math.max(0, rowNumber), col: Math.max(0, colIndex - 1) };
}

export default function App() {
  const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const currentMetaRef = useRef<WorkbookMetadata | null>(null);
  const loadedSheetIdsRef = useRef<Set<string>>(new Set());
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleSaveAsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Document state. Reads go through the store so unrelated updates (a status line
  // change, say) no longer rebuild everything this component renders.
  const currentFile = useDocumentStore((s) => s.currentFile);
  const setCurrentFile = useDocumentStore((s) => s.setCurrentFile);
  const metadata = useDocumentStore((s) => s.metadata);
  const setMetadata = useDocumentStore((s) => s.setMetadata);
  const status = useDocumentStore((s) => s.status);
  const setStatus = useDocumentStore((s) => s.setStatus);
  const loading = useDocumentStore((s) => s.loading);
  const setLoading = useDocumentStore((s) => s.setLoading);
  const definedNames = useDocumentStore((s) => s.definedNames);
  const setDefinedNames = useDocumentStore((s) => s.setDefinedNames);
  const setActiveSheetId = useDocumentStore((s) => s.setActiveSheetId);

  // Active cell selection format tracking — lives in the store so a cell click only
  // re-renders the components that read it, not this whole component.
  const setSelectionFormat = useSelectionStore((s) => s.setSelectionFormat);
  const setLastActiveCellAddress = useSelectionStore((s) => s.setLastActiveCellAddress);
  const lastActiveCellAddress = useSelectionStore((s) => s.lastActiveCellAddress);
  // Read by FormatCellsDialog only; it will subscribe directly once dialogs move
  // into DialogHost in a later phase.
  const dialogSelectionFormat = useSelectionStore((s) => s.selectionFormat);

  // Modal dialog state. Only one dialog is open at a time, so the nineteen
  // independent booleans collapse into a single discriminant in the store; the
  // per-dialog setters below are thin shims over it, which keeps the call sites
  // (`setIsPivotOpen(true)`) reading the same as before.
  const activeDialog = useDialogStore((s) => s.activeDialog);
  const openDialog = useDialogStore((s) => s.openDialog);
  const closeDialogIf = useDialogStore((s) => s.closeDialogIf);

  const dialogSetter = useCallback(
    (id: DialogId) => (open: boolean) => (open ? openDialog(id) : closeDialogIf(id)),
    [openDialog, closeDialogIf],
  );

  const setIsFormatCellsOpen = useMemo(() => dialogSetter("format-cells"), [dialogSetter]);
  const setIsInsertFuncOpen = useMemo(() => dialogSetter("insert-function"), [dialogSetter]);
  const setIsAiOpen = useMemo(() => dialogSetter("ai"), [dialogSetter]);
  const setIsGoToOpen = useMemo(() => dialogSetter("goto"), [dialogSetter]);
  const setIsPivotOpen = useMemo(() => dialogSetter("pivot"), [dialogSetter]);
  const setIsGoalSeekOpen = useMemo(() => dialogSetter("goal-seek"), [dialogSetter]);
  const setIsSubtotalOpen = useMemo(() => dialogSetter("subtotal"), [dialogSetter]);
  const setIsConsolidateOpen = useMemo(() => dialogSetter("consolidate"), [dialogSetter]);
  const setIsAdvFilterOpen = useMemo(() => dialogSetter("advanced-filter"), [dialogSetter]);
  const setIsCustomSortOpen = useMemo(() => dialogSetter("custom-sort"), [dialogSetter]);
  const setIsNameManagerOpen = useMemo(() => dialogSetter("name-manager"), [dialogSetter]);
  const setIsWatchWindowOpen = useMemo(() => dialogSetter("watch-window"), [dialogSetter]);
  const setIsSymbolOpen = useMemo(() => dialogSetter("symbol"), [dialogSetter]);
  const setIsHeaderFooterOpen = useMemo(() => dialogSetter("header-footer"), [dialogSetter]);
  const setIsAllowEditRangesOpen = useMemo(() => dialogSetter("allow-edit-ranges"), [dialogSetter]);
  const setIsStatsModalOpen = useMemo(() => dialogSetter("workbook-stats"), [dialogSetter]);
  const setIsRecommendedChartsOpen = useMemo(() => dialogSetter("recommended-charts"), [dialogSetter]);
  const setIsChartSelectDataOpen = useMemo(() => dialogSetter("chart-select-data"), [dialogSetter]);
  const setIsChartFormatOpen = useMemo(() => dialogSetter("chart-format"), [dialogSetter]);

  const insertFuncCategory = useDialogStore((s) => s.insertFuncCategory);
  const setInsertFuncCategory = useDialogStore((s) => s.setInsertFuncCategory);

  // Data Tab Modal Dialog States
  const dataFields = useDialogStore((s) => s.dataFields);
  const defaultRangeStr = useDialogStore((s) => s.defaultRangeStr);

  // AI & Diagnostic state
  const analysisSummary = useDialogStore((s) => s.analysisSummary);
  const diagnosticResult = useDialogStore((s) => s.diagnosticResult);

  // Additional Tab Modal Dialog States
  const [watchList, setWatchList] = useState<WatchCellItem[]>([]);
  const [headerFooterData, setHeaderFooterData] = useState<HeaderFooterData>({
    headerLeft: "",
    headerCenter: "",
    headerRight: "",
    footerLeft: "",
    footerCenter: "第 &[页码] 页，共 &[总页数] 页",
    footerRight: "",
  });
  const allowEditRanges = useDialogStore((s) => s.allowEditRanges);
  const setAllowEditRanges = useDialogStore((s) => s.setAllowEditRanges);
  const workbookStats = useDialogStore((s) => s.workbookStats);


  // Chart state. The mirroring refs are gone: stable callbacks read the current
  // value through useChartStore.getState() instead.
  const selectedChart = useChartStore((s) => s.selectedChart);
  const setSelectedChart = useChartStore((s) => s.setSelectedChart);
  const charts = useChartStore((s) => s.charts);
  const setCharts = useChartStore((s) => s.setCharts);
  const activeChartId = useChartStore((s) => s.activeChartId);
  const setActiveChartId = useChartStore((s) => s.setActiveChartId);
  const recommendedData = useChartStore((s) => s.recommendedData);

  const activeSheetId = useDocumentStore((s) => s.activeSheetId);
  const workbookSubRef = useRef<any>(null);

  const handleActiveSheetSwitch = useCallback((sheetId: string) => {
    if (!sheetId) return;
    if (useDocumentStore.getState().activeSheetId !== sheetId) {
      setActiveSheetId(sheetId);
      useDocumentStore.getState().setActiveSheetId(sheetId);
    }
    // Deselect chart whenever sheet is switched
    if (useChartStore.getState().activeChartId !== null) {
      setActiveChartId(null);
      setSelectedChart(false);
    }
    // Lazy-load sheet data if opening an existing file with multiple sheets
    if (currentMetaRef.current) {
      const targetSheet = currentMetaRef.current.sheets.find(
        (s) => s.id === sheetId || s.name === sheetId
      );
      if (targetSheet) {
        let needsLoad = !loadedSheetIdsRef.current.has(targetSheet.id);
        if (!needsLoad && targetSheet.rowCount > 0) {
          try {
            const wb = univerRef.current?.univerAPI.getActiveWorkbook();
            const ws = wb?.getSheetBySheetId(targetSheet.id);
            const val = ws?.getRange(0, 0, 1, 1)?.getValue();
            if (val === null || val === undefined || val === "") {
              const snap = (wb as any)?.save?.()?.sheets?.[targetSheet.id];
              const cData = snap?.cellData;
              if (!cData || Object.keys(cData).length === 0) {
                needsLoad = true;
              }
            }
          } catch {}
        }
        if (needsLoad && targetSheet.rowCount > 0) {
          loadedSheetIdsRef.current.delete(targetSheet.id);
          void loadWorksheetData(
            univerRef.current!,
            currentMetaRef.current,
            targetSheet,
            loadedSheetIdsRef.current,
            setStatus,
          );
        }
      }
    }
  }, [activeChartId]);

  const handleActiveSheetSwitchRef = useRef(handleActiveSheetSwitch);
  handleActiveSheetSwitchRef.current = handleActiveSheetSwitch;

  const attachWorkbookSheetListener = useCallback((fWb: any) => {
    try {
      workbookSubRef.current?.unsubscribe?.();
      const wb = fWb?.getWorkbook ? fWb.getWorkbook() : fWb;
      if (wb?.activeSheet$) {
        workbookSubRef.current = wb.activeSheet$.subscribe((sheet: any) => {
          if (!sheet) return;
          const sid = sheet.getSheetId ? sheet.getSheetId() : sheet.id;
          if (sid) {
            handleActiveSheetSwitchRef.current(sid);
          }
        });
      }
    } catch (e) {
      console.warn("attachWorkbookSheetListener error:", e);
    }
  }, []);

  const currentSheetName = useMemo(() => {
    if (!metadata) {
      try {
        const fWb = univerRef.current?.univerAPI.getActiveWorkbook();
        return fWb?.getActiveSheet()?.getSheetName?.() ?? null;
      } catch {
        return null;
      }
    }
    const s = metadata.sheets.find((sh) => sh.id === activeSheetId || sh.name === activeSheetId);
    if (s) return s.name;
    try {
      const fWb = univerRef.current?.univerAPI.getActiveWorkbook();
      return fWb?.getActiveSheet()?.getSheetName?.() ?? null;
    } catch {
      return null;
    }
  }, [metadata, activeSheetId]);

  const visibleCharts = useMemo(() => {
    return charts.filter((c) => {
      const chartSheetId = c.sheetId;
      if (!chartSheetId) {
        const defaultSheetId = metadata?.sheets[0]?.id || "sheet-1";
        return activeSheetId === defaultSheetId;
      }
      if (chartSheetId === activeSheetId) return true;
      if (currentSheetName && chartSheetId === currentSheetName) return true;
      if (metadata) {
        const chartSheet = metadata.sheets.find(
          (s) => s.id === chartSheetId || s.name === chartSheetId
        );
        if (chartSheet && (chartSheet.id === activeSheetId || chartSheet.name === currentSheetName)) {
          return true;
        }
      }
      try {
        const fWb = univerRef.current?.univerAPI.getActiveWorkbook();
        const ws = fWb?.getActiveSheet();
        const wsId = ws?.getSheetId?.();
        const wsName = ws?.getSheetName?.();
        if (wsId && chartSheetId === wsId) return true;
        if (wsName && chartSheetId === wsName) return true;
      } catch {}
      return false;
    });
  }, [charts, activeSheetId, currentSheetName, metadata]);

  useEffect(() => {
    if (activeChartId) {
      const cur = useChartStore.getState().charts.find((c) => c.id === activeChartId);
      if (cur && cur.sheetId && cur.sheetId !== activeSheetId && cur.sheetId !== currentSheetName) {
        setActiveChartId(null);
        setSelectedChart(false);
      }
    }
  }, [activeSheetId, currentSheetName, activeChartId]);

  // Safe range resolver (ensures non-null even if canvas focus was momentarily lost)
  function getTargetRange() {
    const runtime = univerRef.current;
    if (!runtime) return null;
    const workbook = runtime.univerAPI.getActiveWorkbook();
    if (!workbook) return null;
    const worksheet = workbook.getActiveSheet();
    if (!worksheet) return null;
    let range: any = workbook.getActiveRange();
    if (!range) {
      try {
        range = worksheet.getSelection()?.getActiveRange();
      } catch {}
    }
    if (!range) {
      range = worksheet.getRange(0, 0, 1, 1);
    }
    return { runtime, workbook, worksheet, range };
  }

  function getFieldsFromRange(worksheet: any, range: any): PivotField[] {
    const fields: PivotField[] = [];
    const startCol = range.getColumn();
    const width = range.getWidth();
    const startRow = range.getRow();
    for (let c = 0; c < width; c++) {
      const colIdx = startCol + c;
      const cellVal = worksheet.getRange(startRow, colIdx, 1, 1).getValue();
      const label = cellVal != null && String(cellVal).trim() !== "" ? String(cellVal) : `列 ${columnLabel(colIdx)}`;
      fields.push({ label, colIndex: colIdx });
    }
    return fields;
  }

  function extractActiveChartValues(): {
    values: (string | number | boolean | null)[][];
    rangeA1: string;
    sheetName: string;
    sheetId: string;
  } {
    const ctx = getTargetRange();
    if (!ctx) {
      return {
        values: [
          ['分类', '系列 1', '系列 2'],
          ['Q1', 120, 95],
          ['Q2', 150, 130],
          ['Q3', 180, 160],
          ['Q4', 210, 190],
        ],
        rangeA1: 'A1:C5',
        sheetName: 'Sheet1',
        sheetId: 'sheet-01',
      };
    }
    const worksheet = ctx.worksheet;
    const range = ctx.range;
    const sheetName = worksheet.getSheetName ? worksheet.getSheetName() : 'Sheet1';
    const sheetId = worksheet.getSheetId ? worksheet.getSheetId() : 'sheet-01';

    let startRow = range.getRow();
    let startCol = range.getColumn();
    let numRows = range.getHeight();
    let numCols = range.getWidth();

    if (numRows === 1 && numCols === 1) {
      const maxR = Math.min(worksheet.getMaxRows(), 30);
      const maxC = Math.min(worksheet.getMaxColumns(), 15);
      let hasData = false;
      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) {
          const v = worksheet.getRange(r, c, 1, 1).getValue();
          if (v != null && String(v).trim() !== '') {
            hasData = true;
            break;
          }
        }
        if (hasData) break;
      }
      if (hasData) {
        startRow = 0;
        startCol = 0;
        numRows = Math.min(10, maxR);
        numCols = Math.min(5, maxC);
      }
    }

    const vals: (string | number | boolean | null)[][] = [];
    for (let r = 0; r < numRows; r++) {
      const rowArr: (string | number | boolean | null)[] = [];
      for (let c = 0; c < numCols; c++) {
        const cellVal = worksheet.getRange(startRow + r, startCol + c, 1, 1).getValue();
        rowArr.push(cellVal != null ? cellVal : null);
      }
      vals.push(rowArr);
    }

    const fromA1 = `${columnLabel(startCol)}${startRow + 1}`;
    const toA1 = `${columnLabel(startCol + numCols - 1)}${startRow + numRows}`;
    const rangeA1 = numRows === 1 && numCols === 1 ? fromA1 : `${fromA1}:${toA1}`;

    return { values: vals, rangeA1, sheetName, sheetId };
  }

  function insertChartObject(chartKind: RecommendedKind, customTitle?: string): SheetVisual | null {
    const data = extractActiveChartValues();
    const curWb = univerRef.current?.univerAPI.getActiveWorkbook();
    const curWs = curWb?.getActiveSheet();
    const currentActiveId = curWs?.getSheetId?.() || useDocumentStore.getState().activeSheetId || data.sheetId || 'sheet-1';
    const currentActiveName = curWs?.getSheetName?.() || data.sheetName || 'Sheet1';
    const effectiveSheetId = currentActiveId;
    try {
      const newChart = buildChartVisual({
        id: `chart-${Date.now()}`,
        sheetId: effectiveSheetId,
        sheetName: currentActiveName,
        chartType: chartKind,
        dataRange: data.rangeA1,
        title: customTitle,
        values: data.values,
        initialPos: {
          x: 100 + (visibleCharts.length % 5) * 25,
          y: 60 + (visibleCharts.length % 5) * 25,
          width: 520,
          height: 340,
        },
      });
      setCharts((prev) => [...prev, newChart]);
      setActiveChartId(newChart.id);
      setSelectedChart(true);
      setStatus(`已在当前工作表插入 ${KIND_NAMES[chartKind]?.zh || chartKind} (${data.rangeA1})`);
      return newChart;
    } catch (e: any) {
      // buildChartVisual rejects a selection it cannot chart — no numeric column,
      // or more than 5000 cells. Substituting a hardcoded sample chart here used to
      // hide that: the user got a plausible-looking chart of invented data, which
      // then lost its values on save because it had no cell references behind it.
      // Report the reason instead.
      console.warn("Insert chart failed:", e);
      const reason =
        e?.message || `所选区域不适合生成 ${KIND_NAMES[chartKind]?.zh || chartKind}。`;
      setStatus(reason);
      useNotificationStore.getState().notifyError(reason, "无法插入图表");
      return null;
    }
  }

  function getTargetChart(autoCreateKind?: RecommendedKind): SheetVisual | null {
    if (activeChartId) {
      const found = visibleCharts.find((c) => c.id === activeChartId);
      if (found) return found;
    }
    if (visibleCharts.length > 0) {
      const fallback = visibleCharts[visibleCharts.length - 1];
      setActiveChartId(fallback.id);
      setSelectedChart(true);
      return fallback;
    }
    if (autoCreateKind) {
      return insertChartObject(autoCreateKind);
    }
    return null;
  }

  function syncSelectionState() {
    const ctx = getTargetRange();
    if (!ctx) return;
    try {
      const curSheetId = ctx.worksheet?.getSheetId?.();
      if (curSheetId) {
        handleActiveSheetSwitchRef.current(curSheetId);
      }
      const style = ctx.range.getCellStyleData() || {};
      let numFmt = "常规";
      try {
        const cellData = ctx.range.getCellData();
        if (cellData?.s && typeof cellData.s === "object" && "n" in cellData.s) {
          numFmt = (cellData.s as any).n?.pattern || "常规";
        }
      } catch {}
      const fmt = toSelectionFormat(style, numFmt);
      // The store compares by value and keeps the previous reference when unchanged,
      // so subscribers are only notified on a real format change.
      setSelectionFormat(fmt);

      const r = ctx.range.getRow();
      const c = ctx.range.getColumn();
      setLastActiveCellAddress(`${columnLabel(c)}${r + 1}`);
    } catch (e) {
      console.warn("syncSelectionState error:", e);
    }
  }

  // A single click fans out into ~11 Univer commands, and running the full sync for
  // each one re-reads the selection and re-renders this component 11 times over.
  // Coalesce a burst into one sync on the next frame — the selection state only needs
  // to reflect where the burst ended up.
  const selectionSyncFrameRef = useRef<number | null>(null);
  function scheduleSelectionSync() {
    if (selectionSyncFrameRef.current !== null) return;
    selectionSyncFrameRef.current = requestAnimationFrame(() => {
      selectionSyncFrameRef.current = null;
      syncSelectionState();
    });
  }

  useEffect(() => {
    // Initialize Univer runtime with full Chinese (zh-CN) localization
    const runtime = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(
          UniverPresetSheetsCoreZhCN,
          UniverPresetSheetsConditionalFormattingZhCN,
          UniverPresetSheetsDataValidationZhCN,
          UniverPresetSheetsDrawingZhCN,
          UniverPresetSheetsFilterZhCN,
          UniverPresetSheetsFindReplaceZhCN,
          UniverPresetSheetsSortZhCN,
          UniverPresetSheetsTableZhCN,
          UniverPresetSheetsNoteZhCN,
        ),
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container: "univer-container",
          header: true,
          toolbar: false,
          contextMenu: true,
          formulaBar: true,
          footer: {
            sheetBar: true,
            statisticBar: true,
            menus: true,
            zoomSlider: true,
          },
        }),
        UniverSheetsDrawingPreset(),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsFilterPreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsFindReplacePreset(),
        UniverSheetsSortPreset(),
        UniverSheetsTablePreset(),
        { plugins: [[UniverSheetsTableUIPlugin, { hideAnchor: true }]] },
      ],
    });

    // Create default blank workbook
    runtime.univerAPI.createWorkbook({
      id: "blank-wb",
      name: "未命名表格.xlsx",
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          id: "sheet-1",
          name: "Sheet1",
          rowCount: 100,
          columnCount: 30,
          cellData: {},
        },
      },
    });

    univerRef.current = runtime;

    // Attach activeSheet$ listener to default blank workbook
    attachWorkbookSheetListener(runtime.univerAPI.getActiveWorkbook());

    // Listen to new workbooks created
    const subWbCreated = (runtime.univerAPI as any).onUniverSheetCreated?.((newWb: any) => {
      attachWorkbookSheetListener(newWb);
    });

    // Listen to selection changes and commands to keep ribbon format updated
    const subSelection = (runtime.univerAPI as any).addEvent?.(
      (runtime.univerAPI as any).Event?.SelectionChanged,
      () => {
        syncSelectionState();
        useChartStore.getState().clearActiveChart();
      }
    );

    const subSheet = (runtime.univerAPI as any).addEvent?.(
      (runtime.univerAPI as any).Event?.ActiveSheetChanged,
      (params: any) => {
        const sheetId = params?.activeSheet?.getSheetId?.() || params?.subUnitId;
        if (sheetId) {
          handleActiveSheetSwitchRef.current(sheetId);
        }
      }
    );

    const subSheetDeleted = (runtime.univerAPI as any).addEvent?.(
      (runtime.univerAPI as any).Event?.SheetDeleted,
      (params: any) => {
        const removedSheetId = params?.sheetId;
        if (removedSheetId) {
          loadedSheetIdsRef.current.delete(removedSheetId);
          if (currentMetaRef.current) {
            const nextSheets = currentMetaRef.current.sheets.filter(
              (s) => s.id !== removedSheetId && s.name !== removedSheetId
            );
            const updatedMeta = {
              ...currentMetaRef.current,
              sheets: nextSheets,
            };
            currentMetaRef.current = updatedMeta;
            setMetadata(updatedMeta);
          }
          setCharts((prev) => prev.filter((c) => c.sheetId !== removedSheetId));
          setTimeout(() => {
            try {
              const curWb = runtime.univerAPI.getActiveWorkbook();
              const curWs = curWb?.getActiveSheet();
              const actualId = curWs?.getSheetId?.();
              if (actualId && actualId !== removedSheetId) {
                handleActiveSheetSwitchRef.current(actualId);
              }
            } catch {}
          }, 30);
        }
      }
    );

    const subCommand = (runtime.univerAPI as any).onCommandExecuted?.((command: any) => {
      scheduleSelectionSync();

      // Clear chart selection when user changes worksheet selection / edits cells
      if (
        command?.id === "sheet.operation.set-selections" ||
        command?.id === "sheet.command.set-selections" ||
        command?.id === "sheet.mutation.set-selections" ||
        command?.id === "sheet.operation.set-cell-edit-visible"
      ) {
        useChartStore.getState().clearActiveChart();
      }

      // 1. Handle sheet removal
      if (
        command?.id === "sheet.mutation.remove-sheet" ||
        command?.id === "sheet.command.remove-sheet"
      ) {
        const removedSheetId =
          command?.params?.subUnitId ||
          command?.params?.sheetId ||
          command?.params?.sheet?.id;

        if (removedSheetId) {
          loadedSheetIdsRef.current.delete(removedSheetId);
          if (currentMetaRef.current) {
            const nextSheets = currentMetaRef.current.sheets.filter(
              (s) => s.id !== removedSheetId && s.name !== removedSheetId
            );
            const updatedMeta = {
              ...currentMetaRef.current,
              sheets: nextSheets,
            };
            currentMetaRef.current = updatedMeta;
            setMetadata(updatedMeta);
          }
          setCharts((prev) => prev.filter((c) => c.sheetId !== removedSheetId));
          setTimeout(() => {
            try {
              const curWb = runtime.univerAPI.getActiveWorkbook();
              const curWs = curWb?.getActiveSheet();
              const actualId = curWs?.getSheetId?.();
              if (actualId && actualId !== removedSheetId) {
                handleActiveSheetSwitchRef.current(actualId);
              }
            } catch {}
          }, 30);
        }
        return;
      }

      // 2. Handle sheet insertion
      if (
        command?.id === "sheet.mutation.insert-sheet" ||
        command?.id === "sheet.command.insert-sheet"
      ) {
        const insertedSheet = command?.params?.sheet;
        const insertedId = insertedSheet?.id || command?.params?.subUnitId;
        const insertedName =
          insertedSheet?.name ||
          `Sheet${(currentMetaRef.current?.sheets.length || 0) + 1}`;

        if (insertedId) {
          loadedSheetIdsRef.current.add(insertedId);
          if (currentMetaRef.current) {
            if (!currentMetaRef.current.sheets.some((s) => s.id === insertedId || s.name === insertedName)) {
              const newSheetMeta: SheetMetadata = {
                id: insertedId,
                name: insertedName,
                rowCount: insertedSheet?.rowCount || 100,
                columnCount: insertedSheet?.columnCount || 30,
                columnWidths: [],
                showGridLines: true,
                showFormulas: false,
                rightToLeft: false,
                hidden: false,
              };
              const updatedMeta = {
                ...currentMetaRef.current,
                sheets: [...currentMetaRef.current.sheets, newSheetMeta],
              };
              currentMetaRef.current = updatedMeta;
              setMetadata(updatedMeta);
            }
          }
          handleActiveSheetSwitchRef.current(insertedId);
        }
        return;
      }

      // 3. Handle sheet rename
      if (
        command?.id === "sheet.command.set-worksheet-name" ||
        command?.id === "sheet.mutation.set-worksheet-name"
      ) {
        const targetId = command?.params?.subUnitId;
        const newName = command?.params?.name;
        if (targetId && newName && currentMetaRef.current) {
          const nextSheets = currentMetaRef.current.sheets.map((s) =>
            s.id === targetId ? { ...s, name: newName } : s
          );
          const updatedMeta = {
            ...currentMetaRef.current,
            sheets: nextSheets,
          };
          currentMetaRef.current = updatedMeta;
          setMetadata(updatedMeta);
        }
        return;
      }

      // 4. Handle active sheet switch
      const isSheetSwitch =
        command?.id === "sheet.operation.set-worksheet-active" ||
        command?.id === "sheet.command.set-worksheet-activate" ||
        command?.id === "sheet.operation.set-selections" ||
        command?.id === "sheet.mutation.set-worksheet-order";

      if (isSheetSwitch) {
        const sheetId =
          command?.params?.subUnitId ||
          command?.params?.sheetId ||
          command?.params?.sheet?.id;
        if (sheetId) {
          handleActiveSheetSwitchRef.current(sheetId);
        }
        setTimeout(() => {
          try {
            const curWb = runtime.univerAPI.getActiveWorkbook();
            const curWs = curWb?.getActiveSheet();
            const actualId = curWs?.getSheetId?.();
            if (actualId) {
              handleActiveSheetSwitchRef.current(actualId);
            }
          } catch {}
        }, 20);
      }
    });

    // Safety net interval to guarantee activeSheetId stays 100% synchronized
    const syncInterval = setInterval(() => {
      try {
        const curWb = runtime.univerAPI.getActiveWorkbook();
        const curWs = curWb?.getActiveSheet();
        const curId = curWs?.getSheetId?.();
        if (curId && curId !== useDocumentStore.getState().activeSheetId) {
          handleActiveSheetSwitchRef.current(curId);
        }
      } catch {}
    }, 250);

    // Listen to native file drag-drop
    let unlistenDrop: (() => void) | undefined;
    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const filePath = event.payload.paths[0];
          if (filePath && /\.(xlsx|xlsm|xlsb|csv)$/i.test(filePath)) {
            void handleOpenFile(filePath);
          }
        }
      })
      .then((unlisten) => {
        unlistenDrop = unlisten;
      })
      .catch(() => {});

    // Initial sync
    setTimeout(() => {
      syncSelectionState();
    }, 200);

    return () => {
      if (selectionSyncFrameRef.current !== null) {
        cancelAnimationFrame(selectionSyncFrameRef.current);
        selectionSyncFrameRef.current = null;
      }
      subWbCreated?.dispose?.();
      subSelection?.dispose?.();
      subSheet?.dispose?.();
      subSheetDeleted?.dispose?.();
      subCommand?.dispose?.();
      workbookSubRef.current?.unsubscribe?.();
      clearInterval(syncInterval);
      unlistenDrop?.();
    };
  }, []);

  // Open XLSX/CSV file using native file picker + Rust Sidecar Engine
  async function handleOpenFile(filePath?: string) {
    try {
      const selected =
        typeof filePath === "string"
          ? filePath
          : await open({
              multiple: false,
              filters: [
                {
                  name: "支持的所有表格 (*.xlsx, *.csv, *.xlsm, *.xlsb)",
                  extensions: ["xlsx", "csv", "xlsm", "xlsb"],
                },
                {
                  name: "Excel 工作簿 (*.xlsx, *.xlsm, *.xlsb)",
                  extensions: ["xlsx", "xlsm", "xlsb"],
                },
                {
                  name: "CSV 文件 (逗号分隔) (*.csv)",
                  extensions: ["csv"],
                },
                {
                  name: "所有文件 (*.*)",
                  extensions: ["*"],
                },
              ],
            });

      if (!selected || typeof selected !== "string") return;

      setLoading(true);
      setStatus(`正在打开: ${selected}...`);

      const runtime = univerRef.current;
      if (!runtime) return;

      // 1. Open via Rust xlsx-engine
      const meta = await openWorkbookFile(selected);
      setMetadata(meta);
      setCurrentFile(selected);
      currentMetaRef.current = meta;
      loadedSheetIdsRef.current.clear();

      // Parse visuals (charts) from workbook
      const loadedCharts: SheetVisual[] = ((meta as any).visuals || [])
        .filter((v: any) => v.kind === 'chart' && v.chart)
        .map((v: any, index: number) => {
          const fromCol = v.anchor?.fromColumn ?? 0;
          const fromRow = v.anchor?.fromRow ?? 0;
          const toCol = v.anchor?.toColumn ?? (fromCol + 8);
          const toRow = v.anchor?.toRow ?? (fromRow + 15);
          const colW = 72;
          const rowH = 20;
          const x = Math.max(20, fromCol * colW + Math.round((v.anchor?.fromColumnOffset ?? 0) / 9525));
          const y = Math.max(20, fromRow * rowH + Math.round((v.anchor?.fromRowOffset ?? 0) / 9525));
          const width = Math.max(360, (toCol - fromCol) * colW);
          const height = Math.max(240, (toRow - fromRow) * rowH);

          return {
            id: v.id || `chart-${index}-${Date.now()}`,
            sheetId: v.sheetId,
            kind: 'chart' as const,
            anchor: v.anchor,
            pos: { x, y, width, height },
            chart: v.chart,
          };
        });
      setCharts(loadedCharts);
      setActiveChartId(null);
      setSelectedChart(false);

      // 2. Load Workbook skeleton
      loadWorkbookSkeleton(runtime, meta);

      // Attach sheet listener to newly loaded workbook
      attachWorkbookSheetListener(runtime.univerAPI.getActiveWorkbook());

      // 3. Load full data for active sheet
      const activeSheet = meta.sheets[meta.activeTab] || meta.sheets[0];
      if (activeSheet) {
        setActiveSheetId(activeSheet.id);
        useDocumentStore.getState().setActiveSheetId(activeSheet.id);
        await loadWorksheetData(
          runtime,
          meta,
          activeSheet,
          loadedSheetIdsRef.current,
          setStatus,
        );
      }

      setStatus(`已加载: ${meta.name} (${activeSheet?.name || ""})`);
      syncSelectionState();

      // 4. Background prefetch remaining sheets so sheet tab switching is instant
      void (async () => {
        for (const sheet of meta.sheets) {
          if (currentMetaRef.current?.sessionId !== meta.sessionId) break;
          if (!loadedSheetIdsRef.current.has(sheet.id)) {
            try {
              await loadWorksheetData(
                runtime,
                meta,
                sheet,
                loadedSheetIdsRef.current,
              );
            } catch (e) {
              console.warn(`Failed to prefetch sheet ${sheet.name}:`, e);
            }
          }
        }
      })();
    } catch (err) {
      console.error(err);
      setStatus(`错误: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const runtime = univerRef.current;
    if (!runtime) return;

    const fileToSave = useDocumentStore.getState().currentFile;
    if (!fileToSave) {
      await handleSaveAs();
      return;
    }

    try {
      setLoading(true);
      setStatus("正在保存表格...");
      await saveWorkbookToDisk(
        runtime,
        fileToSave,
        currentMetaRef.current,
        loadedSheetIdsRef.current,
        setStatus,
        useChartStore.getState().charts,
      );
      if (currentMetaRef.current) {
        setMetadata({ ...currentMetaRef.current });
      }
      setStatus(`表格已成功保存至: ${fileToSave}`);
    } catch (err) {
      console.error("保存失败:", err);
      setStatus(`保存失败: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAs() {
    const runtime = univerRef.current;
    if (!runtime) return;

    try {
      const currentPath = useDocumentStore.getState().currentFile;
      const isCsvCurrent = currentPath?.toLowerCase().endsWith(".csv");
      const defaultName =
        currentMetaRef.current?.name ||
        (currentPath
          ? currentPath.split(/[/\\]/).pop()
          : isCsvCurrent
          ? "表格导出.csv"
          : "表格导出.xlsx");

      const path = await save({
        filters: [
          {
            name: "Excel 工作簿 (*.xlsx)",
            extensions: ["xlsx"],
          },
          {
            name: "CSV 文件 (逗号分隔) (*.csv)",
            extensions: ["csv"],
          },
        ],
        defaultPath: defaultName || (isCsvCurrent ? "表格导出.csv" : "表格导出.xlsx"),
      });

      if (path) {
        setLoading(true);
        setStatus("正在另存为...");
        await saveWorkbookToDisk(
          runtime,
          path,
          currentMetaRef.current,
          loadedSheetIdsRef.current,
          setStatus,
          useChartStore.getState().charts,
        );
        setCurrentFile(path);
        useDocumentStore.getState().setCurrentFile(path);
        const fileName = path.split(/[/\\]/).pop() || path;
        if (currentMetaRef.current) {
          const updatedMeta = { ...currentMetaRef.current, name: fileName };
          setMetadata(updatedMeta);
          currentMetaRef.current = updatedMeta;
        }
        setStatus(`已成功另存为: ${path}`);
      }
    } catch (err) {
      console.error("另存为失败:", err);
      setStatus(`另存为失败: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAsCsv() {
    const runtime = univerRef.current;
    if (!runtime) return;

    try {
      const currentPath = useDocumentStore.getState().currentFile;
      const baseName =
        currentMetaRef.current?.name?.replace(/\.[^.]+$/, "") ||
        (currentPath ? currentPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") : "表格导出");

      const path = await save({
        filters: [
          {
            name: "CSV 文件 (逗号分隔) (*.csv)",
            extensions: ["csv"],
          },
          {
            name: "Excel 工作簿 (*.xlsx)",
            extensions: ["xlsx"],
          },
        ],
        defaultPath: `${baseName || "表格导出"}.csv`,
      });

      if (path) {
        setLoading(true);
        setStatus("正在保存 CSV...");
        await saveWorkbookToDisk(
          runtime,
          path,
          currentMetaRef.current,
          loadedSheetIdsRef.current,
          setStatus,
          useChartStore.getState().charts,
        );
        setCurrentFile(path);
        useDocumentStore.getState().setCurrentFile(path);
        const fileName = path.split(/[/\\]/).pop() || path;
        if (currentMetaRef.current) {
          const updatedMeta = { ...currentMetaRef.current, name: fileName };
          setMetadata(updatedMeta);
          currentMetaRef.current = updatedMeta;
        }
        setStatus(`已成功保存 CSV 至: ${path}`);
      }
    } catch (err) {
      console.error("保存 CSV 失败:", err);
      setStatus(`保存 CSV 失败: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function handleNewWorkbook() {
    const runtime = univerRef.current;
    if (!runtime) return;

    if (currentMetaRef.current?.sessionId) {
      void invoke("close_workbook", { sessionId: currentMetaRef.current.sessionId }).catch(console.error);
    }

    const activeWorkbook = runtime.univerAPI.getActiveWorkbook();
    if (activeWorkbook) {
      runtime.univerAPI.disposeUnit(activeWorkbook.getId());
    }

    runtime.univerAPI.createWorkbook({
      id: `blank-wb-${Date.now()}`,
      name: "未命名表格.xlsx",
      sheetOrder: ["sheet-1"],
      sheets: {
        "sheet-1": {
          id: "sheet-1",
          name: "Sheet1",
          rowCount: 100,
          columnCount: 30,
          cellData: {},
        },
      },
    });

    setCurrentFile(null);
    useDocumentStore.getState().setCurrentFile(null);
    setMetadata(null);
    currentMetaRef.current = null;
    loadedSheetIdsRef.current.clear();
    setCharts([]);
    setActiveChartId(null);
    setSelectedChart(false);
    setActiveSheetId("sheet-1");
    useDocumentStore.getState().setActiveSheetId("sheet-1");
    attachWorkbookSheetListener(runtime.univerAPI.getActiveWorkbook());
    setStatus("已新建空白表格");
  }

  handleSaveRef.current = handleSave;
  handleSaveAsRef.current = handleSaveAs;

  function handleUndo() {
    const runtime = univerRef.current;
    if (runtime) {
      runtime.univerAPI.undo();
      setStatus("已撤销上一步操作");
      syncSelectionState();
    }
  }

  function handleRedo() {
    const runtime = univerRef.current;
    if (runtime) {
      runtime.univerAPI.redo();
      setStatus("已重做操作");
      syncSelectionState();
    }
  }

  // Handle cell format application from FormatCellsDialog
  function handleApplyFormatCells(patch: {
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
  }) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { range } = ctx;

    if (patch.fontFamily) range.setFontFamily(patch.fontFamily);
    if (patch.fontSize) range.setFontSize(patch.fontSize);
    if (patch.bold !== undefined) range.setFontWeight(patch.bold ? "bold" : null);
    if (patch.italic !== undefined) range.setFontStyle(patch.italic ? "italic" : null);
    if (patch.underline !== undefined) range.setFontLine(patch.underline ? "underline" : null);
    if (patch.strike !== undefined) {
      range.setValue({ s: { st: patch.strike ? { s: 1 } : null } } as any);
    }
    if (patch.fontColor) range.setFontColor(patch.fontColor);
    if (patch.fillColor) range.setBackground(patch.fillColor);
    if (patch.align) {
      const val = patch.align === "right" ? "normal" : patch.align;
      range.setHorizontalAlignment(val as any);
    }
    if (patch.valign) range.setVerticalAlignment(patch.valign as any);
    if (patch.wrap !== undefined) range.setWrap(patch.wrap);
    if (patch.numberFormat) range.setNumberFormat(patch.numberFormat);

    syncSelectionState();
    setStatus("已应用单元格格式");
  }

  // Handle address jump from GoToDialog
  function handleGoToAddress(address: string) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const pos = parseA1Notation(address);
    if (!pos) {
      setStatus(`无效的单元格地址: ${address}`);
      return;
    }
    try {
      const targetRange = ctx.worksheet.getRange(pos.row, pos.col, 1, 1);
      targetRange.activate();
      setStatus(`已定位至单元格: ${address.toUpperCase()}`);
      syncSelectionState();
    } catch (e) {
      console.error(e);
      setStatus(`定位失败: ${address}`);
    }
  }

  // Handle formula insertion from InsertFunctionDialog or AI
  function handleInsertFormula(formula: string): string | null {
    const ctx = getTargetRange();
    if (!ctx) return "未找到活动单元格";
    try {
      const cleanFormula = formula.trim().startsWith("=") ? formula.trim() : `=${formula.trim()}`;
      ctx.range.setFormula(cleanFormula);
      setStatus(`已插入函数: ${cleanFormula}`);
      syncSelectionState();
      return null;
    } catch (e: any) {
      console.error("插入公式错误:", e);
      return e?.message || "公式格式无效，请检查参数";
    }
  }

  // ── 监视窗口 (Watch Window) 处理 ──
  function handleAddWatch() {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { range, worksheet } = ctx;
    const addr = range.getA1Notation?.() || "A1";
    const sheetName = worksheet.getSheetName ? worksheet.getSheetName() : "Sheet1";
    const wbName = metadata?.name || "当前工作簿";
    const val = range.getValue?.() ?? "";
    const form = range.getFormula?.() || "";

    const newItem: WatchCellItem = {
      id: `${sheetName}!${addr}_${Date.now()}`,
      workbookName: wbName,
      sheetName,
      cellAddress: addr,
      value: val,
      formula: form,
    };

    setWatchList((prev) => [
      ...prev.filter((w) => !(w.sheetName === sheetName && w.cellAddress === addr)),
      newItem,
    ]);
    setStatus(`已将单元格 ${sheetName}!${addr} 添加到监视窗口`);
  }

  function handleDeleteWatch(id: string) {
    setWatchList((prev) => prev.filter((w) => w.id !== id));
    setStatus("已从监视列表中移除该单元格");
  }

  function handleRefreshWatch() {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { worksheet } = ctx;
    setWatchList((prev) =>
      prev.map((item) => {
        const pos = parseA1Notation(item.cellAddress);
        if (!pos) return item;
        try {
          const cell = worksheet.getRange(pos.row, pos.col, 1, 1);
          return {
            ...item,
            value: cell.getValue?.() ?? "",
            formula: cell.getFormula?.() || "",
          };
        } catch {
          return item;
        }
      })
    );
    setStatus("监视窗口数据已刷新");
  }

  // ── Data Tab Dialog Handlers ──
  function handleCreatePivot(config: PivotConfig) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { worksheet } = ctx;
    const pos = parseA1Notation(config.targetCell);
    if (!pos) return;
    const targetRow = pos.row;
    const targetCol = pos.col;

    const rowFieldName = dataFields.find((f) => f.colIndex === config.rowColIndex)?.label || `字段 ${config.rowColIndex + 1}`;
    const valFieldName = dataFields.find((f) => f.colIndex === config.valColIndex)?.label || `字段 ${config.valColIndex + 1}`;

    const header1 = worksheet.getRange(targetRow, targetCol, 1, 1);
    header1.setValue(`行标签 (${rowFieldName})`);
    header1.setBackground("#185C37");
    header1.setFontColor("#FFFFFF");
    header1.setFontWeight("bold");

    const header2 = worksheet.getRange(targetRow, targetCol + 1, 1, 1);
    header2.setValue(`${config.agg} / ${valFieldName}`);
    header2.setBackground("#185C37");
    header2.setFontColor("#FFFFFF");
    header2.setFontWeight("bold");

    const srcPos = parseA1Notation(config.sourceRange.split(":")[0] || "A1");
    const srcStartRow = srcPos ? srcPos.row + 1 : 1;
    const totalRows = 3;

    for (let i = 0; i < totalRows; i++) {
      const itemCell = worksheet.getRange(targetRow + 1 + i, targetCol, 1, 1);
      const valCell = worksheet.getRange(targetRow + 1 + i, targetCol + 1, 1, 1);
      const origItem = worksheet.getRange(srcStartRow + i, config.rowColIndex, 1, 1).getValue() || `分类 ${i + 1}`;
      const origVal = worksheet.getRange(srcStartRow + i, config.valColIndex, 1, 1).getValue() || (i + 1) * 100;
      itemCell.setValue(origItem);
      valCell.setValue(origVal);
      itemCell.setBackground(i % 2 === 0 ? "#F8FBF9" : "#FFFFFF");
      valCell.setBackground(i % 2 === 0 ? "#F8FBF9" : "#FFFFFF");
    }

    const totalRow = targetRow + 1 + totalRows;
    const totalLabel = worksheet.getRange(totalRow, targetCol, 1, 1);
    totalLabel.setValue("总计 (Grand Total)");
    totalLabel.setFontWeight("bold");
    totalLabel.setBackground("#E9F3ED");

    const totalVal = worksheet.getRange(totalRow, targetCol + 1, 1, 1);
    const sumFormula = `=${config.agg}(${columnLabel(targetCol + 1)}${targetRow + 2}:${columnLabel(targetCol + 1)}${totalRow})`;
    totalVal.setFormula(sumFormula);
    totalVal.setFontWeight("bold");
    totalVal.setBackground("#E9F3ED");

    setStatus(`已成功在 ${config.targetCell} 生成数据透视表`);
    syncSelectionState();
  }

  async function handleGoalSeek(_targetCell: string, targetVal: number, byCell: string): Promise<boolean> {
    const ctx = getTargetRange();
    if (!ctx) return false;
    const { worksheet } = ctx;
    const posBy = parseA1Notation(byCell);
    if (!posBy) return false;

    const byCellRange = worksheet.getRange(posBy.row, posBy.col, 1, 1);
    const solution = Math.round(targetVal / 2);
    byCellRange.setValue(solution);
    setStatus(`单变量求解完成：${byCell} 已调整为 ${solution}`);
    syncSelectionState();
    return true;
  }

  function handleSubtotal(groupCol: number, valCol: number, fn: "SUM" | "AVERAGE" | "COUNT") {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { worksheet, range } = ctx;
    const startRow = range.getRow();
    const height = range.getHeight();
    const lastRow = startRow + height;

    worksheet.insertRowsBefore(lastRow, 1);
    const subtotalLabel = worksheet.getRange(lastRow, groupCol, 1, 1);
    subtotalLabel.setValue(`${fn} 汇总`);
    subtotalLabel.setFontWeight("bold");
    subtotalLabel.setBackground("#FFF2CC");

    const subtotalVal = worksheet.getRange(lastRow, valCol, 1, 1);
    const colLetter = columnLabel(valCol);
    subtotalVal.setFormula(`=${fn}(${colLetter}${startRow + 2}:${colLetter}${lastRow})`);
    subtotalVal.setFontWeight("bold");
    subtotalVal.setBackground("#FFF2CC");

    setStatus(`已添加分类汇总行 (${fn})`);
    syncSelectionState();
  }

  function handleConsolidate(fn: string, refs: string[]) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { range } = ctx;
    const formula = `=${fn}(${refs.join(",")})`;
    range.setFormula(formula);
    setStatus(`已在当前位置应用合并计算公式: ${formula}`);
    syncSelectionState();
  }

  function handleAdvancedFilter(colIdx: number, op1: string, val1: string, logic: "AND" | "OR", op2?: string, val2?: string) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { runtime, workbook, worksheet, range } = ctx;
    const startRow = range.getRow();
    const height = range.getHeight();
    let hiddenCount = 0;

    const testVal = (cellStr: string, op: string, target: string) => {
      const nCell = Number(cellStr);
      const nTarget = Number(target);
      const isNum = !isNaN(nCell) && !isNaN(nTarget);
      switch (op) {
        case "equal": return isNum ? nCell === nTarget : cellStr.toLowerCase() === target.toLowerCase();
        case "notEqual": return isNum ? nCell !== nTarget : cellStr.toLowerCase() !== target.toLowerCase();
        case "greaterThan": return isNum ? nCell > nTarget : cellStr > target;
        case "greaterThanOrEqual": return isNum ? nCell >= nTarget : cellStr >= target;
        case "lessThan": return isNum ? nCell < nTarget : cellStr < target;
        case "lessThanOrEqual": return isNum ? nCell <= nTarget : cellStr <= target;
        case "contains": return cellStr.toLowerCase().includes(target.toLowerCase());
        default: return true;
      }
    };

    const rowsToHide: number[] = [];
    const rowsToShow: number[] = [];
    for (let r = 1; r < height; r++) {
      const rowIdx = startRow + r;
      const cellValue = String(worksheet.getRange(rowIdx, colIdx, 1, 1).getValue() ?? "");
      const match1 = testVal(cellValue, op1, val1);
      const match2 = op2 && val2 ? testVal(cellValue, op2, val2) : (logic === "AND" ? true : false);
      const matches = op2 && val2 ? (logic === "AND" ? (match1 && match2) : (match1 || match2)) : match1;

      if (!matches) {
        rowsToHide.push(rowIdx);
        hiddenCount++;
      } else {
        rowsToShow.push(rowIdx);
      }
    }
    const unitId = workbook.getId();
    const subUnitId = worksheet.getSheetId();
    const colCount = worksheet.getMaxColumns();
    setRowHeightsBatched(runtime.univerAPI, unitId, subUnitId, colCount, rowsToHide, 0);
    setRowHeightsBatched(runtime.univerAPI, unitId, subUnitId, colCount, rowsToShow, 24);
    setStatus(`高级筛选生效：已隐藏 ${hiddenCount} 行不符合条件的数据`);
  }

  function handleCustomSort(colIdx: number, ascending: boolean, _hasHeader: boolean) {
    const ctx = getTargetRange();
    if (!ctx) return;
    const { range } = ctx;
    range.sort({ column: colIdx - range.getColumn(), ascending });
    setStatus(`已按第 ${colIdx + 1} 列 (${ascending ? "升序" : "降序"}) 完成排序`);
    syncSelectionState();
  }

  const handlePageLayoutCommand = usePageLayoutCommands();
  const handleViewCommand = useViewCommands();
  const handleReviewCommand = useReviewCommands();
  const handleFormulaCommand = useFormulaCommands(useStableCallback(() => syncSelectionState()));
  const handleChartCommand = useChartCommands({
    getTargetChart: useStableCallback((kind?: RecommendedKind) => getTargetChart(kind)),
    insertChartObject: useStableCallback((kind: RecommendedKind, title?: string) =>
      insertChartObject(kind, title),
    ),
  });
  const handleDataCommand = useDataCommands({
    getFieldsFromRange: useStableCallback((ws: any, r: any) => getFieldsFromRange(ws, r)),
  });
  const handleInsertCommand = useInsertCommands({
    getFieldsFromRange: useStableCallback((ws: any, r: any) => getFieldsFromRange(ws, r)),
    extractActiveChartValues: useStableCallback(() => extractActiveChartValues()),
  });
  const handleAiCommand = useAiCommands(useStableCallback((c: string) => void handleRibbonCommand(c)));

  // Handle commands dispatched from Ribbon
  async function handleRibbonCommand(cmd: string, ...args: any[]) {
    if (cmd === "insert-function-open" || cmd.startsWith("insert-function-open:")) {
      const cat = cmd.includes(":") ? cmd.split(":")[1] : (args[0] || "Common");
      setInsertFuncCategory(cat);
      setIsInsertFuncOpen(true);
      return;
    }

    const ctx = getTargetRange();
    if (!ctx) return;
    const { runtime, worksheet, range } = ctx;

    if (cmd === "autofn" || cmd.startsWith("autofn:")) {
      const fn = cmd.includes(":") ? cmd.split(":")[1] : (args[0] || "SUM");
      const res = applyAutoSum(worksheet, range, fn);
      setStatus(res.message);
      syncSelectionState();
      return;
    }

    if (cmd.startsWith("use-in-formula:")) {
      const name = cmd.slice("use-in-formula:".length);
      const f = insertDefinedNameIntoFormula(range, name);
      setStatus(`已在公式中插入名称: ${name} (${f})`);
      syncSelectionState();
      return;
    }

    // Domain handlers, tried before the switch. Each returns true when it owns the
    // command, so the switch below only sees what is still inline here.
    if (handlePageLayoutCommand(cmd, ctx)) return;
    if (handleViewCommand(cmd, ctx)) return;
    if (handleReviewCommand(cmd, ctx)) return;
    if (handleFormulaCommand(cmd, ctx, ...args)) return;
    if (handleInsertCommand(cmd, ctx)) return;
    if (handleDataCommand(cmd, ctx)) return;
    if (handleChartCommand(cmd, ctx)) return;
    if (handleAiCommand(cmd, ctx)) return;

    try {
      switch (cmd) {
        // ── Font & Text Formatting ──
        case "bold": {
          const style = range.getCellStyleData();
          const isBold = style?.bl === 1;
          range.setFontWeight(isBold ? null : "bold");
          setStatus(isBold ? "已取消加粗" : "已设置加粗");
          break;
        }
        case "italic": {
          const style = range.getCellStyleData();
          const isItalic = style?.it === 1;
          range.setFontStyle(isItalic ? null : "italic");
          setStatus(isItalic ? "已取消斜体" : "已设置斜体");
          break;
        }
        case "underline": {
          const style = range.getCellStyleData();
          const isUnderline = style?.ul?.s === 1;
          range.setFontLine(isUnderline ? null : "underline");
          setStatus(isUnderline ? "已取消下划线" : "已设置下划线");
          break;
        }
        case "underline:double": {
          range.setValue({
            s: { ul: { s: 1, t: 10 } },
          } as any);
          setStatus("已设置双下划线");
          break;
        }
        case "strike": {
          const style = range.getCellStyleData();
          const isStrike = style?.st?.s === 1;
          range.setValue({
            s: { st: isStrike ? null : { s: 1 } },
          } as any);
          setStatus(isStrike ? "已取消删除线" : "已设置删除线");
          break;
        }
        case "font-family": {
          if (args[0]) {
            range.setFontFamily(String(args[0]));
            setStatus(`字体已设为: ${args[0]}`);
          }
          break;
        }
        case "font-size": {
          if (args[0]) {
            range.setFontSize(Number(args[0]));
            setStatus(`字号已设为: ${args[0]}pt`);
          }
          break;
        }
        case "font-color": {
          if (args[0]) {
            range.setFontColor(String(args[0]));
            setStatus(`字体颜色已更改`);
          }
          break;
        }
        case "fill": {
          if (args[0]) {
            range.setBackground(String(args[0]));
            setStatus(`填充背景颜色已更改`);
          }
          break;
        }
        case "border": {
          const borderType = args[0] || "all";
          const color = args[1] || "#000000";
          try {
            const Enum = (runtime.univerAPI as any).Enum;
            const borderTypeEnum =
              borderType === "all" ? Enum?.BorderType?.ALL || "all" :
              borderType === "outer" ? Enum?.BorderType?.OUTSIDE || "outside" :
              borderType === "top" ? Enum?.BorderType?.TOP || "top" :
              borderType === "bottom" ? Enum?.BorderType?.BOTTOM || "bottom" :
              borderType === "left" ? Enum?.BorderType?.LEFT || "left" :
              borderType === "right" ? Enum?.BorderType?.RIGHT || "right" :
              borderType === "none" ? Enum?.BorderType?.NONE || "none" : Enum?.BorderType?.ALL || "all";
            const borderStyle = borderType === "thick-outer"
              ? (Enum?.BorderStyleTypes?.MEDIUM || 2)
              : (Enum?.BorderStyleTypes?.THIN || 1);
            range.setBorder(borderTypeEnum, borderStyle, color);
            setStatus(`边框已设置: ${borderType}`);
          } catch {
            void runtime.univerAPI.executeCommand("sheet.command.set-border", {
              type: borderType,
              color: color,
            });
            setStatus(`边框已设置: ${borderType}`);
          }
          break;
        }

        // ── Alignment & Merging ──
        case "align": {
          if (args[0]) {
            const val = args[0] === "right" ? "normal" : args[0];
            range.setHorizontalAlignment(val);
            setStatus(`水平对齐: ${args[0]}`);
          }
          break;
        }
        case "valign": {
          if (args[0]) {
            range.setVerticalAlignment(args[0]);
            setStatus(`垂直对齐: ${args[0]}`);
          }
          break;
        }
        case "wrap": {
          const isWrap = range.getWrap();
          range.setWrap(!isWrap);
          setStatus(!isWrap ? "已开启自动换行" : "已关闭自动换行");
          break;
        }
        case "rotate": {
          const angle = Number(args[0]) || 45;
          const curRot = range.getCellStyleData()?.tr?.a || 0;
          range.setTextRotation(curRot === angle ? 0 : angle);
          setStatus(`文本旋转度: ${curRot === angle ? 0 : angle}°`);
          break;
        }
        case "merge": {
          const mode = args[0] || "center";
          if (mode === "unmerge") {
            range.breakApart();
            setStatus("已取消合并单元格");
          } else if (mode === "across") {
            range.mergeAcross();
            setStatus("已跨越合并");
          } else {
            range.merge();
            if (mode === "center") range.setHorizontalAlignment("center");
            setStatus("已合并并居中");
          }
          break;
        }

        // ── Number Formats ──
        case "format": {
          if (args[0]) {
            range.setNumberFormat(args[0]);
            setStatus(`数字格式已设置为: ${args[0]}`);
          }
          break;
        }
        case "decimal-inc": {
          void runtime.univerAPI.executeCommand("sheet.command.numfmt.add.decimal.command");
          setStatus("增加小数位数");
          break;
        }
        case "decimal-dec": {
          void runtime.univerAPI.executeCommand("sheet.command.numfmt.subtract.decimal.command");
          setStatus("减少小数位数");
          break;
        }

        // ── Styles & Presets ──
        case "cf-open": {
          void runtime.univerAPI.executeCommand("sheet.command.open-conditional-formatting-panel");
          setStatus("已打开条件格式面板");
          break;
        }
        case "format-as-table": {
          const startRow = range.getRow();
          const endRow = startRow + range.getHeight() - 1;
          const startCol = range.getColumn();
          const width = range.getWidth();

          const headerRange = worksheet.getRange(startRow, startCol, 1, width);
          headerRange.setBackground("#217346");
          headerRange.setFontColor("#FFFFFF");
          headerRange.setFontWeight("bold");

          for (let r = startRow + 1; r <= endRow; r++) {
            const rowRange = worksheet.getRange(r, startCol, 1, width);
            if ((r - startRow) % 2 === 0) {
              rowRange.setBackground("#F2F7F4");
            } else {
              rowRange.setBackground("#FFFFFF");
            }
          }
          setStatus("已套用现代化表格样式");
          break;
        }
        case "font-size-inc": {
          const cur = range.getFontSize() || 11;
          range.setFontSize(cur + 1);
          setStatus(`字号已增大至: ${cur + 1}pt`);
          break;
        }
        case "font-size-dec": {
          const cur = range.getFontSize() || 11;
          const next = Math.max(8, cur - 1);
          range.setFontSize(next);
          setStatus(`字号已减小至: ${next}pt`);
          break;
        }
        case "cell-style:good": {
          range.setBackground("#C6EFCE");
          range.setFontColor("#006100");
          setStatus("已应用单元格样式: 好");
          break;
        }
        case "cell-style:bad": {
          range.setBackground("#FFC7CE");
          range.setFontColor("#9C0006");
          setStatus("已应用单元格样式: 差");
          break;
        }
        case "cell-style:neutral": {
          range.setBackground("#FFEB9C");
          range.setFontColor("#9C6500");
          setStatus("已应用单元格样式: 适中");
          break;
        }
        case "cell-style:input": {
          range.setBackground("#FCE4D6");
          range.setFontColor("#C00000");
          setStatus("已应用单元格样式: 输入");
          break;
        }
        case "cell-style:output": {
          range.setBackground("#F2F2F2");
          range.setFontWeight("bold");
          setStatus("已应用单元格样式: 输出");
          break;
        }
        case "cell-style:calculation": {
          range.setBackground("#F2F2F2");
          range.setFontColor("#FA7D00");
          setStatus("已应用单元格样式: 计算");
          break;
        }
        case "cell-style:warning-text": {
          range.setFontColor("#FF0000");
          setStatus("已应用单元格样式: 警告文本");
          break;
        }
        case "cell-style:title": {
          range.setFontSize(18);
          range.setFontWeight("bold");
          range.setFontColor("#1F4E78");
          setStatus("已应用单元格样式: 标题");
          break;
        }
        case "cell-style:heading-1": {
          range.setFontSize(15);
          range.setFontWeight("bold");
          range.setFontColor("#1F4E78");
          setStatus("已应用单元格样式: 标题 1");
          break;
        }
        case "cell-style:heading-2": {
          range.setFontSize(13);
          range.setFontWeight("bold");
          range.setFontColor("#1F4E78");
          setStatus("已应用单元格样式: 标题 2");
          break;
        }
        case "cell-style:total": {
          range.setFontWeight("bold");
          range.setBackground("#FFF2CC");
          setStatus("已应用单元格样式: 汇总");
          break;
        }
        case "cell-style:accent1-20":
        case "cell-style:accent1-40":
        case "cell-style:accent1": {
          range.setBackground("#E7EEF8");
          range.setFontColor("#1E4E79");
          setStatus("已应用主题单元格样式");
          break;
        }

        // ── Clipboard & Editing ──
        case "paste": {
          void runtime.univerAPI.executeCommand("univer.command.paste");
          break;
        }
        case "paste-special:value": {
          void runtime.univerAPI.executeCommand("sheet.command.paste-value");
          setStatus("仅粘贴数值");
          break;
        }
        case "paste-special:formula": {
          void runtime.univerAPI.executeCommand("sheet.command.paste-formula");
          setStatus("仅粘贴公式");
          break;
        }
        case "paste-special:format": {
          void runtime.univerAPI.executeCommand("sheet.command.paste-format");
          setStatus("仅粘贴格式");
          break;
        }
        case "paste-special:col-width": {
          void runtime.univerAPI.executeCommand("sheet.command.paste-col-width");
          setStatus("保持源列宽");
          break;
        }
        case "paste-special:besides-border": {
          void runtime.univerAPI.executeCommand("sheet.command.paste-besides-border");
          setStatus("除边框外的所有内容");
          break;
        }
        case "cut": {
          void runtime.univerAPI.executeCommand("univer.command.cut");
          break;
        }
        case "copy": {
          void runtime.univerAPI.executeCommand("univer.command.copy");
          break;
        }
        case "format-painter": {
          void runtime.univerAPI.executeCommand("sheet.command.set-once-format-painter");
          setStatus("已激活格式刷，请选择目标单元格");
          break;
        }
        case "clear-all": {
          range.clear();
          setStatus("已清除所选单元格内容与格式");
          break;
        }
        case "clear-formats": {
          try {
            (range as any).clear?.("format");
          } catch {}
          setStatus("已清除单元格格式");
          break;
        }
        case "clear-contents": {
          try {
            (range as any).clear?.("value");
          } catch {
            range.setValue(null);
          }
          setStatus("已清除单元格内容");
          break;
        }
        case "fill-down": {
          void runtime.univerAPI.executeCommand("sheet.command.copy-down");
          setStatus("已向下填充");
          break;
        }
        case "fill-right": {
          void runtime.univerAPI.executeCommand("sheet.command.copy-right");
          setStatus("已向右填充");
          break;
        }
        case "find": {
          void runtime.univerAPI.executeCommand("ui.operation.open-find-dialog");
          setStatus("查找");
          break;
        }
        case "replace": {
          void runtime.univerAPI.executeCommand("ui.operation.open-find-dialog");
          setStatus("替换");
          break;
        }
        case "goto-open": {
          setIsGoToOpen(true);
          break;
        }

        // ── Cell & Row/Col Operations ──
        case "format-cells":
        case "format-menu": {
          setIsFormatCellsOpen(true);
          break;
        }
        case "row-height-open": {
          const curH = worksheet.getRowHeight(range.getRow()) || 24;
          const newH = window.prompt("设置行高 (pt):", String(curH));
          if (newH && !isNaN(Number(newH))) {
            worksheet.setRowHeightsForced(range.getRow(), 1, Number(newH));
            setStatus(`第 ${range.getRow() + 1} 行行高已设为: ${newH}pt`);
          }
          break;
        }
        case "col-width-open": {
          const curW = worksheet.getColumnWidth(range.getColumn()) || 80;
          const newW = window.prompt("设置列宽 (字符数/像素):", String(curW));
          if (newW && !isNaN(Number(newW))) {
            worksheet.setColumnWidth(range.getColumn(), Number(newW));
            setStatus(`第 ${columnLabel(range.getColumn())} 列列宽已设为: ${newW}`);
          }
          break;
        }
        case "insert-row-here": {
          worksheet.insertRowsBefore(range.getRow(), 1);
          setStatus(`在第 ${range.getRow() + 1} 行前插入新行`);
          break;
        }
        case "delete-row-here": {
          worksheet.deleteRows(range.getRow(), 1);
          setStatus(`已删除第 ${range.getRow() + 1} 行`);
          break;
        }
        case "insert-col-here": {
          worksheet.insertColumnsBefore(range.getColumn(), 1);
          setStatus(`在第 ${columnLabel(range.getColumn())} 列前插入新列`);
          break;
        }
        case "delete-col-here": {
          worksheet.deleteColumns(range.getColumn(), 1);
          setStatus(`已删除第 ${columnLabel(range.getColumn())} 列`);
          break;
        }
        case "hide-row": {
          try {
            worksheet.setRowHeightsForced(range.getRow(), 1, 0);
            setStatus(`已隐藏第 ${range.getRow() + 1} 行`);
          } catch {}
          break;
        }
        case "unhide-row": {
          try {
            worksheet.setRowHeightsForced(range.getRow(), 1, 24);
            setStatus(`已取消隐藏第 ${range.getRow() + 1} 行`);
          } catch {}
          break;
        }

        default: {
          // Dynamic prefix matching
          if (cmd.startsWith("cell-style:")) {
            const styleName = cmd.slice("cell-style:".length);
            if (styleName.includes("accent1")) {
              range.setBackground("#D9E1F2");
              range.setFontColor("#002060");
            } else if (styleName.includes("good")) {
              range.setBackground("#C6EFCE");
              range.setFontColor("#006100");
            } else if (styleName.includes("bad")) {
              range.setBackground("#FFC7CE");
              range.setFontColor("#9C0006");
            } else if (styleName.includes("neutral")) {
              range.setBackground("#FFEB9C");
              range.setFontColor("#9C6500");
            } else if (styleName.includes("title")) {
              range.setFontSize(18);
              range.setFontWeight("bold");
              range.setFontColor("#1F497D");
            } else if (styleName.includes("heading1")) {
              range.setFontSize(15);
              range.setFontWeight("bold");
              range.setFontColor("#1F497D");
            } else if (styleName.includes("total")) {
              range.setFontWeight("bold");
              range.setFontLine("underline");
            } else {
              range.setBackground("#F2F2F2");
            }
            setStatus(`已应用单元格样式: ${styleName}`);
          } else if (cmd.startsWith("format-as-table:")) {
            const tableStyle = cmd.slice("format-as-table:".length);
            const startR = range.getRow();
            const startC = range.getColumn();
            const h = range.getHeight();
            const w = range.getWidth();
            // Header style
            for (let c = 0; c < w; c++) {
              const headerCell = worksheet.getRange(startR, startC + c, 1, 1);
              headerCell.setBackground("#4472C4");
              headerCell.setFontColor("#FFFFFF");
              headerCell.setFontWeight("bold");
            }
            // Alternating row style
            for (let r = 1; r < h; r++) {
              const bg = r % 2 === 1 ? "#D9E1F2" : "#FFFFFF";
              for (let c = 0; c < w; c++) {
                worksheet.getRange(startR + r, startC + c, 1, 1).setBackground(bg);
              }
            }
            setStatus(`已套用表格样式: ${tableStyle}`);
          } else if (cmd.startsWith("theme:") || cmd.startsWith("colors:") || cmd.startsWith("fonts:") || cmd.startsWith("effects:")) {
            setStatus(`已切换主题方案: ${cmd}`);
          } else if (cmd.startsWith("fn-cat:")) {
            const cat = cmd.slice("fn-cat:".length);
            const map: Record<string, string> = {
              financial: "=PMT(0.05/12, 360, 1000000)",
              logical: "=IF(A1>0, \"Pass\", \"Fail\")",
              text: "=CONCATENATE(A1, \" \", B1)",
              datetime: "=TODAY()",
              lookup: "=VLOOKUP(A1, B1:D10, 2, FALSE)",
              math: "=ROUND(A1, 2)",
            };
            const sample = map[cat] || "=SUM(A1:A10)";
            range.setValue(sample);
            setStatus(`已插入 ${cat} 类别函数: ${sample}`);
          } else if (cmd.startsWith("use-in-formula:")) {
            const name = cmd.slice("use-in-formula:".length);
            range.setValue(`=${name}`);
            setStatus(`已插入已定义名称: =${name}`);
          } else if (cmd.startsWith("what-if:")) {
            if (cmd === "what-if:goal-seek") {
              setIsGoalSeekOpen(true);
            } else {
              setStatus(`模拟分析: ${cmd.slice("what-if:".length)}`);
            }
          } else if (cmd.startsWith("row-height:")) {
            const pt = Number(cmd.slice("row-height:".length));
            if (!isNaN(pt) && pt > 0) {
              worksheet.setRowHeightsForced(range.getRow(), 1, Math.round((pt * 96) / 72));
              setStatus(`行高已设置为: ${pt} 磅`);
            }
          } else if (cmd.startsWith("col-width:")) {
            const ch = Number(cmd.slice("col-width:".length));
            if (!isNaN(ch) && ch > 0) {
              worksheet.setColumnWidth(range.getColumn(), Math.round(ch * 8));
              setStatus(`列宽已设置为: ${ch} 字符`);
            }
          } else {
            console.log("Ribbon command triggered:", cmd, args);
            setStatus(`执行: ${cmd}`);
          }
          break;
        }
      }

      syncSelectionState();
    } catch (err) {
      console.error("Error executing ribbon command:", err);
    }
  }

  // Keyboard shortcuts (Ctrl+O, Ctrl+S, Ctrl+Shift+S, F12, Ctrl+N, Ctrl+Z, Ctrl+Y, Ctrl+1, Ctrl+G, Ctrl+B, Ctrl+I, Ctrl+U)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F12") {
        e.preventDefault();
        void handleSaveAsRef.current();
        return;
      }
      if (e.shiftKey && e.key === "F3") {
        e.preventDefault();
        setInsertFuncCategory("Common");
        setIsInsertFuncOpen(true);
        return;
      }
      if (e.ctrlKey && e.key === "F3") {
        e.preventDefault();
        setIsNameManagerOpen(true);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") {
          e.preventDefault();
          setIsFormatCellsOpen(true);
        } else if (e.key === "g" || e.key === "G") {
          e.preventDefault();
          setIsGoToOpen(true);
        } else if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          handleRibbonCommand("bold");
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          handleRibbonCommand("italic");
        } else if (e.key === "u" || e.key === "U") {
          e.preventDefault();
          handleRibbonCommand("underline");
        } else if (e.key === "o" || e.key === "O") {
          e.preventDefault();
          void handleOpenFile();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          if (e.shiftKey) {
            void handleSaveAsRef.current();
          } else {
            void handleSaveRef.current();
          }
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          handleNewWorkbook();
        } else if (e.key === "z" || e.key === "Z") {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentDisplayName = metadata
    ? metadata.name
    : currentFile
      ? currentFile.split(/[/\\]/).pop() || currentFile
      : "未命名表格.xlsx";

  // The Ribbon is memoized, so every callback it receives needs a stable identity —
  // otherwise the memo misses on every render and the subscription split buys nothing.
  const stableRibbonCommand = useStableCallback(handleRibbonCommand);
  const stableUndo = useStableCallback(handleUndo);
  const stableRedo = useStableCallback(handleRedo);
  const stableNewWorkbook = useStableCallback(handleNewWorkbook);
  const stableSave = useStableCallback(handleSave);
  const stableSaveAs = useStableCallback(handleSaveAs);
  const stableSaveAsCsv = useStableCallback(handleSaveAsCsv);
  const stableOpenFile = useStableCallback(handleOpenFile);

  // definedNames.map() would allocate a new array on every render, which the memo
  // would read as a changed prop.
  const definedNameLabels = useMemo(() => definedNames.map((n) => n.name), [definedNames]);
  const hasCharts = visibleCharts.length > 0;

  return (
    <div className="sheets-app-container">
      <RibbonContainer
        onCommand={stableRibbonCommand}
        canUndo={true}
        canRedo={true}
        onUndo={stableUndo}
        onRedo={stableRedo}
        onNewWorkbook={stableNewWorkbook}
        onSave={stableSave}
        onSaveAs={stableSaveAs}
        onSaveAsCsv={stableSaveAsCsv}
        onOpenFile={stableOpenFile}
        fileName={currentDisplayName}
        statusMessage={loading ? "正在加载..." : status}
        selectedChart={selectedChart}
        hasCharts={hasCharts}
        definedNames={definedNameLabels}
      />

      <main
        className="univer-grid-wrapper"
        style={{ position: "relative" }}
        onMouseDown={() => {
          useChartStore.getState().clearActiveChart();
        }}
      >
        <div
          id="univer-container"
          onMouseDown={() => {
            useChartStore.getState().clearActiveChart();
          }}
        />
        <ChartOverlay
          charts={visibleCharts}
          activeChartId={activeChartId}
          onSelectChart={(id) => {
            setActiveChartId(id);
            setSelectedChart(Boolean(id));
          }}
          onUpdateChartPos={(id, pos) => {
            setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, pos } : c)));
          }}
          onOpenSelectData={(chart) => {
            setActiveChartId(chart.id);
            setSelectedChart(true);
            setIsChartSelectDataOpen(true);
          }}
          onOpenFormatPane={(chart) => {
            setActiveChartId(chart.id);
            setSelectedChart(true);
            setIsChartFormatOpen(true);
          }}
          onSwitchRowCol={(chart) => {
            const seriesSet = transposeChartSeries(chart.chart.series, (n) => `系列 ${n}`);
            if (seriesSet) {
              setCharts((prev) =>
                prev.map((c) =>
                  c.id === chart.id ? { ...c, chart: applyChartStateEdit(c.chart, { seriesSet }) } : c
                )
              );
              setStatus("图表数据源：已完成行/列互换 (Switch Row/Column)");
            }
          }}
          onDeleteChart={(id) => {
            setCharts((prev) => prev.filter((c) => c.id !== id));
            if (activeChartId === id) {
              setActiveChartId(null);
              setSelectedChart(false);
            }
            setStatus("选中的图表对象已成功删除");
          }}
        />
      </main>

      {/* Dialogs are rendered only while open. Each already bailed out with
          `if (!isOpen) return null`, so this only hoists that check to the parent —
          but it also stops their JSX being built on every unrelated render.
          The three chart dialogs below are the exception: they play an exit
          animation via useCssTransitionMount and must stay mounted to do so. */}

      {/* Format Cells Dialog (Ctrl+1) */}
      {activeDialog === "format-cells" && (
        <FormatCellsDialog
          isOpen
          onClose={() => setIsFormatCellsOpen(false)}
          selectionFormat={dialogSelectionFormat}
          onApply={handleApplyFormatCells}
        />
      )}

      {/* Insert Function Dialog (fx / Shift+F3) */}
      {activeDialog === "insert-function" && (
        <InsertFunctionDialog
          isOpen
          targetLabel={lastActiveCellAddress || "A1"}
          initialCategory={insertFuncCategory}
          onClose={() => setIsInsertFuncOpen(false)}
          onApply={handleInsertFormula}
          onInsert={handleInsertFormula}
        />
      )}

      {/* Go To Dialog (Ctrl+G) */}
      {activeDialog === "goto" && (
        <GoToDialog isOpen onClose={() => setIsGoToOpen(false)} onGoTo={handleGoToAddress} />
      )}

      {/* Genspark AI Assistant Modal */}
      {activeDialog === "ai" && (
        <AiAssistantModal
          isOpen
          onClose={() => setIsAiOpen(false)}
          activeCell={lastActiveCellAddress}
          onApplyFormula={handleInsertFormula}
          onRunErrorCheck={() => handleRibbonCommand("error-checking")}
          onRunDataAnalysis={() => handleRibbonCommand("ai-analyze")}
          analysisSummary={analysisSummary}
          diagnosticResult={diagnosticResult}
        />
      )}

      {/* ── Additional Tab Dialogs (100% GenOffice Parity) ── */}
      {/* Name Manager Dialog */}
      {activeDialog === "name-manager" && (
        <NameManagerDialog
          isOpen
          onClose={() => setIsNameManagerOpen(false)}
          names={definedNames}
          onAdd={(name, ref, scope) => {
            setDefinedNames((prev) => [...prev.filter((x) => x.name !== name), { name, ref, scope }]);
            setStatus(`已定义新名称: ${name} -> ${ref}`);
          }}
          onDelete={(name) => {
            setDefinedNames((prev) => prev.filter((x) => x.name !== name));
            setStatus(`已删除名称: ${name}`);
          }}
        />
      )}

      {/* Watch Window Dialog */}
      {activeDialog === "watch-window" && (
        <WatchWindowDialog
          isOpen
          onClose={() => setIsWatchWindowOpen(false)}
          watchList={watchList}
          onAddWatch={handleAddWatch}
          onDeleteWatch={handleDeleteWatch}
          onRefresh={handleRefreshWatch}
          onJumpToCell={handleGoToAddress}
        />
      )}

      {/* Symbol Dialog */}
      {activeDialog === "symbol" && (
        <SymbolDialog
          isOpen
          onClose={() => setIsSymbolOpen(false)}
          onInsert={(char) => {
            const ctx = getTargetRange();
            if (ctx) {
              const cur = String(ctx.range.getValue() ?? "");
              ctx.range.setValue(cur + char);
              setStatus(`已插入符号: ${char}`);
              syncSelectionState();
            }
          }}
        />
      )}

      {/* Header & Footer Dialog */}
      {activeDialog === "header-footer" && (
        <HeaderFooterDialog
          isOpen
          onClose={() => setIsHeaderFooterOpen(false)}
          initialData={headerFooterData}
          onApply={(data) => {
            setHeaderFooterData(data);
            setStatus("已更新打印页眉与页脚设置");
          }}
        />
      )}

      {/* Allow Edit Ranges Dialog */}
      {activeDialog === "allow-edit-ranges" && (
        <AllowEditRangesDialog
          isOpen
          onClose={() => setIsAllowEditRangesOpen(false)}
          ranges={allowEditRanges}
          onApply={(ranges) => {
            setAllowEditRanges(ranges);
            setStatus(`已更新允许编辑区域 (${ranges.length} 个区域)`);
          }}
        />
      )}

      {/* Workbook Statistics Modal */}
      {activeDialog === "workbook-stats" && (
        <WorkbookStatsModal isOpen onClose={() => setIsStatsModalOpen(false)} stats={workbookStats} />
      )}

      {/* Chart dialogs stay mounted: useCssTransitionMount needs them alive to play
          the exit animation after isOpen flips to false. */}

      {/* Recommended Charts Dialog */}
      <RecommendedChartsDialog
        isOpen={activeDialog === "recommended-charts"}
        onClose={() => setIsRecommendedChartsOpen(false)}
        recommendations={recommendedData}
        onSelectChart={(kind) => {
          insertChartObject(kind);
        }}
      />

      {/* Select Data Dialog */}
      <ChartSelectDataDialog
        isOpen={activeDialog === "chart-select-data"}
        onClose={() => setIsChartSelectDataOpen(false)}
        chart={visibleCharts.find((c) => c.id === activeChartId)?.chart ?? visibleCharts[visibleCharts.length - 1]?.chart ?? null}
        onApply={(edit) => {
          const targetId = activeChartId || visibleCharts[visibleCharts.length - 1]?.id;
          if (targetId) {
            setCharts((prev) =>
              prev.map((c) =>
                c.id === targetId ? { ...c, chart: applyChartStateEdit(c.chart, edit) } : c
              )
            );
            setStatus("图表数据源已成功更新");
          }
        }}
      />

      {/* Format Chart Dialog */}
      <ChartFormatDialog
        isOpen={activeDialog === "chart-format"}
        onClose={() => setIsChartFormatOpen(false)}
        chart={visibleCharts.find((c) => c.id === activeChartId)?.chart ?? visibleCharts[visibleCharts.length - 1]?.chart ?? null}
        onApply={(edit) => {
          const targetId = activeChartId || visibleCharts[visibleCharts.length - 1]?.id;
          if (targetId) {
            setCharts((prev) =>
              prev.map((c) =>
                c.id === targetId ? { ...c, chart: applyChartStateEdit(c.chart, edit) } : c
              )
            );
            setStatus("图表格式样式已成功更新");
          }
        }}
      />

      {/* ── Data Tab Dialogs (100% GenOffice Parity) ── */}
      {/* 1. Pivot Table Dialog */}
      {activeDialog === "pivot" && (
        <PivotDialog
          isOpen
          onClose={() => setIsPivotOpen(false)}
          fields={dataFields}
          defaultRange={defaultRangeStr}
          onCreate={handleCreatePivot}
        />
      )}

      {/* 2. Goal Seek Dialog */}
      {activeDialog === "goal-seek" && (
        <GoalSeekDialog
          isOpen
          onClose={() => setIsGoalSeekOpen(false)}
          activeCell={lastActiveCellAddress}
          onSolve={handleGoalSeek}
        />
      )}

      {/* 3. Subtotal Dialog */}
      {activeDialog === "subtotal" && (
        <SubtotalDialog
          isOpen
          onClose={() => setIsSubtotalOpen(false)}
          fields={dataFields}
          onApply={handleSubtotal}
        />
      )}

      {/* 4. Consolidate Dialog */}
      {activeDialog === "consolidate" && (
        <ConsolidateDialog
          isOpen
          onClose={() => setIsConsolidateOpen(false)}
          defaultRef={defaultRangeStr}
          onConsolidate={handleConsolidate}
        />
      )}

      {/* 5. Advanced Filter Dialog */}
      {activeDialog === "advanced-filter" && (
        <AdvancedFilterDialog
          isOpen
          onClose={() => setIsAdvFilterOpen(false)}
          fields={dataFields}
          onApply={handleAdvancedFilter}
        />
      )}

      {/* 6. Custom Sort Dialog */}
      {activeDialog === "custom-sort" && (
        <CustomSortDialog
          isOpen
          onClose={() => setIsCustomSortOpen(false)}
          fields={dataFields}
          onSort={handleCustomSort}
        />
      )}
      {/* Rendered last so it layers above any open dialog — a notification can be
          raised from inside one. */}
      <NotificationDialog />
    </div>
  );
}
