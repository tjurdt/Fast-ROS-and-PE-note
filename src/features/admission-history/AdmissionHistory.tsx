import { useState } from "react";

import {
  ADMISSION_HABITS,
  admissionFindingCount,
  isAdlDependent,
  nextAdlLevel,
  type Adl,
  type Admission,
} from "../../domain/note-workspace";
import { Button } from "../../ui/Button";

interface AdmissionHistoryProps {
  admission: Admission;
  adl: Adl;
  onAdmissionChange: (admission: Admission) => void;
  onAdlChange: (adl: Adl) => void;
}

type AdmissionToggleKey = "foodAllergy" | "drugAllergy" | "recentAdm";
type AdmissionNoteKey = "foodAllergyNote" | "drugAllergyNote" | "recentAdmNote";

const TOCC_FIELDS = [
  { key: "t", label: "旅遊 Travel", placeholder: "近期旅遊史" },
  { key: "o", label: "職業 Occupation", placeholder: "職業" },
  { key: "c", label: "接觸 Contact", placeholder: "接觸史" },
  { key: "cl", label: "群聚 Cluster", placeholder: "群聚史" },
] as const;

const CAREGIVERS = [
  { key: "foreign", label: "外籍看護 Foreign" },
  { key: "domestic", label: "本國看護 Domestic" },
  { key: "institution", label: "機構 Institution" },
  { key: "family", label: "家人 Family" },
] as const;

export function AdmissionHistory({
  admission,
  adl,
  onAdmissionChange,
  onAdlChange,
}: AdmissionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const count = admissionFindingCount(admission);
  const dependent = isAdlDependent(adl);

  function toggleWithNote(
    key: AdmissionToggleKey,
    noteKey: AdmissionNoteKey,
    label: string,
    placeholder: string,
  ) {
    const active = admission[key];
    const note = admission[noteKey];
    const showNote = noteOpen[key] ?? (active || note.trim().length > 0);
    return (
      <div className="v2-admission-toggle-group">
        <div className="v2-admission-row">
          <strong>{label}</strong>
          <Button
            aria-label={`${label}：${active ? "有" : "無"}`}
            aria-pressed={active}
            className={active ? "is-positive" : ""}
            data-testid={`admission-${key}`}
            onClick={() => {
              if (!active) {
                setNoteOpen((current) => ({ ...current, [key]: true }));
              }
              onAdmissionChange({ ...admission, [key]: !active });
            }}
          >
            {active ? "(+) 有" : "(−) 無"}
          </Button>
          <Button
            aria-label={`${label}備註`}
            className={note.trim().length > 0 ? "is-selected" : ""}
            onClick={() => setNoteOpen((current) => ({ ...current, [key]: !showNote }))}
          >
            ✎
          </Button>
        </div>
        {showNote ? (
          <textarea
            aria-label={`${label}內容`}
            placeholder={placeholder}
            rows={1}
            value={note}
            onChange={(event) =>
              onAdmissionChange({
                ...admission,
                [noteKey]: event.target.value,
              })
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <section
      className="v2-clinical-section v2-workspace-section"
      data-testid="admission-section"
    >
      <button
        aria-expanded={expanded}
        className="v2-clinical-section__header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>Admission 入院評估・病史・ADL</span>
        <span>{count > 0 ? `${count} 項` : "展開"}</span>
      </button>

      {expanded ? (
        <div className="v2-admission-body">
          <div className="v2-admission-row v2-admission-row--habits">
            <strong>菸酒檳榔</strong>
            <div className="v2-choice-chips">
              {ADMISSION_HABITS.map((habit) => {
                const selected = admission.habits.includes(habit);
                return (
                  <Button
                    aria-pressed={selected}
                    className={selected ? "is-selected" : ""}
                    key={habit}
                    onClick={() =>
                      onAdmissionChange({
                        ...admission,
                        habits: selected
                          ? admission.habits.filter((value) => value !== habit)
                          : [...admission.habits, habit],
                      })
                    }
                  >
                    {habit}
                  </Button>
                );
              })}
            </div>
          </div>

          {toggleWithNote(
            "foodAllergy",
            "foodAllergyNote",
            "食物過敏",
            "過敏原 / 反應…",
          )}
          {toggleWithNote(
            "drugAllergy",
            "drugAllergyNote",
            "藥物過敏",
            "過敏原 / 反應…",
          )}

          <fieldset className="v2-admission-fieldset">
            <legend>TOCC</legend>
            <div className="v2-admission-tocc">
              {TOCC_FIELDS.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <textarea
                    aria-label={field.label}
                    placeholder={field.placeholder}
                    rows={1}
                    value={admission.tocc[field.key]}
                    onChange={(event) =>
                      onAdmissionChange({
                        ...admission,
                        tocc: {
                          ...admission.tocc,
                          [field.key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {toggleWithNote(
            "recentAdm",
            "recentAdmNote",
            "近期住院史",
            "時間 / 院所 / 原因…",
          )}

          <label className="v2-admission-textarea">
            <span>家族史 Family history</span>
            <textarea
              aria-label="家族史 Family history"
              placeholder="家族疾病史…"
              rows={1}
              value={admission.familyHx}
              onChange={(event) =>
                onAdmissionChange({ ...admission, familyHx: event.target.value })
              }
            />
          </label>

          <fieldset className="v2-admission-fieldset v2-adl">
            <legend>ADL 日常生活功能・主要照護者</legend>
            <div className="v2-adl__level">
              <strong>ADL</strong>
              <Button
                className={dependent ? "is-positive" : "is-normal"}
                data-testid="adl-level"
                onClick={() => onAdlChange({ ...adl, level: nextAdlLevel(adl.level) })}
              >
                {adl.level}
              </Button>
              <span>點擊循環切換</span>
            </div>

            {dependent ? (
              <div className="v2-adl__care">
                <strong>主要照護者 Primary caregiver（可複選）</strong>
                <div className="v2-choice-chips">
                  {CAREGIVERS.map((caregiver) => {
                    const selected = adl[caregiver.key];
                    return (
                      <Button
                        aria-pressed={selected}
                        className={selected ? "is-selected" : ""}
                        key={caregiver.key}
                        onClick={() =>
                          onAdlChange({
                            ...adl,
                            [caregiver.key]: !selected,
                          })
                        }
                      >
                        {caregiver.label}
                      </Button>
                    );
                  })}
                </div>
                {adl.institution ? (
                  <textarea
                    aria-label="機構名稱 Facility name"
                    placeholder="機構名稱 Facility name"
                    rows={1}
                    value={adl.instName}
                    onChange={(event) =>
                      onAdlChange({ ...adl, instName: event.target.value })
                    }
                  />
                ) : null}
                {adl.family ? (
                  <textarea
                    aria-label="家人姓名或關係 Family member"
                    placeholder="家人姓名/關係 Family member"
                    rows={1}
                    value={adl.famName}
                    onChange={(event) =>
                      onAdlChange({ ...adl, famName: event.target.value })
                    }
                  />
                ) : null}
              </div>
            ) : null}

            <textarea
              aria-label="ADL 備註"
              placeholder="Barthel 分數、具體失能項目、原因…"
              rows={1}
              value={adl.note}
              onChange={(event) => onAdlChange({ ...adl, note: event.target.value })}
            />
          </fieldset>
        </div>
      ) : null}
    </section>
  );
}
