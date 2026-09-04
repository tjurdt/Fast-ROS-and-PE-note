import { useState, type FormEvent, type PropsWithChildren } from "react";

import type { Gender, Patient, PatientDraft } from "../../domain/patient";
import { queryPatients, type PatientSortMode } from "../../domain/patient-list";
import { SPECIALTIES, specialtyLabel } from "../../domain/specialty";
import { Button } from "../../ui/Button";

interface PatientListProps {
  patients: Patient[];
  saving: boolean;
  onCreate: (draft: PatientDraft) => void;
  onDelete: (patientId: string) => void;
  onOpen: (patientId: string) => void;
}

const EMPTY_DRAFT: PatientDraft = {
  code: "",
  specialty: "general",
  sex: "",
  age: "",
  problem: "",
};

export function PatientList({
  patients,
  saving,
  onCreate,
  onDelete,
  onOpen,
  children,
}: PropsWithChildren<PatientListProps>) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_DRAFT);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PatientSortMode>("updated-desc");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  }

  const visiblePatients = queryPatients(patients, { search, sort });

  function formatUpdated(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

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

      {children}

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

      {patients.length > 0 ? (
        <section className="v2-list-tools" aria-label="病人清單篩選與排序">
          <label>
            <span>搜尋病人</span>
            <input
              aria-label="搜尋病人"
              onChange={(event) => {
                setSearch(event.target.value);
                setPendingDeleteId(null);
              }}
              placeholder="代號、主要問題、科別…"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span>排序</span>
            <select
              aria-label="病人排序"
              onChange={(event) => {
                setSort(event.target.value as PatientSortMode);
                setPendingDeleteId(null);
              }}
              value={sort}
            >
              <option value="updated-desc">最近更新</option>
              <option value="updated-asc">最早更新</option>
              <option value="code-asc">病人代號</option>
            </select>
          </label>
          <span className="v2-list-tools__count" role="status">
            顯示 {visiblePatients.length}／{patients.length} 筆
          </span>
        </section>
      ) : null}

      <section className="v2-list" aria-label="病人列表">
        {patients.length === 0 ? (
          <div className="v2-card v2-empty">
            <span aria-hidden="true">🗂️</span>
            <p>尚無病人紀錄</p>
          </div>
        ) : visiblePatients.length === 0 ? (
          <div className="v2-card v2-empty">
            <span aria-hidden="true">🔎</span>
            <p>找不到符合「{search.trim()}」的病人紀錄</p>
            <Button onClick={() => setSearch("")}>清除搜尋</Button>
          </div>
        ) : (
          visiblePatients.map((patient) => {
            const displayCode = patient.code || "（未命名）";
            return (
              <article
                aria-label={`病人 ${displayCode}`}
                className="v2-card v2-patient-row"
                data-testid="patient-row"
                key={patient.id}
              >
                {pendingDeleteId === patient.id ? (
                  <div
                    aria-label={`確認刪除病人 ${displayCode}`}
                    className="v2-patient-delete-confirm"
                    role="group"
                  >
                    <div>
                      <strong>確定刪除 {displayCode}？</strong>
                      <small>整筆紀錄將永久刪除，且無法復原。</small>
                    </div>
                    <Button disabled={saving} onClick={() => setPendingDeleteId(null)}>
                      取消
                    </Button>
                    <Button
                      className="v2-patient-delete-confirm__action"
                      disabled={saving}
                      onClick={() => {
                        setPendingDeleteId(null);
                        onDelete(patient.id);
                      }}
                    >
                      確認刪除
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      className="v2-patient"
                      onClick={() => onOpen(patient.id)}
                      type="button"
                    >
                      <strong>{displayCode}</strong>
                      <span>{specialtyLabel(patient.specialty)}</span>
                      {patient.sex || patient.age ? (
                        <small>
                          {[
                            patient.sex,
                            patient.age
                              ? /^\d+$/u.test(patient.age)
                                ? `${patient.age} 歲`
                                : patient.age
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      ) : null}
                      {patient.problem ? <small>{patient.problem}</small> : null}
                      <small>更新 {formatUpdated(patient.updatedAt)}</small>
                    </button>
                    <Button
                      aria-label="刪除此筆紀錄"
                      className="v2-patient__delete"
                      disabled={saving}
                      onClick={() => setPendingDeleteId(patient.id)}
                      tone="ghost"
                    >
                      ×
                    </Button>
                  </>
                )}
              </article>
            );
          })
        )}
      </section>

      <Button className="v2-fab" onClick={() => setShowForm(true)} tone="primary">
        ＋ 新增病人
      </Button>
    </main>
  );
}
