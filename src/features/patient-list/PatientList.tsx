import { useState, type FormEvent } from "react";

import type { Gender, Patient, PatientDraft } from "../../domain/patient";
import { SPECIALTIES, specialtyLabel } from "../../domain/specialty";
import { Button } from "../../ui/Button";

interface PatientListProps {
  patients: Patient[];
  saving: boolean;
  onCreate: (draft: PatientDraft) => void;
  onOpen: (patientId: string) => void;
}

const EMPTY_DRAFT: PatientDraft = {
  code: "",
  specialty: "general",
  sex: "",
  age: "",
  problem: "",
};

export function PatientList({ patients, saving, onCreate, onOpen }: PatientListProps) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_DRAFT);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  }

  const orderedPatients = [...patients].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  return (
    <main className="v2-shell" aria-labelledby="patient-list-title">
      <header className="v2-topbar">
        <div>
          <span className="v2-eyebrow">PE Note v2</span>
          <h1 id="patient-list-title">查房快速紀錄</h1>
        </div>
        <span className="v2-save-state" role="status">
          {saving ? "儲存中…" : "已儲存在本機"}
        </span>
      </header>

      {showForm ? (
        <form className="v2-card v2-form" onSubmit={submit}>
          <h2>新增病人紀錄</h2>
          <label>
            病人代號 Patient code
            <input
              autoFocus
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              placeholder="例：3F-12 / Bed 07"
            />
          </label>
          <label>
            科別 Department
            <select
              value={draft.specialty}
              onChange={(event) =>
                setDraft({ ...draft, specialty: event.target.value })
              }
            >
              {SPECIALTIES.map((specialty) => (
                <option key={specialty.key} value={specialty.key}>
                  {specialty.label}
                </option>
              ))}
            </select>
          </label>
          <div className="v2-form__row">
            <label>
              性別 Sex
              <select
                value={draft.sex}
                onChange={(event) =>
                  setDraft({ ...draft, sex: event.target.value as Gender })
                }
              >
                <option value="">未填</option>
                <option value="男 M">男 M</option>
                <option value="女 F">女 F</option>
                <option value="其他 Other">其他 Other</option>
              </select>
            </label>
            <label>
              年齡 Age
              <input
                inputMode="numeric"
                value={draft.age}
                onChange={(event) => setDraft({ ...draft, age: event.target.value })}
              />
            </label>
          </div>
          <label>
            主要問題
            <input
              value={draft.problem}
              onChange={(event) => setDraft({ ...draft, problem: event.target.value })}
            />
          </label>
          <div className="v2-form__actions">
            <Button onClick={() => setShowForm(false)}>取消</Button>
            <Button type="submit" tone="primary">
              建立並開始
            </Button>
          </div>
        </form>
      ) : null}

      <section className="v2-list" aria-label="病人列表">
        {orderedPatients.length === 0 ? (
          <div className="v2-card v2-empty">
            <span aria-hidden="true">🗂️</span>
            <p>尚無病人紀錄</p>
          </div>
        ) : (
          orderedPatients.map((patient) => (
            <button
              className="v2-card v2-patient"
              key={patient.id}
              onClick={() => onOpen(patient.id)}
              type="button"
            >
              <strong>{patient.code || "（未命名）"}</strong>
              <span>{specialtyLabel(patient.specialty)}</span>
              {patient.problem ? <small>{patient.problem}</small> : null}
            </button>
          ))
        )}
      </section>

      <Button className="v2-fab" onClick={() => setShowForm(true)} tone="primary">
        ＋ 新增病人
      </Button>
    </main>
  );
}
