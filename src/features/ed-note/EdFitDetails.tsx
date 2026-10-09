import type { FindingValue } from "../../domain/clinical/finding";
import type { ClauseState, FieldDetail } from "../../domain/ed/condense";
import { edKey } from "../../domain/ed/types";
import type { EdFindingChange } from "./ed-controls";

interface EdFitDetailsProps {
  title: string;
  detail: FieldDetail;
  onChange: EdFindingChange;
  onBulkChange: (patch: Record<string, FindingValue>) => void;
}

const STATE_LABEL: Record<ClauseState, string> = {
  in: "",
  auto: "超過字數，自動略過",
  user: "你指定不寫入",
  kept: "你指定一定寫入",
};

/** 勾選 = 寫入。取消勾選 → 不寫入；勾回自動略過的 → 一定寫入；再切一次回到自動。 */
function nextOverride(state: ClauseState): FindingValue {
  if (state === "in" || state === "kept") return { sel: "omit" };
  if (state === "auto") return { sel: "keep" };
  return {};
}

/** 逐句明細：每一句都可以決定寫不寫入，超過字數時一眼看出被略過的是哪些。 */
export function EdFitDetails({
  title,
  detail,
  onChange,
  onBulkChange,
}: EdFitDetailsProps) {
  if (detail.clauses.length === 0) return null;
  const written = detail.clauses.filter(
    (clause) => clause.state === "in" || clause.state === "kept",
  ).length;
  const auto = detail.clauses.filter((clause) => clause.state === "auto").length;
  const edited = detail.clauses.filter(
    (clause) => clause.state === "user" || clause.state === "kept",
  );
  const reset = () => {
    const patch: Record<string, FindingValue> = {};
    for (const clause of edited) patch[edKey.omit(clause.id)] = {};
    onBulkChange(patch);
  };
  return (
    <details className="ed-fit" data-testid={`ed-fit-${title}`}>
      <summary>
        逐句明細（寫入 {written}／{detail.clauses.length} 句
        {auto > 0 ? `，自動略過 ${auto} 句` : ""}）
      </summary>
      <ul>
        {detail.clauses.map((clause) => (
          <li className={`is-${clause.state}`} key={clause.id}>
            <label>
              <input
                aria-label={`${title}：${clause.text}`}
                checked={clause.state === "in" || clause.state === "kept"}
                onChange={() =>
                  onChange(edKey.omit(clause.id), nextOverride(clause.state))
                }
                type="checkbox"
              />
              <span className="ed-fit__text">{clause.text}</span>
              {STATE_LABEL[clause.state] ? (
                <small className="ed-fit__state">{STATE_LABEL[clause.state]}</small>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
      {edited.length > 0 ? (
        <button className="ed-link" onClick={reset} type="button">
          還原本欄的手動設定
        </button>
      ) : null}
    </details>
  );
}
