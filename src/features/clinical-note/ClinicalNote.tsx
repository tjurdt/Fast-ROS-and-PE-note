import { useState } from "react";

import {
  buildClinicalView,
  countFindings,
  hasFinding,
} from "../../domain/clinical/clinical-rules";
import type { FindingValue, Patient } from "../../domain/patient";
import { ClinicalItem } from "./ClinicalItem";

interface ClinicalNoteProps {
  patient: Patient;
  onFindingChange: (itemId: string, finding: FindingValue) => void;
  onBlockNoteChange: (sectionKey: string, note: string) => void;
}

export function ClinicalNote({
  patient,
  onFindingChange,
  onBlockNoteChange,
}: ClinicalNoteProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const sections = buildClinicalView(patient).filter(
    (section) => section.items.length > 0,
  );
  const total = countFindings(patient);

  return (
    <section className="v2-clinical" aria-labelledby="v2-clinical-title">
      <div className="v2-clinical-summary">
        <div>
          <span className="v2-eyebrow">Typed clinical catalog</span>
          <h2 id="v2-clinical-title">ROS / PE</h2>
        </div>
        <strong data-testid="finding-total">陽性／異常 {total}</strong>
      </div>

      {sections.map((section) => {
        const isExpanded = expanded[section.key] ?? false;
        const count = section.items.filter((item) =>
          hasFinding(item, patient.findings[item.id]),
        ).length;
        const blockNote = patient.blockNotes[section.key] ?? "";
        const isNoteOpen = noteOpen[section.key] ?? blockNote.length > 0;
        return (
          <section
            className={`v2-clinical-section ${section.focus ? "is-focus" : ""}`}
            data-clinical-section={section.key}
            key={section.key}
          >
            <div className="v2-clinical-section__head">
              <button
                aria-expanded={isExpanded}
                className="v2-clinical-section__header"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [section.key]: !isExpanded,
                  }))
                }
                type="button"
              >
                <span>{section.label}</span>
                <span>{count > 0 ? `${count} 項` : "展開"}</span>
              </button>
              <button
                aria-label={`區塊備註：${section.label}`}
                aria-pressed={isNoteOpen}
                className={`v2-section-note-button ${blockNote.trim() ? "has-note" : ""}`}
                onClick={() => {
                  setExpanded((current) => ({ ...current, [section.key]: true }));
                  setNoteOpen((current) => ({
                    ...current,
                    [section.key]: !isNoteOpen,
                  }));
                }}
                type="button"
              >
                ✎
              </button>
            </div>
            {isExpanded ? (
              <div className="v2-clinical-section__body">
                {isNoteOpen ? (
                  <label className="v2-block-note">
                    <span>區塊備註</span>
                    <textarea
                      aria-label={`區塊備註內容：${section.label}`}
                      placeholder="這個區塊的備註…"
                      rows={1}
                      value={blockNote}
                      onChange={(event) =>
                        onBlockNoteChange(section.key, event.target.value)
                      }
                    />
                  </label>
                ) : null}
                {section.items.map((item) => (
                  <ClinicalItem
                    finding={patient.findings[item.id] ?? {}}
                    item={item}
                    key={item.id}
                    onChange={(finding) => onFindingChange(item.id, finding)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}
