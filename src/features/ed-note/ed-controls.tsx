import { Fragment, type ReactNode } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import type { HistoryItem, PeItem } from "../../domain/ed/types";

export type EdFindingChange = (key: string, finding: FindingValue) => void;

export function Chip({
  active,
  tone = "default",
  onClick,
  children,
  label,
}: {
  active: boolean;
  tone?: "default" | "positive" | "negative" | "warning";
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`ed-chip ${active ? `is-active is-${tone}` : ""}`.trim()}
      onClick={onClick}
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
 * 文字後面的小標記顯示目前狀態；aria-label 帶狀態，方便輔助工具與測試。
 */
export function CycleChip({
  label,
  mark,
  tone,
  must,
  stateLabel,
  title,
  testId,
  onClick,
}: {
  label: string;
  mark: string;
  tone: CycleTone;
  must?: boolean;
  stateLabel: string;
  title?: string | undefined;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={`${label}：${stateLabel}`}
      className={`ed-c ${tone ? `is-${tone}` : ""}`.trim()}
      data-state={stateLabel}
      data-testid={testId}
      onClick={onClick}
      title={title}
      type="button"
    >
      {must ? <span className="ed-must">★</span> : null}
      {label}
      {mark ? <span className="ed-c__mark">{mark}</span> : null}
    </button>
  );
}

/** 循環順序：未答 → 無 → 有 → 未答（急診問診大多是陰性，先給陰性）。 */
export function nextYesNo(finding: FindingValue): FindingValue {
  if (finding.on === undefined) return { on: false };
  if (finding.on === false) return { ...finding, on: true };
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
 * 同一個格子裡的一段：段名（系統或 PE 欄位）佔第一格，後面接該段的按鈕。
 * 多段接在同一個格子裡流動排列，不必每段各佔一行標題。
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
      <span className="ed-grid__label ed-grid__label--group" key={`l-${group.key}`}>
        {group.label}
      </span>
    );
  }
  return <Fragment key={`l-${group.key}`}>{group.label}</Fragment>;
}

/**
 * 一組問診題：有／無題排成循環按鈕格子；單選題是一列（題目＋選項）；文字題是一行輸入。
 * 陽性且有細節快選的題目，細節放在格子下方一行。
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
  const cells: ReactNode[] = [];
  const rows: ReactNode[] = [];

  const chip = (entry: GridEntry, definition: HistoryItem) => {
    const current = finding(entry.id);
    const state = current.on === true ? "有" : current.on === false ? "無" : "未答";
    return (
      <CycleChip
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

  const otherRow = (entry: GridEntry, definition: HistoryItem): ReactNode => {
    const current = finding(entry.id);
    if (definition.type === "pick") {
      return (
        <div className="ed-grid" data-testid={`ed-h-${entry.id}`} key={entry.id}>
          <span className="ed-grid__label">
            {entry.must ? <span className="ed-must">★</span> : null}
            {definition.label}
          </span>
          {definition.options.map((option) => (
            <Chip
              active={current.sel === option.label}
              key={option.label}
              label={`${definition.label}：${option.label}`}
              onClick={() =>
                onChange(
                  entry.id,
                  current.sel === option.label ? {} : { sel: option.label },
                )
              }
              tone="warning"
            >
              {option.label}
            </Chip>
          ))}
        </div>
      );
    }
    return (
      <label className="ed-line" data-testid={`ed-h-${entry.id}`} key={entry.id}>
        <span>
          {entry.must ? <span className="ed-must">★</span> : null}
          {definition.label}
        </span>
        <input
          aria-label={definition.label}
          onChange={(event) => onChange(entry.id, { text: event.target.value })}
          placeholder={definition.type === "text" ? (definition.placeholder ?? "") : ""}
          value={current.text ?? ""}
        />
      </label>
    );
  };

  for (const group of groups) {
    const groupChips: ReactNode[] = [];
    for (const entry of group.entries) {
      const definition = item(entry.id);
      if (!definition) continue;
      if (definition.type === "yn") {
        yesNo.push({ entry, item: definition });
        groupChips.push(chip(entry, definition));
      } else {
        rows.push(otherRow(entry, definition));
      }
    }
    if (groupChips.length > 0) cells.push(labelCell(group), ...groupChips);
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
      {cells.length > 0 ? <div className="ed-grid">{cells}</div> : null}
      {details.map(({ entry, item: definition }) => {
        if (definition.type !== "yn" || !definition.detail) return null;
        const current = finding(entry.id);
        return (
          <div
            className="ed-grid ed-grid--detail"
            data-testid={`ed-h-detail-${entry.id}`}
            key={`d-${entry.id}`}
          >
            <span className="ed-grid__label">{definition.label}</span>
            {(definition.detail.chips ?? []).map((chip) => (
              <Chip
                active={current.text === chip}
                key={chip}
                onClick={() =>
                  onChange(entry.id, {
                    ...current,
                    text: current.text === chip ? "" : chip,
                  })
                }
              >
                {chip}
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

/** PE 循環：未查 → 正常 → 異常 → 未查。 */
export function nextPe(finding: FindingValue): FindingValue {
  if (finding.sel === "normal") return { ...finding, sel: "abn" };
  if (finding.sel === "abn") return {};
  return { sel: "normal" };
}

/** 一組 PE：循環按鈕格子；異常的項目，快選與補充放在格子下方。 */
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

  const cells: ReactNode[] = [];
  for (const group of groups) {
    const rows = resolve(group.entries);
    if (rows.length === 0) continue;
    cells.push(
      labelCell(group),
      ...rows.map(({ entry, item: definition }) => chip(entry, definition)),
    );
  }

  return (
    <>
      <div className="ed-grid">{cells}</div>
      {abnormal.map(({ entry, item: definition }) => {
        const current = finding(entry.id);
        const chosen = current.fu ?? {};
        return (
          <div
            className="ed-grid ed-grid--detail"
            data-testid={`ed-pe-detail-${entry.id}`}
            key={`d-${entry.id}`}
          >
            <span className="ed-grid__label">{definition.label}</span>
            {definition.abnormal.map((phrase) => (
              <Chip
                active={chosen[phrase] === "1"}
                key={phrase}
                onClick={() =>
                  onChange(entry.id, {
                    ...current,
                    fu: { ...chosen, [phrase]: chosen[phrase] === "1" ? "0" : "1" },
                  })
                }
                tone="warning"
              >
                {phrase}
              </Chip>
            ))}
            <input
              aria-label={`${definition.label} 補充`}
              className="ed-grid__input"
              onChange={(event) =>
                onChange(entry.id, { ...current, note: event.target.value })
              }
              placeholder="補充（例 MP: LA 4）"
              value={current.note ?? ""}
            />
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
