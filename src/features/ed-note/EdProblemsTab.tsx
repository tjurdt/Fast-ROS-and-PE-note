import { useState } from "react";

import type { FindingValue } from "../../domain/clinical/finding";
import {
  CHIP_SECTIONS,
  chipActive,
  toggleChip,
  type ChipSection,
} from "../../domain/ed/complaint-chips";
import {
  CUSTOM_MAIN_PREFIX,
  addCustomComplaint,
  mainComplaintId,
  removeCustomComplaint,
  searchProblems,
  selectedComplaints,
} from "../../domain/ed/complaints";
import {
  composeCC,
  selectedProblems,
  toggleProblemFinding,
  type EdFindings,
} from "../../domain/ed/compose";
import {
  DURATION_LABELS,
  customDuration,
  cycleDuration,
  durationCode,
  setCustomDuration,
} from "../../domain/ed/duration";
import { edKey, type EdContextKey, type EdProblem } from "../../domain/ed/types";
import { Chip, type EdFindingChange } from "./ed-controls";

const NRS_CHIPS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface EdProblemsTabProps {
  findings: EdFindings;
  onChange: EdFindingChange;
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

export function EdProblemsTab({
  findings,
  onChange,
  onBulkChange,
}: EdProblemsTabProps) {
  const [query, setQuery] = useState("");
  const complaints = selectedComplaints(findings);
  const selected = selectedProblems(findings);
  const ctx = (key: EdContextKey) => findings[edKey.ctx(key)]?.text ?? "";
  const setCtx = (key: EdContextKey, value: string) =>
    onChange(edKey.ctx(key), { text: value });
  const showPain = selected.some((problem) => problem.pain);
  const results = searchProblems(query);
  const trimmed = query.trim();
  const isSelected = (problem: EdProblem) =>
    complaints.some((entry) => entry.id === problem.id);

  const toggle = (problem: EdProblem) =>
    onChange(edKey.problem(problem.id), toggleProblemFinding(findings, problem.id));

  const problemChip = (problem: EdProblem) => (
    <Chip
      active={isSelected(problem)}
      key={problem.id}
      onClick={() => toggle(problem)}
      title={problem.hint}
      tone="warning"
    >
      {problem.label}
    </Chip>
  );

  // 每一類一列（類名佔第一格），一顆按鈕一個症狀；小科收在三角形裡。
  const section = (entry: ChipSection) => (
    <div
      className="ed-grid ed-group"
      data-testid={`ed-chips-${entry.key}`}
      key={entry.key}
    >
      {entry.minor ? null : <span className="ed-grid__label">{entry.title}</span>}
      {entry.chips.map((chip) => (
        <Chip
          active={chipActive(findings, chip)}
          key={chip.key}
          onClick={() => onBulkChange(toggleChip(findings, chip))}
          tone="warning"
        >
          {chip.label}
        </Chip>
      ))}
    </div>
  );

  const addCustom = () => {
    const next = addCustomComplaint(findings, trimmed);
    if (!next) return;
    onChange(edKey.custom, next);
    setQuery("");
  };

  const remove = (id: string) => {
    if (id.startsWith(CUSTOM_MAIN_PREFIX)) {
      onChange(
        edKey.custom,
        removeCustomComplaint(findings, id.slice(CUSTOM_MAIN_PREFIX.length)),
      );
    } else {
      onChange(edKey.problem(id), { on: false });
    }
    if (mainComplaintId(findings) === id) onChange(edKey.main, {});
  };

  return (
    <section className="ed-panel" aria-labelledby="ed-problems-title">
      <h2 className="ed-sr" id="ed-problems-title">
        病人的主訴
      </h2>
      <div className="ed-search">
        <input
          aria-label="搜尋症狀"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results.length === 0) addCustom();
          }}
          placeholder="搜尋症狀，或輸入自訂主訴"
          value={query}
        />
        {query ? (
          <button className="ed-link" onClick={() => setQuery("")} type="button">
            清除
          </button>
        ) : null}
      </div>

      {trimmed ? (
        <div className="ed-results" data-testid="ed-search-results">
          <div className="ed-grid">
            {results.map(problemChip)}
            <button className="ed-chip ed-chip--add" onClick={addCustom} type="button">
              ＋自訂「{trimmed}」
            </button>
          </div>
        </div>
      ) : null}

      {complaints.length > 0 ? (
        <div className="ed-selected" data-testid="ed-selected">
          {complaints.map((entry, index) => {
            const code = durationCode(findings, entry.id);
            return (
              <div
                className={`ed-selected__row ${index === 0 ? "is-main" : ""}`}
                key={entry.id}
              >
                {index === 0 ? (
                  <span className="ed-star" title="主訴（只有這一個寫進 CC）">
                    ★
                  </span>
                ) : (
                  <button
                    aria-label={`設為主訴：${entry.label}`}
                    className="ed-star is-off"
                    onClick={() => onChange(edKey.main, { sel: entry.id })}
                    type="button"
                  >
                    ☆
                  </button>
                )}
                <span className="ed-selected__label">
                  {entry.label}
                  {entry.kind === "custom" ? <small>自訂</small> : null}
                </span>
                <button
                  aria-label={`時間：${entry.label}`}
                  className={`ed-c ed-dur ${code ? "is-pos" : ""}`}
                  onClick={() =>
                    onChange(edKey.duration, cycleDuration(findings, entry.id))
                  }
                  type="button"
                >
                  {code ? DURATION_LABELS[code] : "時間"}
                </button>
                {code === "CUSTOM" ? (
                  <input
                    aria-label={`自訂時間：${entry.label}`}
                    className="ed-dur__custom"
                    onChange={(event) =>
                      onChange(
                        edKey.duration,
                        setCustomDuration(findings, entry.id, event.target.value),
                      )
                    }
                    placeholder="例 since 22:00"
                    value={customDuration(findings, entry.id)}
                  />
                ) : null}
                <button
                  aria-label={`移除：${entry.label}`}
                  className="ed-x"
                  onClick={() => remove(entry.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div className="ed-preview" aria-live="polite">
            <b>CC</b>
            <span data-testid="ed-cc-preview">{composeCC(selected, findings)}</span>
          </div>
        </div>
      ) : null}

      {showPain ? (
        <div className="ed-grid ed-grid--nrs">
          <span className="ed-grid__label">NRS</span>
          {NRS_CHIPS.map((chip) => (
            <Chip
              active={ctx("nrs") === chip}
              key={chip}
              label={`NRS ${chip}`}
              onClick={() => setCtx("nrs", ctx("nrs") === chip ? "" : chip)}
            >
              {chip}
            </Chip>
          ))}
        </div>
      ) : null}

      {CHIP_SECTIONS.filter((entry) => !entry.minor).map(section)}
      {CHIP_SECTIONS.filter((entry) => entry.minor).map((entry) => (
        <details
          className="ed-tri"
          key={entry.key}
          open={entry.chips.some((chip) => chipActive(findings, chip))}
        >
          <summary>{entry.title}（婦科、耳鼻喉、眼、皮膚、出血、精神）</summary>
          {section(entry)}
        </details>
      ))}

      <label className="ed-line">
        <span>CC補充</span>
        <input
          aria-label="主訴補充"
          onChange={(event) => setCtx("ccExtra", event.target.value)}
          placeholder="例 with chest tightness"
          value={ctx("ccExtra")}
        />
      </label>
      <label className="ed-line">
        <span>轉診</span>
        <input
          aria-label="轉診來源"
          onChange={(event) => setCtx("referral", event.target.value)}
          placeholder="例 OPD / 他院 ER（寫進 PI 開頭）"
          value={ctx("referral")}
        />
      </label>
    </section>
  );
}
