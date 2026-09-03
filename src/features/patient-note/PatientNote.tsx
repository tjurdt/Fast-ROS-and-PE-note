import type { PropsWithChildren } from "react";

import type { Gender, Patient, PatientEditableFields } from "../../domain/patient";
import { SPECIALTIES } from "../../domain/specialty";
import { Button } from "../../ui/Button";

interface PatientNoteProps {
  patient: Patient;
  saving: boolean;
  onBack: () => void;
  onChange: (patch: Partial<PatientEditableFields>) => void;
  onExport: () => void;
}

export function PatientNote({
  patient,
  saving,
  onBack,
  onChange,
  onExport,
  children,
}: PropsWithChildren<PatientNoteProps>) {
  return (
    <main className="v2-shell">
      <header className="v2-topbar v2-topbar--note">
        <Button onClick={onBack} tone="ghost">
          ‹ 病人清單
        </Button>
        <div className="v2-topbar__actions">
          <span className="v2-save-state" role="status">
            {saving ? "儲存中…" : "已儲存在本機"}
          </span>
          <Button data-testid="open-clinical-export" onClick={onExport}>
            匯出／列印
          </Button>
        </div>
      </header>

      <section className="v2-card v2-note" aria-labelledby="v2-note-title">
        <span className="v2-eyebrow">v2 typed patient shell</span>
        <h1 id="v2-note-title">病人基本資料</h1>
        <label>
          病人代號
          <input
            aria-label="病人代號"
            value={patient.code}
            onChange={(event) => onChange({ code: event.target.value })}
          />
        </label>
        <label>
          科別
          <select
            aria-label="科別"
            value={patient.specialty}
            onChange={(event) => onChange({ specialty: event.target.value })}
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
            性別
            <select
              aria-label="性別"
              value={patient.sex}
              onChange={(event) => onChange({ sex: event.target.value as Gender })}
            >
              <option value="">未填</option>
              <option value="男 M">男 M</option>
              <option value="女 F">女 F</option>
              <option value="其他 Other">其他 Other</option>
            </select>
          </label>
          <label>
            年齡
            <input
              aria-label="年齡"
              inputMode="numeric"
              value={patient.age}
              onChange={(event) => onChange({ age: event.target.value })}
            />
          </label>
        </div>
        <label>
          主要問題
          <textarea
            aria-label="主要問題"
            rows={3}
            value={patient.problem}
            onChange={(event) => onChange({ problem: event.target.value })}
          />
        </label>
      </section>

      {children}

      <section className="v2-card v2-parity-notice">
        <strong>尚未切換正式入口</strong>
        <p>Google 同步與正式病歷輸入仍會在 parity 測試保護下逐步遷入。</p>
      </section>
    </main>
  );
}
