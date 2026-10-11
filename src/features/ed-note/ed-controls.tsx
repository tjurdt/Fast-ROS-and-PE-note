import type { ReactNode } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import { matrixKey, rowSelected, toggleMatrixKey } from "../../domain/ed/pe-matrix";
import { cyclePick, pickedOptions, togglePick } from "../../domain/ed/picks";
import {
  edKey,
  type HistoryItem,
  type HistoryPick,
  type PeItem,
  type PeMatrixRow,
} from "../../domain/ed/types";
import {
  HISTORY_SHORT,
  OPTION_SHORT,
  PE_SHORT_LABEL,
  SITE_SHORT,
  cellSpan,
  spanStyle,
} from "./short-labels";

export type EdFindingChange = (key: string, finding: FindingValue) => void;

/**
 * 選取型按鈕。文字超過約四個中文字時自動佔兩到三格（不在格子裡換行）；
 * span 可以手動指定（例如九宮格固定一格）。
 */
export function Chip({
  active,
  tone = "default",
  onClick,
  children,
  label,
  span,
  title,
}: {
  active: boolean;
  tone?: "default" | "positive" | "negative" | "warning";
  onClick: () => void;
  children: ReactNode;
  label?: string;
  span?: number | undefined;
  title?: string | undefined;
}) {
  const width = span ?? (typeof children === "string" ? cellSpan(children) : 1);
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`ed-chip ${active ? `is-active is-${tone}` : ""}`.trim()}
      onClick={onClick}
      style={spanStyle(width)}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

/** 一格的狀態：空白（未答）、陰性、陽性、PE 正常。 */
type CycleTone = "" | "neg" | "pos" | "ok";

/**
 * 循環按鈕：一個格子點一下換一個狀態，比「有／無」兩顆按鈕省一半空間。
 * 顯示短字；aria-label 用完整標籤＋狀態（方便輔助工具與測試）。
 */
export function CycleChip({
  label,
  display,
  mark,
  tone,
  must,
  stateLabel,
  title,
  testId,
  onClick,
}: {
  label: string;
  display?: string;
  mark: string;
  tone: CycleTone;
  must?: boolean;
  stateLabel: string;
  title?: string | undefined;
  testId?: string;
  onClick: () => void;
}) {
  const shown = display ?? label;
  return (
    <button
      aria-label={`${label}：${stateLabel}`}
      className={`ed-c ${tone ? `is-${tone}` : ""}`.trim()}
      data-state={stateLabel}
      data-testid={testId}
      onClick={onClick}
      style={spanStyle(cellSpan(shown))}
      title={title ?? (shown === label ? undefined : label)}
      type="button"
    >
      {must ? <span className="ed-must">★</span> : null}
      {shown}
      {mark ? <span className="ed-c__mark">{mark}</span> : null}
    </button>
  );
}

/** 循環順序：未答 → 有(POS) → 無(NEG) → 未答(NUL)。 */
export function nextYesNo(finding: FindingValue): FindingValue {
  if (finding.on === undefined) return { on: true };
  if (finding.on === true) return { ...finding, on: false };
  return {};
}

function reasonTitle(reasons: readonly string[]): string | undefined {
  return reasons.length > 1 ? `共用：${reasons.join("、")}` : undefined;
}

export interface GridEntry {
  id: string;
  must: boolean;
  reasons: readonly string[];
}

/**
 * 一段：段名（問題、系統或 PE 欄位）佔第一格，後面接該段的按鈕。
 * 不同段各自換行，不接在一起。
 */
export interface FlowGroup {
  key: string;
  /** 段名格；字串會包成標籤，也可以傳整個元素（例如可點的「此欄全正常」）。 */
  label?: ReactNode;
  entries: readonly GridEntry[];
}

function labelCell(group: FlowGroup): ReactNode {
  if (group.label === undefined) return null;
  if (typeof group.label === "string") {
    return (
      <span
        className="ed-grid__label ed-grid__label--group"
        style={spanStyle(cellSpan(group.label))}
      >
        {group.label}
      </span>
    );
  }
  return group.label;
}

export const historyShort = (item: HistoryItem) => HISTORY_SHORT[item.id] ?? item.label;
const optionShort = (item: HistoryPick, option: string) =>
  OPTION_SHORT[`${item.id}:${option}`] ?? option;

/** 腹部九宮格：3×3 按鈕，第十個以後（全腹）接在右邊。 */
function Grid9({ children, extra }: { children: ReactNode[]; extra: ReactNode[] }) {
  return (
    <>
      <span className="ed-grid9">{children.slice(0, 9)}</span>
      {extra.length > 0 ? <span className="ed-grid9__extra">{extra}</span> : null}
    </>
  );
}

/**
 * 一組問診題：每個題組一列（題組名＋有／無循環按鈕）；單選／複選題一列（題目＋選項）；
 * 文字題一行輸入。陽性且有細節快選的題目，細節放在下方一行。
 */
export function HistoryGrid({
  groups,
  item,
  finding,
  onChange,
}: {
  groups: readonly FlowGroup[];
  item: (id: string) => HistoryItem | undefined;
  finding: (id: string) => FindingValue;
  onChange: (id: string, next: FindingValue) => void;
}) {
  const yesNo: { entry: GridEntry; item: HistoryItem }[] = [];
  const rows: ReactNode[] = [];

  const chip = (entry: GridEntry, definition: HistoryItem) => {
    const current = finding(entry.id);
    const state = current.on === true ? "有" : current.on === false ? "無" : "未答";
    return (
      <CycleChip
        display={historyShort(definition)}
        key={entry.id}
        label={definition.label}
        mark={current.on === true ? "+" : current.on === false ? "−" : ""}
        must={entry.must}
        onClick={() => onChange(entry.id, nextYesNo(current))}
        stateLabel={state}
        testId={`ed-h-${entry.id}`}
        title={reasonTitle(entry.reasons)}
        tone={current.on === true ? "pos" : current.on === false ? "neg" : ""}
      />
    );
  };

  const pickRow = (entry: GridEntry, definition: HistoryPick): ReactNode => {
    const current = finding(entry.id);
    const chosen = new Set(
      pickedOptions({ [edKey.history(entry.id)]: current }, entry.id),
    );
    const optionShortOf = (label: string) => optionShort(definition, label);
    // 單選題：一個格子循環換選項（未選 → 選項1 → … → 未選）；複選題：一顆一顆分開點。
    const options = definition.multi
      ? definition.options.map((option) => (
          <Chip
            active={chosen.has(option.label)}
            key={option.label}
            label={`${definition.label}：${option.label}`}
            onClick={() =>
              onChange(entry.id, togglePick(definition, current, option.label))
            }
            span={definition.layout === "grid9" ? 1 : undefined}
            title={option.label}
            tone="warning"
          >
            {optionShortOf(option.label)}
          </Chip>
        ))
      : [
          <CycleChip
            display={
              [...chosen][0] === undefined ? "—" : optionShortOf([...chosen][0] ?? "")
            }
            key="cycle"
            label={definition.label}
            mark=""
            onClick={() => onChange(entry.id, cyclePick(definition, current))}
            stateLabel={[...chosen][0] ?? "未答"}
            testId={`ed-h-cycle-${entry.id}`}
            title={definition.options.map((option) => option.label).join(" → ")}
            tone={chosen.size > 0 ? "pos" : ""}
          />,
        ];
    const short = historyShort(definition);
    return (
      <div className="ed-grid" data-testid={`ed-h-${entry.id}`} key={entry.id}>
        <span
          className="ed-grid__label"
          style={spanStyle(cellSpan(short, entry.must ? 0.7 : 0))}
        >
          {entry.must ? <span className="ed-must">★</span> : null}
          {short}
          {definition.multi ? (
            <small className="ed-multi">複選</small>
          ) : (
            <small className="ed-multi">循環</small>
          )}
        </span>
        {definition.layout === "grid9" ? (
          <Grid9 extra={options.slice(9)}>{options}</Grid9>
        ) : (
          options
        )}
      </div>
    );
  };

  const textRow = (entry: GridEntry, definition: HistoryItem): ReactNode => (
    <label className="ed-line" data-testid={`ed-h-${entry.id}`} key={entry.id}>
      <span>
        {entry.must ? <span className="ed-must">★</span> : null}
        {historyShort(definition)}
      </span>
      <input
        aria-label={definition.label}
        onChange={(event) => onChange(entry.id, { text: event.target.value })}
        placeholder={definition.type === "text" ? (definition.placeholder ?? "") : ""}
        value={finding(entry.id).text ?? ""}
      />
    </label>
  );

  const groupRows: ReactNode[] = [];
  for (const group of groups) {
    const groupChips: ReactNode[] = [];
    for (const entry of group.entries) {
      const definition = item(entry.id);
      if (!definition) continue;
      if (definition.type === "yn") {
        yesNo.push({ entry, item: definition });
        groupChips.push(chip(entry, definition));
      } else if (definition.type === "pick") {
        rows.push(pickRow(entry, definition));
      } else {
        rows.push(textRow(entry, definition));
      }
    }
    if (groupChips.length > 0) {
      groupRows.push(
        <div className="ed-grid" key={`g-${group.key}`}>
          {labelCell(group)}
          {groupChips}
        </div>,
      );
    }
  }

  const details = yesNo.filter(
    ({ entry, item: definition }) =>
      definition.type === "yn" &&
      definition.detail !== undefined &&
      finding(entry.id).on === true,
  );

  return (
    <>
      {rows}
      {groupRows}
      {details.map(({ entry, item: definition }) => {
        if (definition.type !== "yn" || !definition.detail) return null;
        const current = finding(entry.id);
        return (
          <div
            className="ed-grid ed-grid--detail"
            data-testid={`ed-h-detail-${entry.id}`}
            key={`d-${entry.id}`}
          >
            <span className="ed-grid__label">{historyShort(definition)}</span>
            {(definition.detail.chips ?? []).map((chipText) => (
              <Chip
                active={current.text === chipText}
                key={chipText}
                onClick={() =>
                  onChange(entry.id, {
                    ...current,
                    text: current.text === chipText ? "" : chipText,
                  })
                }
              >
                {chipText}
              </Chip>
            ))}
            <input
              aria-label={`${definition.label} 細節`}
              className="ed-grid__input"
              onChange={(event) =>
                onChange(entry.id, { ...current, text: event.target.value })
              }
              placeholder={definition.detail.placeholder ?? "細節"}
              value={current.text ?? ""}
            />
          </div>
        );
      })}
    </>
  );
}

/** 矩陣型所見裡，一個已選類型的變化型與部位按鈕（獨立一行，整行跨滿格子）。 */
function MatrixDetail({
  current,
  row,
  sites,
  onChange,
  testId,
}: {
  current: FindingValue;
  row: PeMatrixRow;
  sites: readonly string[];
  onChange: (next: FindingValue) => void;
  testId: string;
}) {
  const variants = row.variants ?? [];
  return (
    <div className="ed-matrix" data-testid={testId}>
      <span className="ed-matrix__label">{row.label}</span>
      {variants.map((variant) => (
        <Chip
          active={current.fu?.[matrixKey.variant(row, variant)] === "1"}
          key={`v-${variant}`}
          label={`${row.label}：${variant}`}
          onClick={() =>
            onChange(toggleMatrixKey(current, matrixKey.variant(row, variant)))
          }
          tone="positive"
        >
          {variant}
        </Chip>
      ))}
      {row.noSites
        ? null
        : sites.map((site) => (
            <Chip
              active={current.fu?.[matrixKey.site(row, site)] === "1"}
              key={`s-${site}`}
              label={`${row.label}：${site}`}
              onClick={() =>
                onChange(toggleMatrixKey(current, matrixKey.site(row, site)))
              }
              tone="warning"
            >
              {site}
            </Chip>
          ))}
    </div>
  );
}

/** PE 循環：未查 → 正常 → 異常 → 未查。 */
export function nextPe(finding: FindingValue): FindingValue {
  if (finding.sel === "normal") return { ...finding, sel: "abn" };
  if (finding.sel === "abn") return {};
  return { sel: "normal" };
}

export const peShort = (item: PeItem) => PE_SHORT_LABEL[item.id] ?? item.label;

/** PE：每個欄位一列（欄位名＋循環按鈕）；異常的項目，快選（可複選）與補充放在下方。 */
export function PeGrid({
  groups,
  item,
  finding,
  onChange,
}: {
  groups: readonly FlowGroup[];
  item: (id: string) => PeItem | undefined;
  finding: (id: string) => FindingValue;
  onChange: (id: string, next: FindingValue) => void;
}) {
  const resolve = (entries: readonly GridEntry[]) =>
    entries
      .map((entry) => ({ entry, item: item(entry.id) }))
      .filter(
        (row): row is { entry: GridEntry; item: PeItem } => row.item !== undefined,
      );
  const visible = groups.flatMap((group) => resolve(group.entries));
  if (visible.length === 0) return null;
  const abnormal = visible.filter(({ entry }) => finding(entry.id).sel === "abn");

  const chip = (entry: GridEntry, definition: PeItem) => {
    const current = finding(entry.id);
    const state =
      current.sel === "normal" ? "正常" : current.sel === "abn" ? "異常" : "未查";
    return (
      <CycleChip
        display={peShort(definition)}
        key={entry.id}
        label={definition.label}
        mark={current.sel === "normal" ? "✓" : current.sel === "abn" ? "!" : ""}
        must={entry.must}
        onClick={() => onChange(entry.id, nextPe(current))}
        stateLabel={state}
        testId={`ed-pe-${entry.id}`}
        title={
          current.sel === "normal" ? definition.normal : reasonTitle(entry.reasons)
        }
        tone={current.sel === "normal" ? "ok" : current.sel === "abn" ? "pos" : ""}
      />
    );
  };

  return (
    <>
      {groups.map((group) => {
        const rows = resolve(group.entries);
        if (rows.length === 0) return null;
        return (
          <div className="ed-grid" key={group.key}>
            {labelCell(group)}
            {rows.map(({ entry, item: definition }) => chip(entry, definition))}
          </div>
        );
      })}
      {abnormal.map(({ entry, item: definition }) => {
        const current = finding(entry.id);
        const chosen = current.fu ?? {};
        const phrases = definition.abnormal.map((phrase) => (
          <Chip
            active={chosen[phrase] === "1"}
            key={phrase}
            label={phrase}
            onClick={() =>
              onChange(entry.id, {
                ...current,
                fu: { ...chosen, [phrase]: chosen[phrase] === "1" ? "0" : "1" },
              })
            }
            span={definition.layout === "grid9" ? 1 : undefined}
            title={phrase}
            tone="warning"
          >
            {definition.layout === "grid9" ? (SITE_SHORT[phrase] ?? phrase) : phrase}
          </Chip>
        ));
        return (
          <div
            className="ed-grid ed-grid--detail"
            data-testid={`ed-pe-detail-${entry.id}`}
            key={`d-${entry.id}`}
          >
            <span className="ed-grid__label">{peShort(definition)}</span>
            {definition.layout === "grid9" ? (
              <Grid9 extra={phrases.slice(9)}>{phrases}</Grid9>
            ) : (
              phrases
            )}
            {definition.matrix
              ? definition.matrix.rows.map((row) => (
                  <Chip
                    active={rowSelected(current, row)}
                    key={`m-${row.label}`}
                    label={`${definition.label}：${row.label}`}
                    onClick={() =>
                      onChange(
                        entry.id,
                        toggleMatrixKey(current, matrixKey.row(row), row),
                      )
                    }
                    title={row.text}
                    tone="warning"
                  >
                    {row.label}
                  </Chip>
                ))
              : null}
            <input
              aria-label={`${definition.label} 補充`}
              className="ed-grid__input"
              onChange={(event) =>
                onChange(entry.id, { ...current, note: event.target.value })
              }
              placeholder="補充（例 MP: LA 4）"
              value={current.note ?? ""}
            />
            {definition.matrix
              ? definition.matrix.rows
                  .filter((row) => rowSelected(current, row))
                  .map((row) => (
                    <MatrixDetail
                      current={current}
                      key={`md-${row.label}`}
                      onChange={(next) => onChange(entry.id, next)}
                      row={row}
                      sites={definition.matrix?.sites ?? []}
                      testId={`ed-pe-matrix-${entry.id}`}
                    />
                  ))
              : null}
          </div>
        );
      })}
    </>
  );
}

/** 循環選單（例如問診深度）：點一下換下一個選項。 */
export function CycleSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const index = options.findIndex((option) => option.value === value);
  const current = options[index] ?? options[0];
  const next = options[(index + 1) % options.length] ?? options[0];
  return (
    <button
      aria-label={`${label}：${current?.label ?? ""}`}
      className="ed-cycle"
      onClick={() => next && onChange(next.value)}
      type="button"
    >
      {label} {current?.label} ⟳
    </button>
  );
}
