# DawnGrid 状态管理重构方案（zustand + 目录重组 + 组件拆分）

## 现状

| 项 | 数值 |
|---|---|
| `App.tsx` | 3517 行 |
| `useState` | 51 |
| `useCallback` / `useMemo` | 4 / 3 |
| `React.memo` | 0 |
| `handleRibbonCommand` 单函数 | **1688 行**（占 App 一半） |
| `Ribbon.tsx` | 2651 行，未 memo，接收 25 个 props |
| 渲染的对话框 | 21 个，全部无条件挂载 |

核心问题：所有状态集中在根组件，任一 state 变化重建整棵树。传给 `Ribbon` 的
25 个 props 中，十几个是每次渲染新建的函数引用，外加 `definedNames.map(...)`
新数组，因此即便加 `memo` 也无法命中。

---

## 目标

1. 状态迁入 zustand，组件按需订阅，消除无关重渲染
2. 按 Ribbon 功能域重组目录，沿用已有 `charts/`、`formular/` 的约定
3. 新增 `shared/` 存放公用组件与能力
4. 拆分 `App.tsx`，保持功能行为不变

---

## 目录结构

沿用现有 `charts/` + `formular/`（功能目录 + `index.ts` barrel export）的模式。
功能域边界取自 Ribbon 的 7 个标签页。

```
src/
├─ App.tsx                    ~200 行，仅 Univer 初始化与布局
├─ main.tsx
├─ Ribbon.tsx                 保留在根（跨所有域的容器）
│
├─ store/                     【新增】zustand
│  ├─ index.ts                barrel + 组合后的 useStore
│  ├─ selectionSlice.ts
│  ├─ viewSlice.ts
│  ├─ documentSlice.ts
│  ├─ chartSlice.ts
│  └─ dialogSlice.ts
│
├─ shared/                    【新增】公用组件与能力
│  ├─ index.ts
│  ├─ MenuSelect.tsx              ← 从 src/ 移入
│  ├─ ribbon-icons.tsx            ← 从 src/ 移入
│  ├─ useCssTransitionMount.ts    ← 从 charts/ 移入
│  ├─ AiAssistantModal.tsx        ← 从 src/ 移入（跨域）
│  ├─ WorkbookStatsModal.tsx      ← 从 src/ 移入（文件级）
│  ├─ selection-format.ts         ← 从 src/ 移入
│  ├─ system-fonts.ts             ← 从 src/ 移入
│  ├─ types.ts                    ← 从 src/ 移入
│  ├─ create-univer.ts            ← 从 src/ 移入
│  └─ univer-adapter.ts           ← 从 src/ 移入
│
├─ home/                      【新增】Ribbon「开始」
│  ├─ index.ts
│  ├─ FormatCellsDialog.tsx       ← 从 src/ 移入
│  ├─ GoToDialog.tsx              ← 从 src/ 移入
│  └─ useFormatCommands.ts        ← 从 handleRibbonCommand 拆出
│
├─ insert/                    【新增】Ribbon「插入」
│  ├─ index.ts
│  ├─ PivotDialog.tsx             ← 从 src/ 移入
│  ├─ HeaderFooterDialog.tsx      ← 从 src/ 移入
│  ├─ SymbolDialog.tsx            ← 从 src/ 移入
│  └─ useInsertCommands.ts        ← 从 handleRibbonCommand 拆出
│
├─ data/                      【新增】Ribbon「数据」
│  ├─ index.ts
│  ├─ GoalSeekDialog.tsx          ← 从 src/ 移入
│  ├─ SubtotalDialog.tsx          ← 从 src/ 移入
│  ├─ ConsolidateDialog.tsx       ← 从 src/ 移入
│  ├─ AdvancedFilterDialog.tsx    ← 从 src/ 移入
│  ├─ CustomSortDialog.tsx        ← 从 src/ 移入
│  └─ useDataCommands.ts          ← 从 handleRibbonCommand 拆出
│
├─ review/                    【新增】Ribbon「审阅」
│  ├─ index.ts
│  ├─ AllowEditRangesDialog.tsx   ← 从 src/ 移入
│  └─ useReviewCommands.ts        ← 从 handleRibbonCommand 拆出
│
├─ view/                      【新增】Ribbon「视图」+「页面布局」
│  ├─ index.ts
│  └─ useViewCommands.ts          ← 从 handleRibbonCommand 拆出
│
├─ formular/                  【已存在】Ribbon「公式」
│  ├─ index.ts                    （补充新增导出）
│  ├─ WatchWindowDialog.tsx       （已在位）
│  ├─ InsertFunctionDialog.tsx    ← 从 src/ 移入
│  ├─ NameManagerDialog.tsx       ← 从 src/ 移入
│  ├─ useFormulaCommands.ts       ← 从 handleRibbonCommand 拆出
│  └─ （autoSum / catalog / definedNames / formulaAudit / calculation 等已在位）
│
├─ charts/                    【已存在】Ribbon「图表设计」
│  ├─ index.ts                    （移除 useCssTransitionMount 导出）
│  └─ （4 个对话框与渲染器均已在位）
│
├─ file/                      【新增】文件操作（非 Ribbon 标签页，但独立域）
│  ├─ index.ts
│  └─ useFileCommands.ts          ← 打开/保存/另存/CSV/新建
│
└─ layout/                    【新增】拆出的布局组件
   ├─ index.ts
   ├─ RibbonContainer.tsx         订阅 store，memo 包裹 Ribbon
   ├─ GridArea.tsx                Univer 容器 + ChartOverlay
   └─ DialogHost.tsx              按 activeDialog 条件渲染 21 个对话框
```

**需删除**：`src/RecommendedChartsDialog.tsx`（4 行的重复文件，
实际实现在 `charts/RecommendedChartsDialog.tsx`）

---

## 状态分组（51 个 state → 5 个 slice）

| Slice | 内容 | 数量 | 变化频率 |
|---|---|---|---|
| `selectionSlice` | `selectionFormat`、`lastActiveCellAddress` | 2 | **每次点击** |
| `viewSlice` | `showGridlines`、`showHeadings`、`formulaBarVisible`、`crossHighlightVisible`、`pageBreakPreview`、`printGridlines`、`printHeadings`、`sheetProtected`、`workbookProtected`、`calcManual` | 10 | 低 |
| `documentSlice` | `currentFile`、`metadata`、`status`、`loading`、`activeSheetId`、`definedNames` | 6 | 中 |
| `chartSlice` | `charts`、`activeChartId`、`selectedChart`、`recommendedData` | 4 | 中 |
| `dialogSlice` | 21 个 `isXxxOpen` → 单个 `activeDialog: DialogId \| null`，外加载荷（`insertFuncCategory`、`dataFields`、`defaultRangeStr`、`watchList`、`headerFooterData`、`allowEditRanges`、`statsData`、`analysisSummary`、`diagnosticResult`） | 21 → 1 + 9 | 低 |

对话框由无条件挂载改为条件渲染：`{activeDialog === 'pivot' && <PivotDialog/>}`，
未打开的对话框不再创建 JSX。

---

## 对话框归属依据

查 Ribbon 各命令实际所在标签页得出：

| 对话框 | 标签页 | 目录 |
|---|---|---|
| `InsertFunctionDialog`、`NameManagerDialog`、`WatchWindowDialog` | 公式 | `formular/` |
| `PivotDialog`、`HeaderFooterDialog`、`SymbolDialog` | 插入 | `insert/` |
| `GoalSeekDialog`、`SubtotalDialog`、`ConsolidateDialog`、`AdvancedFilterDialog`、`CustomSortDialog` | 数据 | `data/` |
| `AllowEditRangesDialog` | 审阅 | `review/` |
| `FormatCellsDialog`、`GoToDialog` | 开始 | `home/` |
| 图表 4 个对话框 | 图表设计 | `charts/` |
| `AiAssistantModal`、`WorkbookStatsModal` | 跨域 | `shared/` |

---

## 执行阶段（每阶段独立提交，可单独回滚）

**阶段 0a — 目录搭建与文件归位**（委派 Haiku，我审 diff）
- 建 `store/`、`shared/`、`home/`、`insert/`、`data/`、`review/`、`view/`、
  `file/`、`layout/` 目录与 `index.ts`
- 21 个组件按上表归位，更新 import 路径
- 删除 `src/RecommendedChartsDialog.tsx`（重复文件）
- `Ribbon.tsx` 保留在 `src/` 根目录（跨全部 7 个标签页的容器）

不改任何逻辑，只动位置。闸门：`tsc --noEmit` 通过。

**阶段 0b — 测试基建**（委派 Sonnet，可与 0a 并行，无文件冲突）
- 安装 `vitest` + `@testing-library/react` + `happy-dom`
- 复用 `vite.config` 建测试配置，加 `test` / `test:watch` npm script
- 写第一批纯函数单测：`normalizeHexColor`、`isSameSelectionFormat`、
  `parseAddress`、`columnLabel`、`columnIndex`、`parseRange`、
  `normalizeCategory`、`getColumnName`、`parseA1Notation`

闸门：测试全绿。

**阶段 0c — 基线测量**（我做）
安装 zustand；加渲染计数探针，记录重构前单击一次的 App 渲染次数与耗时。

**阶段 1 — 热路径（selection + view）**（我做实现，Sonnet 并行写 slice 测试）
迁移 12 个 state 到 store；拆出 `layout/RibbonContainer.tsx`，回调用
`useCallback` 稳定引用，`Ribbon` 加 `memo`。
做 DevTools Performance 录制，与阶段 0c 基线对比。

**阶段 2 — 对话框**（我做实现，Sonnet 并行写测试）
21 个 boolean 合并为 `activeDialog`；拆出 `layout/DialogHost.tsx`，改条件渲染。

**阶段 3 — document + chart**（我做实现，Sonnet 并行写测试）
迁移剩余 10 个 state；拆出 `layout/GridArea.tsx`。

**阶段 4 — 命令层拆分**（我做，含测试）
`handleRibbonCommand` 1688 行按域拆入各功能目录的 `useXxxCommands.ts`，
`handleRibbonCommand` 退化为薄分发层。

契约测试策略：不 mock 整个 Univer，而是给每个 hook 注入最小 `ctx` stub
（`{runtime, workbook, worksheet, range}`），断言"给定命令 ID 调用了预期的
Univer API"。覆盖拆分后最易出错的"分支路由是否等价"。

**此阶段不委派。** 规格成本高于执行成本——要让子代理正确拆分，需先把每个
命令分支的行为写成精确规格，工作量与直接拆相当；且 `tsc` 通过不代表行为等价。

**阶段 5 — 清理**（委派 Haiku）
移除渲染探针；`App.tsx` 收敛至约 200 行；补 README 说明 store 与目录结构。

---

## 委派原则

判断标准：**是否存在机械验证闸门**。

| 有闸门（可委派） | 无闸门（不委派） |
|---|---|
| 文件移动 → `tsc` | 状态迁移的副作用顺序依赖 |
| 纯函数测试 → 测试通过 | 1688 行命令分支的行为等价性 |
| 测试基建 → 测试能跑 | 组件读取哪些字段的判断 |

**文件分区约束**：`App.tsx` 是所有阶段的交汇点，多代理并行改同一文件会互相
覆盖。委派必须按文件分区。可行的并行组合是"实现与测试分离"——我改
`App.tsx` + store，Sonnet 同时写 `*.test.ts` 新文件，零冲突。

---

## 风险与验证

**风险**
- 阶段 0a 涉及 21 个文件移动，import 路径改动面广（有 `tsc` 兜底）
- 阶段 4 改动面最大，1688 行 if/switch 链拆分容易遗漏分支
- 21 个对话框改条件渲染后，依赖挂载副作用的对话框可能行为变化
- 命令处理器依赖大量闭包变量（`getTargetRange`、各 setter），拆成 hook
  需重新组织依赖

**测试可行性边界（实测后确认）**

Univer 挂载真实 DOM canvas（`App.tsx:622` 的 `container: "univer-container"`），
实例在 `useEffect` 内创建。测 `App` 或任何走 `getTargetRange()` 的命令处理器
都需 mock 整个 facade API，成本高且随 Univer 升版易碎。

| 层 | 可测性 | 对阶段 4 的兜底效力 |
|---|---|---|
| 纯函数 | 容易 | 低（本就不改） |
| store slice | 容易 | **高** |
| 对话框渲染 | 中 | 中 |
| 命令处理器 | 需 ctx stub | **高**（契约测试） |

**验证手段**
- 每阶段 `npx tsc --noEmit` 通过（`bun run build` 会跑 `tsc && vite build`）
- 每阶段 `bun run test` 全绿
- 每阶段结束手动回归：打开 `葛雯.xlsx`、切换单元格、开关若干对话框、
  执行一次保存
- 阶段 1 与阶段 5 各做一次 DevTools Performance 录制，对比渲染次数与耗时

