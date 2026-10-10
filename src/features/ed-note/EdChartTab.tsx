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
import { selectedComplaints } from "../../domain/ed/complaints";
import { autoFitEnabled } from "../../domain/ed/condense";
import type { FindingValue } from "../../domain/clinical/finding";
import { planOrders } from "../../domain/ed/order-rules";
import { PE_FIELD_LABELS } from "../../domain/ed/pe-library";
import { edKey, type EdFieldKey } from "../../domain/ed/types";
import { Button } from "../../ui/Button";
import type { EdFindingChange } from "./ed-controls";
import { EdFitDetails } from "./EdFitDetails";

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
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

export function EdChartTab({
  findings,
  patient,
  onChange,
  onBulkChange,
}: EdChartTabProps) {
  const problems = selectedProblems(findings);
  const chart = composeChart(findings, patient);
  const candidates = icdCandidates(problems, findings);
  const orderPlan = planOrders(findings, patient);
  const exportText = serializeChart(chart, patient, orderPlan.selected, problems);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  if (selectedComplaints(findings).length === 0) {
    return (
      <section className="ed-panel">
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
  // 空白的 PE 欄位收起來（CC／PI／PH 一律顯示）；手動改過的一定顯示。
  const hideEmpty = (key: EdFieldKey) =>
    !["CC", "PI", "PH"].includes(key) &&
    chart.fields[key].trim() === "" &&
    !overrides.has(key);
  const emptyFields = FIELD_ORDER.filter(hideEmpty);
  const icdRow = (candidate: (typeof candidates)[number]) => (
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
  );
  const icdOverrides = findings[edKey.icd]?.fu ?? {};
  const setIcd = (code: string, on: boolean) =>
    onChange(edKey.icd, {
      ...(findings[edKey.icd] ?? {}),
      fu: { ...icdOverrides, [code]: on ? "1" : "0" },
    });

  return (
    <section className="ed-panel" aria-labelledby="ed-chart-title">
      <div className="ed-bar">
        <h2 id="ed-chart-title">病歷輸出</h2>
        <Button data-testid="ed-copy" onClick={() => void copy()} tone="primary">
          {copyState === "copied" ? "已複製 ✓" : "複製（貼到 ERS 油猴）"}
        </Button>
        {copyState === "manual" ? (
          <span className="ed-hint">無法自動複製，請手動複製最下方文字。</span>
        ) : null}
      </div>

      {chart.missing.length > 0 ? (
        <div className="ed-alert" role="status" data-testid="ed-missing">
          <strong>不可漏 {chart.missing.length} 項：</strong>
          {(["history", "pe"] as const).map((kind) => {
            const list = chart.missing.filter((entry) => entry.kind === kind);
            if (list.length === 0) return null;
            return (
              <span className="ed-missing__line" key={kind}>
                {kind === "history" ? "問" : "查"}：
                {list.map((entry, index) => (
                  <span key={entry.id} title={entry.reasons.join("、")}>
                    {index > 0 ? "、" : ""}
                    {entry.label}
                  </span>
                ))}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="ed-ok" role="status">
          不可漏項目都已處理。
        </div>
      )}

      <label className="ed-switch">
        <input
          aria-label="超過字數時自動精簡"
          checked={autoFitEnabled(findings)}
          onChange={(event) =>
            onChange(edKey.ctx("autoFit"), { text: event.target.checked ? "" : "off" })
          }
          type="checkbox"
        />
        超過字數自動精簡（每欄「逐句明細」可逐句決定）
      </label>

      <div className="ed-ok" data-testid="ed-order-summary" role="status">
        檢查 {orderPlan.selected.length} 項一併帶到 ERS 檢查驗系統（「檢查」分頁調整）。
      </div>

      {FIELD_ORDER.filter((key) => !hideEmpty(key)).map((key) => {
        const value = chart.fields[key];
        const limit = FIELD_LIMITS[key];
        const over = value.length > limit;
        const detail = chart.detail[key];
        return (
          <div className="ed-field-wrap" key={key}>
            <label className={`ed-field ${over ? "is-over" : ""}`}>
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
                rows={Math.min(6, Math.max(1, Math.ceil(value.length / 42)))}
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
            {detail ? (
              <EdFitDetails
                detail={detail}
                onBulkChange={onBulkChange}
                onChange={onChange}
                title={key}
              />
            ) : null}
          </div>
        );
      })}
      {emptyFields.length > 0 ? (
        <div className="ed-grid" data-testid="ed-empty-fields">
          <span className="ed-grid__label">空白欄</span>
          {emptyFields.map((key) => (
            <button
              aria-label={`手動填寫 ${FIELD_TITLES[key]}`}
              className="ed-chip"
              key={key}
              onClick={() => onChange(edKey.override(key), { on: true, text: "" })}
              type="button"
            >
              ＋{key}
            </button>
          ))}
        </div>
      ) : null}

      <h3 className="ed-h">ICD-10（依問診答案挑較精確的碼，最多 5 筆）</h3>
      <div className="ed-icd">
        {candidates.filter((candidate) => candidate.on).map(icdRow)}
      </div>
      {candidates.some((candidate) => !candidate.on) ? (
        <details className="ed-tri">
          <summary>
            其他候選（{candidates.filter((candidate) => !candidate.on).length}）
          </summary>
          <div className="ed-icd">
            {candidates.filter((candidate) => !candidate.on).map(icdRow)}
          </div>
        </details>
      ) : null}
      <label className="ed-line">
        <span>其他 ICD</span>
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

      <h3 className="ed-h">交換文字（給油猴工具；空白欄位不會動到 ERS 原有內容）</h3>
      <textarea
        aria-label="交換文字"
        className="ed-export"
        readOnly
        ref={exportRef}
        rows={8}
        value={exportText}
      />
    </section>
  );
}
