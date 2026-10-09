import type { FindingValue } from "../clinical/finding";
import { edKey } from "./types";

/**
 * 字數上限下的「去蕪存菁」：欄位超過 ERS 表單上限時，依重要性自動略過最不重要的句子，
 * 並讓使用者逐句決定要不要寫入。純規則、離線；不改動原始問診答案，只影響輸出文字。
 *
 * 狀態：
 * - in    ：已寫入
 * - auto  ：超過上限，自動略過（可手動勾回）
 * - user  ：使用者指定「不寫入」
 * - kept  ：使用者指定「一定要寫入」（即使超過上限，也不自動略過）
 */
export type ClauseState = "in" | "auto" | "user" | "kept";

export interface Clause {
  id: string;
  text: string;
  /** 重要性，越高越晚被略過；同分時後面的先略過。 */
  score: number;
  /** 鎖定：永不自動略過（例如使用者自己打的補充）。 */
  locked?: boolean;
}

export interface ClauseView {
  id: string;
  text: string;
  state: ClauseState;
}

export interface FieldDetail {
  text: string;
  clauses: ClauseView[];
  limit: number;
  /** 精簡後仍超過上限。 */
  over: boolean;
}

export type ClauseOverride = "keep" | "omit" | undefined;

export function clauseOverride(
  findings: Readonly<Record<string, FindingValue | undefined>>,
  id: string,
): ClauseOverride {
  const sel = findings[edKey.omit(id)]?.sel;
  return sel === "keep" || sel === "omit" ? sel : undefined;
}

/** 是否啟用自動精簡（預設啟用；使用者關閉後輸出完整文字，超過上限只警告）。 */
export function autoFitEnabled(
  findings: Readonly<Record<string, FindingValue | undefined>>,
): boolean {
  return (findings[edKey.ctx("autoFit")]?.text ?? "") !== "off";
}

export function fitClauses<T extends Clause>(
  clauses: readonly T[],
  render: (kept: readonly T[]) => string,
  limit: number,
  override: (id: string) => ClauseOverride,
  auto: boolean,
): FieldDetail {
  const state = new Map<string, ClauseState>();
  let kept: T[] = [];
  for (const clause of clauses) {
    const mode = override(clause.id);
    if (mode === "omit") state.set(clause.id, "user");
    else {
      state.set(clause.id, mode === "keep" ? "kept" : "in");
      kept.push(clause);
    }
  }
  const protectedClause = (clause: T) =>
    clause.locked === true || state.get(clause.id) === "kept";

  if (auto) {
    while (render(kept).length > limit) {
      let victim: T | undefined;
      kept.forEach((clause, index) => {
        if (protectedClause(clause)) return;
        if (
          victim === undefined ||
          clause.score < victim.score ||
          (clause.score === victim.score && index > kept.indexOf(victim))
        ) {
          victim = clause;
        }
      });
      if (!victim) break;
      state.set(victim.id, "auto");
      const dropped = victim;
      kept = kept.filter((clause) => clause !== dropped);
    }
  }
  const text = render(kept);
  return {
    text,
    limit,
    over: text.length > limit,
    clauses: clauses.map((clause) => ({
      id: clause.id,
      text: clause.text,
      state: state.get(clause.id) ?? "in",
    })),
  };
}
