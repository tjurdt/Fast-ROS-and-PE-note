import {
  composeCC,
  selectedProblems,
  toggleProblemFinding,
  type EdFindings,
} from "../../domain/ed/compose";
import { ED_PROBLEMS, PROBLEM_GROUP_ORDER } from "../../domain/ed/problems";
import { edKey, type EdContextKey } from "../../domain/ed/types";
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
  const selected = selectedProblems(findings);
  const ctx = (key: EdContextKey) => findings[edKey.ctx(key)]?.text ?? "";
  const setCtx = (key: EdContextKey, value: string) =>
    onChange(edKey.ctx(key), { text: value });
  const showPain = selected.some((problem) => problem.pain);

  return (
    <section className="v2-card ed-panel" aria-labelledby="ed-problems-title">
      <h2 id="ed-problems-title">病人的問題（可複選）</h2>
      <p className="ed-help">
        依病人主訴點選，後面的問診與 PE
        會自動合併成一份，重複的題目只問一次。第一個選的是主要問題。
      </p>

      {PROBLEM_GROUP_ORDER.map((group) => (
        <div className="ed-group" key={group}>
          <h3>{group}</h3>
          <div className="ed-chips">
            {ED_PROBLEMS.filter((problem) => problem.group === group).map((problem) => {
              const index = selected.findIndex((entry) => entry.id === problem.id);
              return (
                <Chip
                  active={index >= 0}
                  key={problem.id}
                  onClick={() =>
                    onChange(
                      edKey.problem(problem.id),
                      toggleProblemFinding(findings, problem.id),
                    )
                  }
                  tone="warning"
                >
                  {index >= 0 ? `${index + 1}. ` : ""}
                  {problem.label}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}

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
          {selected.length > 0 ? composeCC(selected, findings) : "（先選問題）"}
        </span>
      </div>
    </section>
  );
}
