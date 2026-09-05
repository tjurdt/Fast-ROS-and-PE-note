import { useState } from "react";

import {
  buildClinicalView,
  countFindings,
  hasFinding,
  type ClinicalViewSection,
} from "../../domain/clinical/clinical-rules";
import type { FindingValue, Patient } from "../../domain/patient";
import { ClinicalItem } from "./ClinicalItem";

interface ClinicalNoteProps {
  patient: Patient;
  onFindingChange: (itemId: string, finding: FindingValue) => void;
  onBlockNoteChange: (sectionKey: string, note: string) => void;
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
  if (sections.length === 0) return null;
  return (
    <div className={`v2-clinical-kind v2-clinical-kind--${kind.toLowerCase()}`}>
      <h3 className="v2-clinical-kind__label">{kind}</h3>
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
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ClinicalNote({
  patient,
  onFindingChange,
  onBlockNoteChange,
}: ClinicalNoteProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const sections = buildClinicalView(patient).filter(
    (section) => section.items.length > 0,
  );
  const rosSections = sections.filter((section) => section.kind === "ROS");
  const peSections = sections.filter((section) => section.kind === "PE");
  const total = countFindings(patient);
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
    <section className="v2-clinical" aria-labelledby="v2-clinical-title">
      <div className="v2-clinical-summary">
        <div>
          <span className="v2-eyebrow">Typed clinical catalog</span>
          <h2 id="v2-clinical-title">ROS / PE</h2>
        </div>
        <strong data-testid="finding-total">陽性／異常 {total}</strong>
      </div>

      <KindTabs
        activeKey={activeKey}
        kind="ROS"
        onSelect={selectSection}
        patient={patient}
        sections={rosSections}
      />
      <KindTabs
        activeKey={activeKey}
        kind="PE"
        onSelect={selectSection}
        patient={patient}
        sections={peSections}
      />

      {activeSection ? (
        <section
          className={`v2-clinical-section v2-clinical-panel v2-clinical-panel--${activeSection.kind.toLowerCase()}`}
        >
          <div className="v2-clinical-panel__header">
            <span className="v2-clinical-panel__label">{activeSection.label}</span>
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
