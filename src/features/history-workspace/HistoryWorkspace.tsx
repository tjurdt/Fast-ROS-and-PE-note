import { useState, type ReactNode } from "react";

import {
  ADMISSION_HABITS,
  createPastMedicalHistoryEntry,
  isAdlDependent,
  nextAdlLevel,
  PMH_COMMON,
  type Adl,
  type Admission,
  type PastMedicalHistoryEntry,
} from "../../domain/note-workspace";
import { Button } from "../../ui/Button";

interface HistoryWorkspaceProps {
  admission: Admission;
  adl: Adl;
  pmh: PastMedicalHistoryEntry[];
  createId: () => string;
  onAdmissionChange: (admission: Admission) => void;
  onAdlChange: (adl: Adl) => void;
  onPmhChange: (entries: PastMedicalHistoryEntry[]) => void;
}

type AdmissionToggleKey = "foodAllergy" | "drugAllergy" | "recentAdm";
type AdmissionNoteKey = "foodAllergyNote" | "drugAllergyNote" | "recentAdmNote";
type HistoryTabKey = "admission" | "adl" | "tocc" | "pmh";

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

function toccCount(admission: Admission): number {
  return [admission.tocc.t, admission.tocc.o, admission.tocc.c, admission.tocc.cl].some(
    (value) => value.trim().length > 0,
  )
    ? 1
    : 0;
}

function admissionEvalCount(admission: Admission): number {
  let count = 0;
  if (admission.habits.length > 0) count += 1;
  if (admission.foodAllergy) count += 1;
  if (admission.drugAllergy) count += 1;
  if (admission.recentAdm) count += 1;
  if (admission.familyHx.trim().length > 0) count += 1;
  return count;
}

/** One kind's (ROS or PE) row of tabs plus one panel below it -- the History
 * view mirrors that shape: 入院評估 / ADL / TOCC / 過去病史, one open at a
 * time (see PatientNote.tsx, which puts this behind the 病史 top-level tab). */
export function HistoryWorkspace({
  admission,
  adl,
  pmh,
  createId,
  onAdmissionChange,
  onAdlChange,
  onPmhChange,
}: HistoryWorkspaceProps) {
  const [activeKey, setActiveKey] = useState<HistoryTabKey | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
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
              onAdmissionChange({ ...admission, [noteKey]: event.target.value })
            }
          />
        ) : null}
      </div>
    );
  }

  function renderAdmission() {
    return (
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

        {toggleWithNote("foodAllergy", "foodAllergyNote", "食物過敏", "過敏原 / 反應…")}
        {toggleWithNote("drugAllergy", "drugAllergyNote", "藥物過敏", "過敏原 / 反應…")}
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
      </div>
    );
  }

  function renderTocc() {
    return (
      <div className="v2-admission-body">
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
                    tocc: { ...admission.tocc, [field.key]: event.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderAdl() {
    return (
      <div className="v2-admission-body v2-adl">
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
                    onClick={() => onAdlChange({ ...adl, [caregiver.key]: !selected })}
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
      </div>
    );
  }

  function renderPmh() {
    const add = (text: string) =>
      onPmhChange([...pmh, createPastMedicalHistoryEntry(text, { createId })]);
    return (
      <div className="v2-pmh-body">
        <div className="v2-pmh-tools">
          <select
            aria-label="選擇常見過去病史"
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              add(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="">＋ 選擇常見疾病…</option>
            {PMH_COMMON.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button onClick={() => add("")} tone="primary">
            ＋ 自行輸入
          </Button>
        </div>
        {pmh.length === 0 ? (
          <p className="v2-workspace-empty">尚無紀錄；可選擇常見疾病或自行輸入。</p>
        ) : (
          <div className="v2-pmh-list">
            {pmh.map((entry, index) => (
              <div className="v2-pmh-entry" key={entry.id}>
                <span aria-hidden="true">•</span>
                <textarea
                  aria-label={`過去病史 ${index + 1}`}
                  placeholder="疾病 / 病史…"
                  rows={1}
                  value={entry.text}
                  onChange={(event) =>
                    onPmhChange(
                      pmh.map((candidate) =>
                        candidate.id === entry.id
                          ? { ...candidate, text: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                />
                <Button
                  aria-label={`刪除過去病史 ${index + 1}`}
                  onClick={() =>
                    onPmhChange(pmh.filter((candidate) => candidate.id !== entry.id))
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const tabs: {
    key: HistoryTabKey;
    label: string;
    badge: number;
    render: () => ReactNode;
  }[] = [
    {
      key: "admission",
      label: "入院評估",
      badge: admissionEvalCount(admission),
      render: renderAdmission,
    },
    {
      key: "adl",
      label: "ADL",
      badge: dependent ? 1 : 0,
      render: renderAdl,
    },
    {
      key: "tocc",
      label: "TOCC",
      badge: toccCount(admission),
      render: renderTocc,
    },
    {
      key: "pmh",
      label: "過去病史",
      badge: pmh.filter((entry) => entry.text.trim().length > 0).length,
      render: renderPmh,
    },
  ];

  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? null;

  return (
    <section
      aria-labelledby="v2-history-title"
      className="v2-clinical v2-clinical--history"
      data-testid="history-workspace"
    >
      <div className="v2-clinical-summary">
        <h2 id="v2-history-title">病史</h2>
      </div>

      <div className="v2-clinical-tabs">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              aria-pressed={isActive}
              className={`v2-clinical-tab v2-clinical-tab--history ${isActive ? "is-active" : ""}`}
              data-history-tab={tab.key}
              key={tab.key}
              onClick={() =>
                setActiveKey((current) => (current === tab.key ? null : tab.key))
              }
              type="button"
            >
              {tab.badge > 0 ? (
                <span aria-hidden="true" className="v2-clinical-tab__badge">
                  {tab.badge}
                </span>
              ) : null}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab ? (
        <section className="v2-clinical-section v2-clinical-panel v2-clinical-panel--history">
          <div className="v2-clinical-panel__header">
            <span className="v2-clinical-panel__label">{activeTab.label}</span>
            <button
              aria-label="關閉區塊"
              className="v2-clinical-panel__close"
              onClick={() => setActiveKey(null)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="v2-clinical-panel__body">{activeTab.render()}</div>
        </section>
      ) : null}
    </section>
  );
}
