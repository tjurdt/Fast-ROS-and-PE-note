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
}

export function ClinicalNote({ patient, onFindingChange }: ClinicalNoteProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
        return (
          <section
            className={`v2-clinical-section ${section.focus ? "is-focus" : ""}`}
            data-clinical-section={section.key}
            key={section.key}
          >
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
            {isExpanded ? (
              <div className="v2-clinical-section__body">
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
