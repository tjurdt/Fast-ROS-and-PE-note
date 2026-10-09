import { useRef, useState } from "react";

import { serializeChart } from "../../domain/ed/chart-text";
import {
  FIELD_LIMITS,
  FIELD_ORDER,
  KNOWN_ICD_CODES,
  composeChart,
  icdCandidates,
  selectedProblems,
  type EdFindings,
  type EdPatientContext,
} from "../../domain/ed/compose";
import { planOrders } from "../../domain/ed/order-rules";
import { PE_FIELD_LABELS } from "../../domain/ed/pe-library";
import { edKey, type EdFieldKey } from "../../domain/ed/types";
import { Button } from "../../ui/Button";
import type { EdFindingChange } from "./ed-controls";

const FIELD_TITLES: Record<EdFieldKey, string> = {
  CC: "CHIEF COMPLAINT",
  NRS: "NRS 疼痛分數（帶入為 NRS:分數）",
  PI: "PRESENT ILLNESS",
  PH: "PAST HISTORY（含 TOCC、過敏）",
  GC: PE_FIELD_LABELS.GC,
  HEENT: PE_FIELD_LABELS.HEENT,
  NECK: PE_FIELD_LABELS.NECK,
  CHEST: PE_FIELD_LABELS.CHEST,
  ABD: PE_FIELD_LABELS.ABD,
  BACK: PE_FIELD_LABELS.BACK,
  GU: PE_FIELD_LABELS.GU,
  RECTAL: PE_FIELD_LABELS.RECTAL,
  EXT: PE_FIELD_LABELS.EXT,
  NEURO: PE_FIELD_LABELS.NEURO,
};

interface EdChartTabProps {
  findings: EdFindings;
  patient: EdPatientContext;
  onChange: EdFindingChange;
}

export function EdChartTab({ findings, patient, onChange }: EdChartTabProps) {
  const problems = selectedProblems(findings);
  const chart = composeChart(findings, patient);
  const candidates = icdCandidates(problems, findings);
  const orderPlan = planOrders(findings, patient);
  const exportText = serializeChart(chart, patient, orderPlan.selected);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  if (problems.length === 0) {
    return (
      <section className="v2-card ed-panel">
        <p className="v2-empty">請先到「問題」分頁選擇病人的主訴。</p>
      </section>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyState("copied");
    } catch {
      exportRef.current?.focus();
      exportRef.current?.select();
      setCopyState("manual");
    }
  };

  const overrides = new Set(chart.overridden);
  const icdOverrides = findings[edKey.icd]?.fu ?? {};
  const setIcd = (code: string, on: boolean) =>
    onChange(edKey.icd, {
      ...(findings[edKey.icd] ?? {}),
      fu: { ...icdOverrides, [code]: on ? "1" : "0" },
    });

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-chart-title">
      <h2 id="ed-chart-title">急診病歷輸出</h2>

      {chart.missing.length > 0 ? (
        <div className="ed-alert" role="status" data-testid="ed-missing">
          <strong>還有 {chart.missing.length} 項不可漏的沒做／沒問：</strong>
          <ul>
            {chart.missing.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                {entry.kind === "history" ? "問" : "查"}：{entry.label}
                <small>（{entry.reasons.join("、")}）</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ed-ok" role="status">
          不可漏項目都已處理。
        </div>
      )}

      <div className="ed-actions">
        <Button data-testid="ed-copy" onClick={() => void copy()} tone="primary">
          {copyState === "copied" ? "已複製 ✓" : "複製病歷（貼到 ERS 油猴工具）"}
        </Button>
        {copyState === "manual" ? (
          <span className="ed-help">無法自動複製，請手動複製下方文字。</span>
        ) : null}
      </div>

      <div className="ed-ok" data-testid="ed-order-summary" role="status">
        檢查 {orderPlan.selected.length} 項會一併帶到 ERS
        檢查驗系統（到「檢查」分頁調整）。
      </div>

      {FIELD_ORDER.map((key) => {
        const value = chart.fields[key];
        const limit = FIELD_LIMITS[key];
        const over = value.length > limit;
        return (
          <label className={`ed-field ${over ? "is-over" : ""}`} key={key}>
            <span className="ed-field__head">
              <span>{FIELD_TITLES[key]}</span>
              <span className="ed-field__count" data-testid={`ed-count-${key}`}>
                {value.length}/{limit}
              </span>
            </span>
            <textarea
              aria-label={FIELD_TITLES[key]}
              onChange={(event) =>
                onChange(edKey.override(key), { on: true, text: event.target.value })
              }
              rows={key === "PI" || key === "PH" || key === "CC" ? 3 : 2}
              value={value}
            />
            {overrides.has(key) ? (
              <button
                className="ed-link"
                onClick={() => onChange(edKey.override(key), {})}
                type="button"
              >
                已手動修改・還原自動產生
              </button>
            ) : null}
            {over ? (
              <span className="ed-field__warn">超過表單上限，請刪減。</span>
            ) : null}
          </label>
        );
      })}
      <p className="ed-help">沒有內容的欄位，帶入 ERS 時不會動到表單上原有的內容。</p>

      <h3>ICD-10（以 unspecified 症狀碼為主，最多 5 筆）</h3>
      <div className="ed-icd">
        {candidates.map((candidate) => (
          <label className="ed-icd__row" key={candidate.code}>
            <input
              aria-label={`ICD ${candidate.code}`}
              checked={candidate.on}
              onChange={(event) => setIcd(candidate.code, event.target.checked)}
              type="checkbox"
            />
            <strong>{candidate.code}</strong>
            <span>{candidate.desc}</span>
          </label>
        ))}
      </div>
      <label>
        其他 ICD 代碼（空白或逗號分隔）
        <input
          aria-label="其他 ICD"
          list="ed-icd-list"
          onChange={(event) =>
            onChange(edKey.icd, {
              ...(findings[edKey.icd] ?? {}),
              text: event.target.value,
            })
          }
          placeholder="例 R10.84 R11.0"
          value={findings[edKey.icd]?.text ?? ""}
        />
        <datalist id="ed-icd-list">
          {KNOWN_ICD_CODES.map((choice) => (
            <option key={choice.code} value={choice.code}>
              {choice.desc}
            </option>
          ))}
        </datalist>
      </label>
      {chart.icdDropped.length > 0 ? (
        <div className="ed-alert" role="status">
          表單只有 5 列，以下 ICD 未帶入：
          {chart.icdDropped.map((line) => line.code).join("、")}
        </div>
      ) : null}

      <h3>交換文字（給油猴工具）</h3>
      <textarea
        aria-label="交換文字"
        className="ed-export"
        readOnly
        ref={exportRef}
        rows={12}
        value={exportText}
      />
    </section>
  );
}
