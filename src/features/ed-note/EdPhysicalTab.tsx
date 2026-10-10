import type { FindingValue } from "../../domain/clinical/finding";
import {
  buildPhysical,
  selectedProblems,
  type EdFindings,
  type PhysicalItem,
} from "../../domain/ed/compose";
import { selectedComplaints } from "../../domain/ed/complaints";
import { PE_FIELD_LABELS, PE_FIELD_ORDER, peItem } from "../../domain/ed/pe-library";
import { edKey, type EdPeField } from "../../domain/ed/types";
import { PeGrid, type EdFindingChange } from "./ed-controls";

/** 格子裡放得下的欄位短名。 */
const PE_SHORT: Readonly<Record<EdPeField, string>> = {
  GC: "GC",
  HEENT: "HEENT",
  NECK: "NECK",
  CHEST: "CHEST",
  ABD: "ABD",
  BACK: "BACK",
  GU: "GU",
  RECTAL: "RECTAL",
  EXT: "EXT",
  NEURO: "NEURO",
};

interface EdPhysicalTabProps {
  findings: EdFindings;
  onChange: EdFindingChange;
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

export function EdPhysicalTab({
  findings,
  onChange,
  onBulkChange,
}: EdPhysicalTabProps) {
  const problems = selectedProblems(findings);
  if (selectedComplaints(findings).length === 0) {
    return (
      <section className="ed-panel">
        <p className="v2-empty">請先到「問題」分頁選擇病人的主訴。</p>
      </section>
    );
  }
  const sections = buildPhysical(problems);
  const moreSections = sections.filter((section) => section.more.length > 0);
  const moreCount = moreSections.reduce((n, section) => n + section.more.length, 0);

  const extraText = (field: EdPeField) => findings[edKey.peExtra(field)]?.text ?? "";
  const extraInput = (field: EdPeField) => (
    <label className="ed-line" key={`extra-${field}`}>
      <span>{PE_SHORT[field]}</span>
      <input
        aria-label={`${PE_FIELD_LABELS[field]} 補充（自由輸入）`}
        onChange={(event) =>
          onChange(edKey.peExtra(field), { text: event.target.value })
        }
        placeholder="題庫沒有的所見"
        value={extraText(field)}
      />
    </label>
  );

  const unexamined = (items: readonly PhysicalItem[]) =>
    items.filter((item) => !findings[edKey.pe(item.id)]?.sel);
  const markNormal = (items: readonly PhysicalItem[]) => {
    const patch: Record<string, FindingValue> = {};
    for (const item of unexamined(items)) patch[edKey.pe(item.id)] = { sel: "normal" };
    if (Object.keys(patch).length > 0) onBulkChange(patch);
  };
  const allCore = sections.flatMap((section) => section.core);

  // 欄位名佔一格；點欄位名＝此欄未查的全部標正常。
  const fieldLabel = (field: EdPeField, items: readonly PhysicalItem[]) => (
    <button
      aria-label={`${PE_FIELD_LABELS[field]} 此欄全正常`}
      className="ed-grid__label ed-grid__label--btn"
      onClick={() => markNormal(items)}
      title="此欄未查的全部標正常"
      type="button"
    >
      {PE_SHORT[field]}
      <small>全✓</small>
    </button>
  );
  const grid = (
    key: string,
    list: readonly { field: EdPeField; items: readonly PhysicalItem[] }[],
  ) => (
    <PeGrid
      finding={(id) => findings[edKey.pe(id)] ?? {}}
      groups={list
        .filter((entry) => entry.items.length > 0)
        .map((entry) => ({
          key: `${key}.${entry.field}`,
          label: fieldLabel(entry.field, entry.items),
          entries: entry.items,
        }))}
      item={peItem}
      onChange={(id, next) => onChange(edKey.pe(id), next)}
    />
  );
  const anyExtra = PE_FIELD_ORDER.some((field) => extraText(field) !== "");

  return (
    <section className="ed-panel" aria-labelledby="ed-pe-title">
      <div className="ed-bar">
        <h2 id="ed-pe-title">PE</h2>
        <span className="ed-hint">點一下＝正常，再點＝異常</span>
        <button className="ed-cycle" onClick={() => markNormal(allCore)} type="button">
          未查全正常
        </button>
      </div>
      <div className="ed-sec" data-testid="ed-pe-core">
        {grid(
          "core",
          sections.map((section) => ({ field: section.field, items: section.core })),
        )}
      </div>
      {moreCount > 0 ? (
        <details className="ed-tri" data-testid="ed-pe-more">
          <summary>視情況再做（{moreCount}）</summary>
          <div className="ed-sec">
            {grid(
              "more",
              moreSections.map((section) => ({
                field: section.field,
                items: section.more,
              })),
            )}
          </div>
        </details>
      ) : null}
      <details className="ed-tri" open={anyExtra || sections.length === 0}>
        <summary>各欄自由補充</summary>
        {PE_FIELD_ORDER.map((field) => extraInput(field))}
      </details>
    </section>
  );
}
