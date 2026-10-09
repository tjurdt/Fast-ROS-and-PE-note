import { useState } from "react";

import {
  COMMON_PROBLEM_IDS,
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
import { ED_PROBLEMS, PROBLEM_GROUP_ORDER } from "../../domain/ed/problems";
import { edKey, type EdContextKey, type EdProblem } from "../../domain/ed/types";
import { Chip, type EdFindingChange } from "./ed-controls";

const DURATION_CHIPS = [
  "today",
  "since yesterday",
  "for 2 days",
  "for 3 days",
  "for 1 week",
  "for 1 month",
];
const NRS_CHIPS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface EdProblemsTabProps {
  findings: EdFindings;
  onChange: EdFindingChange;
}

export function EdProblemsTab({ findings, onChange }: EdProblemsTabProps) {
  const [query, setQuery] = useState("");
  const complaints = selectedComplaints(findings);
  const selected = selectedProblems(findings);
  const ctx = (key: EdContextKey) => findings[edKey.ctx(key)]?.text ?? "";
  const setCtx = (key: EdContextKey, value: string) =>
    onChange(edKey.ctx(key), { text: value });
  const showPain = selected.some((problem) => problem.pain);
  const common = COMMON_PROBLEM_IDS.map((id) =>
    ED_PROBLEMS.find((problem) => problem.id === id),
  ).filter((problem): problem is EdProblem => problem !== undefined);
  const commonIds = new Set(common.map((problem) => problem.id));
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
      tone="warning"
    >
      {problem.label}
    </Chip>
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
    <section className="v2-card ed-panel" aria-labelledby="ed-problems-title">
      <h2 id="ed-problems-title">病人的主訴（可複選）</h2>
      <p className="ed-help">
        直接搜尋症狀（例如「肚子痛」「喘」「頭暈」），或從常用／分類點選；找不到可自訂。
        標★的是主訴，會排在病歷 CC 最前面；後面的問診與 PE 會合併，重複的題目只問一次。
      </p>

      <div className="ed-search">
        <input
          aria-label="搜尋症狀"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results.length === 0) addCustom();
          }}
          placeholder="搜尋症狀，或直接輸入自訂主訴"
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
          {results.length > 0 ? (
            <div className="ed-chips">{results.map(problemChip)}</div>
          ) : (
            <p className="ed-help">題庫沒有符合「{trimmed}」的症狀。</p>
          )}
          <button className="ed-custom-add" onClick={addCustom} type="button">
            ＋ 自訂主訴「{trimmed}」
          </button>
          <p className="ed-help">
            自訂主訴只寫進 CC，不會帶出題庫；其他細節請用問診的「補充」欄寫進 PI。
          </p>
        </div>
      ) : null}

      {complaints.length > 0 ? (
        <div className="ed-selected" data-testid="ed-selected">
          <h3>已選主訴</h3>
          <ul>
            {complaints.map((entry, index) => (
              <li className={index === 0 ? "is-main" : ""} key={entry.id}>
                <span className="ed-selected__label">
                  {index === 0 ? "★ " : ""}
                  {entry.label}
                  {entry.kind === "custom" ? <small>（自訂）</small> : null}
                </span>
                {index === 0 ? (
                  <span className="ed-selected__main">主訴</span>
                ) : (
                  <button
                    aria-label={`設為主訴：${entry.label}`}
                    className="ed-link"
                    onClick={() => onChange(edKey.main, { sel: entry.id })}
                    type="button"
                  >
                    設為主訴
                  </button>
                )}
                <button
                  aria-label={`移除：${entry.label}`}
                  className="ed-link"
                  onClick={() => remove(entry.id)}
                  type="button"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ed-group">
        <h3>常用</h3>
        <div className="ed-chips">{common.map(problemChip)}</div>
      </div>

      {PROBLEM_GROUP_ORDER.map((group) => {
        const members = ED_PROBLEMS.filter(
          (problem) => problem.group === group && !commonIds.has(problem.id),
        );
        if (members.length === 0) return null;
        return (
          <div className="ed-group" key={group}>
            <h3>{group}</h3>
            <div className="ed-chips">{members.map(problemChip)}</div>
          </div>
        );
      })}

      <h3>主訴時間</h3>
      <div className="ed-chips">
        {DURATION_CHIPS.map((chip) => (
          <Chip
            active={ctx("duration") === chip}
            key={chip}
            onClick={() => setCtx("duration", ctx("duration") === chip ? "" : chip)}
          >
            {chip}
          </Chip>
        ))}
      </div>
      <label>
        主訴時間（自由輸入）
        <input
          aria-label="主訴時間"
          onChange={(event) => setCtx("duration", event.target.value)}
          placeholder="例 since 22:00 / x50 times since 22:00"
          value={ctx("duration")}
        />
      </label>
      <label>
        主訴補充
        <input
          aria-label="主訴補充"
          onChange={(event) => setCtx("ccExtra", event.target.value)}
          placeholder="例 with chest tightness"
          value={ctx("ccExtra")}
        />
      </label>
      <label>
        轉診／來源
        <input
          aria-label="轉診來源"
          onChange={(event) => setCtx("referral", event.target.value)}
          placeholder="例 OPD / 他院 ER（寫進 PI 開頭）"
          value={ctx("referral")}
        />
      </label>

      {showPain ? (
        <>
          <h3>疼痛 NRS</h3>
          <div className="ed-chips ed-chips--tight">
            {NRS_CHIPS.map((chip) => (
              <Chip
                active={ctx("nrs") === chip}
                key={chip}
                onClick={() => setCtx("nrs", ctx("nrs") === chip ? "" : chip)}
              >
                {chip}
              </Chip>
            ))}
          </div>
        </>
      ) : null}

      <div className="ed-preview" aria-live="polite">
        <strong>主訴預覽</strong>
        <span data-testid="ed-cc-preview">
          {complaints.length > 0 ? composeCC(selected, findings) : "（先選主訴）"}
        </span>
      </div>
    </section>
  );
}
