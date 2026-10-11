import { useState, type ReactNode } from "react";

import type { Gender, Patient, PatientEditableFields } from "../../domain/patient";
import { SPECIALTIES, isEdPatient } from "../../domain/specialty";
import { Button } from "../../ui/Button";

/** createPatient 在沒填代號時補的預設值；輸入框遇到它就顯示空白，免得使用者要先刪掉。 */
const UNNAMED_CODE = "（未命名）";

export interface PatientNoteTab {
  key: string;
  label: string;
  /** Shown as a small badge on the tab button; omit or pass 0 to hide it. */
  badge?: number;
  content: ReactNode;
}

interface PatientNoteProps {
  patient: Patient;
  saving: boolean;
  onBack: () => void;
  onChange: (patch: Partial<PatientEditableFields>) => void;
  onExport: () => void;
  /** 急診模式的輸出在自己的「病歷輸出」分頁，不使用通用的匯出／列印。 */
  hideExport?: boolean;
  syncPanel?: ReactNode;
  tabs: PatientNoteTab[];
  /** 第一個分頁的名稱（急診模式用較短的「基本」）。 */
  basicLabel?: string;
  /** true = 一進來就停在第一個主要分頁（新增病人時用），不是「基本」。 */
  startOnMain?: boolean;
}

export function PatientNote({
  patient,
  saving,
  onBack,
  onChange,
  onExport,
  hideExport = false,
  syncPanel,
  tabs,
  basicLabel = "基本資料",
  startOnMain = false,
}: PatientNoteProps) {
  const isEd = isEdPatient(patient);
  const basicInfoTab: PatientNoteTab = {
    key: "basic",
    label: basicLabel,
    content: (
      <section className="v2-card v2-note" aria-labelledby="v2-note-title">
        <span className="v2-eyebrow">v2 typed patient shell</span>
        <h1 id="v2-note-title">病人基本資料</h1>
        <label>
          病人代號
          <input
            aria-label="病人代號"
            placeholder="例：3F-12 / Bed 07"
            value={patient.code === UNNAMED_CODE ? "" : patient.code}
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
        {isEd ? null : (
          <label>
            主要問題
            <textarea
              aria-label="主要問題"
              rows={3}
              value={patient.problem}
              onChange={(event) => onChange({ problem: event.target.value })}
            />
          </label>
        )}
      </section>
    ),
  };

  const allTabs = [basicInfoTab, ...tabs];
  const [activeTabKey, setActiveTabKey] = useState(
    startOnMain && tabs[0] ? tabs[0].key : basicInfoTab.key,
  );
  const activeTab = allTabs.find((tab) => tab.key === activeTabKey) ?? basicInfoTab;

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
          {hideExport ? null : (
            <Button data-testid="open-clinical-export" onClick={onExport}>
              匯出／列印
            </Button>
          )}
        </div>
      </header>

      {syncPanel}

      <nav aria-label="病人筆記分頁" className="v2-note-tabs">
        {allTabs.map((tab) => (
          <button
            aria-pressed={tab.key === activeTabKey}
            className={`v2-note-tab ${tab.key === activeTabKey ? "is-active" : ""}`}
            key={tab.key}
            onClick={() => setActiveTabKey(tab.key)}
            type="button"
          >
            {tab.label}
            {tab.badge ? (
              <span aria-hidden="true" className="v2-note-tab__badge">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {activeTab.content}
    </main>
  );
}
