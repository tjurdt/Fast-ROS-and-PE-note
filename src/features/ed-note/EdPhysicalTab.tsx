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
import { Chip, PeRow, type EdFindingChange } from "./ed-controls";

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
      <section className="v2-card ed-panel">
        <p className="v2-empty">請先到「問題」分頁選擇病人的主訴。</p>
      </section>
    );
  }
  const sections = buildPhysical(problems);
  const sectionFields = new Set<EdPeField>(sections.map((section) => section.field));
  const otherFields = PE_FIELD_ORDER.filter((field) => !sectionFields.has(field));

  const extraRow = (field: EdPeField) => (
    <div className="ed-row" key={`extra-${field}`}>
      <span className="ed-row__label">補充（自由輸入）</span>
      <span className="ed-row__controls">
        <input
          aria-label={`${PE_FIELD_LABELS[field]} 補充（自由輸入）`}
          onChange={(event) =>
            onChange(edKey.peExtra(field), { text: event.target.value })
          }
          placeholder="題庫沒有的所見，例如：L leg 2×3 cm erythematous patch"
          value={findings[edKey.peExtra(field)]?.text ?? ""}
        />
      </span>
    </div>
  );

  const unexamined = (items: readonly PhysicalItem[]) =>
    items.filter((item) => !findings[edKey.pe(item.id)]?.sel);
  const markNormal = (items: readonly PhysicalItem[]) => {
    const patch: Record<string, FindingValue> = {};
    for (const item of unexamined(items)) patch[edKey.pe(item.id)] = { sel: "normal" };
    if (Object.keys(patch).length > 0) onBulkChange(patch);
  };
  const allCore = sections.flatMap((section) => section.core);

  const renderRow = (entry: PhysicalItem) => {
    const item = peItem(entry.id);
    if (!item) return null;
    return (
      <PeRow
        finding={findings[edKey.pe(entry.id)] ?? {}}
        item={item}
        key={entry.id}
        must={entry.must}
        onChange={(next) => onChange(edKey.pe(entry.id), next)}
        reasons={entry.reasons}
      />
    );
  };

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-pe-title">
      <h2 id="ed-pe-title">理學檢查（依病歷欄位合併）</h2>
      <p className="ed-help">
        只會寫進「有按正常／異常」的項目，沒檢查的不會用套版充數。
      </p>
      <div className="ed-chips">
        <Chip active={false} onClick={() => markNormal(allCore)}>
          未檢查的核心項目全部標正常
        </Chip>
      </div>
      {sections.map((section) => (
        <div
          className="ed-block"
          data-testid={`ed-pe-field-${section.field}`}
          key={section.field}
        >
          <h3>
            {PE_FIELD_LABELS[section.field]}
            {unexamined(section.core).length > 0 ? (
              <button
                className="ed-link"
                onClick={() => markNormal(section.core)}
                type="button"
              >
                此欄全正常
              </button>
            ) : null}
          </h3>
          {section.core.map(renderRow)}
          {section.more.length > 0 ? (
            <details className="ed-more">
              <summary>視情況再做（{section.more.length}）</summary>
              {section.more.map(renderRow)}
            </details>
          ) : null}
          {extraRow(section.field)}
        </div>
      ))}
      {otherFields.length > 0 ? (
        <details className="ed-more" open={sections.length === 0}>
          <summary>其他 PE 欄位自由補充（{otherFields.length}）</summary>
          {otherFields.map((field) => (
            <div className="ed-block" key={field}>
              <h3>{PE_FIELD_LABELS[field]}</h3>
              {extraRow(field)}
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}
