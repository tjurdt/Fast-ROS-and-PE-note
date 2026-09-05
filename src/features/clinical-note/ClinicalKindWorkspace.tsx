import { useState } from "react";

import {
  buildClinicalView,
  hasFinding,
  type ClinicalViewSection,
} from "../../domain/clinical/clinical-rules";
import type { FindingValue, Patient } from "../../domain/patient";
import { ClinicalItem } from "./ClinicalItem";

/** Splits "中文 English" labels so the Chinese half can render larger than the
 * English half. Falls back to treating the whole label as the English half
 * when there is no bilingual space (e.g. a label with no English at all). */
function splitBilingualLabel(label: string): { zh: string; en: string } {
  const match = /^(.+?)\s+([A-Za-z].*)$/.exec(label);
  return { zh: match?.[1] ?? "", en: match?.[2] ?? label };
}

/** Focus section labels ("★ Focus ROS（重點問診）") read English-first with a
 * trailing Chinese annotation -- the opposite order of every other section
 * label -- so the generic split above would put the star alone on its own
 * large line and wrap "Focus ROS（重點問診）" as the small line. Building the
 * two halves directly from section.kind keeps the same "large 中文 / small
 * English" convention as every other tab instead. */
function focusLabelParts(kind: "ROS" | "PE"): { zh: string; en: string } {
  return {
    zh: kind === "ROS" ? "重點問診" : "重點PE",
    en: `★ Focus ${kind}`,
  };
}

/** Presentation-only short labels for sections whose frozen-legacy catalog
 * label is too long for the compact tile grid. The catalog data itself is
 * left byte-for-byte matched to the legacy oracle (check:clinical-catalog). */
const SHORT_SECTION_LABELS: Record<string, string> = {
  pe_general: "外觀徵象 General",
};

function BilingualLabel({
  label,
  focusKind,
}: {
  label: string;
  focusKind: "ROS" | "PE" | undefined;
}) {
  const { zh, en } = focusKind
    ? focusLabelParts(focusKind)
    : splitBilingualLabel(label);
  return (
    <>
      {zh ? (
        <>
          <span className="v2-bilingual__zh">{zh}</span>{" "}
        </>
      ) : null}
      <span className="v2-bilingual__en">{en}</span>
    </>
  );
}

function KindTabs({
  kind,
  sections,
  patient,
  activeKey,
  onSelect,
}: {
  kind: "ROS" | "PE";
  sections: ClinicalViewSection[];
  patient: Patient;
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="v2-clinical-tabs">
      {sections.map((section) => {
        const count = section.items.filter((item) =>
          hasFinding(item, patient.findings[item.id]),
        ).length;
        const isActive = activeKey === section.key;
        return (
          <button
            aria-pressed={isActive}
            className={`v2-clinical-tab v2-clinical-tab--${kind.toLowerCase()} ${isActive ? "is-active" : ""} ${section.focus ? "is-focus" : ""}`}
            data-clinical-section={section.key}
            key={section.key}
            onClick={() => onSelect(section.key)}
            type="button"
          >
            {count > 0 ? (
              <span aria-hidden="true" className="v2-clinical-tab__badge">
                {count}
              </span>
            ) : null}
            <BilingualLabel
              focusKind={section.focus ? section.kind : undefined}
              label={section.label}
            />
          </button>
        );
      })}
    </div>
  );
}

interface ClinicalKindWorkspaceProps {
  kind: "ROS" | "PE";
  patient: Patient;
  onFindingChange: (itemId: string, finding: FindingValue) => void;
  onBlockNoteChange: (sectionKey: string, note: string) => void;
}

/** One kind's (ROS or PE) row of section tabs plus the single panel below
 * them that shows whichever tab is active. Each kind gets its own instance
 * of this component (see App.tsx), so ROS and PE keep independent "which
 * section is open" state rather than sharing one across both. */
export function ClinicalKindWorkspace({
  kind,
  patient,
  onFindingChange,
  onBlockNoteChange,
}: ClinicalKindWorkspaceProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const sections = buildClinicalView(patient)
    .filter((section) => section.kind === kind && section.items.length > 0)
    .map((section) => {
      const short = SHORT_SECTION_LABELS[section.key];
      return short ? { ...section, label: short } : section;
    });
  const total = sections.reduce(
    (sum, section) =>
      sum +
      section.items.filter((item) => hasFinding(item, patient.findings[item.id]))
        .length,
    0,
  );
  const activeSection = sections.find((section) => section.key === activeKey) ?? null;
  const activeBlockNote = activeSection
    ? (patient.blockNotes[activeSection.key] ?? "")
    : "";
  const isNoteOpen = activeSection
    ? (noteOpen[activeSection.key] ?? activeBlockNote.trim().length > 0)
    : false;

  function selectSection(key: string) {
    setActiveKey((current) => (current === key ? null : key));
  }

  return (
    <section
      className={`v2-clinical v2-clinical--${kind.toLowerCase()}`}
      aria-labelledby={`v2-clinical-title-${kind.toLowerCase()}`}
    >
      <div className="v2-clinical-summary">
        <h2 id={`v2-clinical-title-${kind.toLowerCase()}`}>{kind}</h2>
        <strong data-testid="finding-total">陽性／異常 {total}</strong>
      </div>

      <KindTabs
        activeKey={activeKey}
        kind={kind}
        onSelect={selectSection}
        patient={patient}
        sections={sections}
      />

      {activeSection ? (
        <section
          className={`v2-clinical-section v2-clinical-panel v2-clinical-panel--${kind.toLowerCase()}`}
        >
          <div className="v2-clinical-panel__header">
            <span className="v2-clinical-panel__label">
              <BilingualLabel
                focusKind={activeSection.focus ? activeSection.kind : undefined}
                label={activeSection.label}
              />
            </span>
            <button
              aria-label={`區塊備註：${activeSection.label}`}
              aria-pressed={isNoteOpen}
              className={`v2-section-note-button ${activeBlockNote.trim() ? "has-note" : ""}`}
              onClick={() =>
                setNoteOpen((current) => ({
                  ...current,
                  [activeSection.key]: !isNoteOpen,
                }))
              }
              type="button"
            >
              ✎
            </button>
            <button
              aria-label="關閉區塊"
              className="v2-clinical-panel__close"
              onClick={() => setActiveKey(null)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="v2-clinical-panel__body">
            {isNoteOpen ? (
              <label className="v2-block-note">
                <span>區塊備註</span>
                <textarea
                  aria-label={`區塊備註內容：${activeSection.label}`}
                  placeholder="這個區塊的備註…"
                  rows={1}
                  value={activeBlockNote}
                  onChange={(event) =>
                    onBlockNoteChange(activeSection.key, event.target.value)
                  }
                />
              </label>
            ) : null}
            {activeSection.items.map((item) => (
              <ClinicalItem
                finding={patient.findings[item.id] ?? {}}
                item={item}
                key={item.id}
                onChange={(finding) => onFindingChange(item.id, finding)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
