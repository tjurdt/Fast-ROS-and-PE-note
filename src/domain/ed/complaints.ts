import type { FindingValue } from "../clinical/finding";
import { KEYWORDS } from "./keywords";
import { ED_PROBLEMS } from "./problems";
import { edKey, type EdProblem } from "./types";

/**
 * 主訴的選擇：搜尋、常用、自訂主訴與「指定主訴」。
 *
 * - 標準問題（`ED_PROBLEMS`）：點選後帶出題庫（問診、PE、檢查建議、ICD）。
 * - 自訂主訴：找不到合適的症狀時自己打；只寫進 CC，不帶題庫（其餘用「補充」欄補）。
 * - 指定主訴：任一已選主訴可標為主要；沒指定時，第一個選的就是主要。
 */

/** 急診最常見的主訴（依歷史病歷 ICD 排序），畫面最上面一排。 */
export const COMMON_PROBLEM_IDS: readonly string[] = [
  "fever",
  "abd_pain",
  "chest_pain",
  "dyspnea",
  "dizziness",
  "headache",
  "nausea_vomiting",
  "diarrhea",
  "weakness",
  "urinary",
  "trauma",
  "back_pain",
];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/** 依輸入搜尋標準問題；空白回傳空陣列。比對標籤、英文主訴與關鍵字。 */
export function searchProblems(query: string): EdProblem[] {
  const needle = normalize(query);
  if (!needle) return [];
  const scored: { problem: EdProblem; score: number }[] = [];
  for (const problem of ED_PROBLEMS) {
    const label = normalize(problem.label);
    const hint = normalize(problem.hint ?? "");
    const cc = normalize(problem.cc);
    const words = (KEYWORDS[problem.id] ?? []).map(normalize);
    let score = 0;
    if (label === needle || words.includes(needle)) score = 100;
    else if (label.includes(needle) || cc.includes(needle) || hint.includes(needle))
      score = 60;
    else if (words.some((word) => word.includes(needle) || needle.includes(word)))
      score = 40;
    if (score > 0) scored.push({ problem, score });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        ED_PROBLEMS.indexOf(a.problem) - ED_PROBLEMS.indexOf(b.problem),
    )
    .map((entry) => entry.problem);
}

/** 給測試：每個問題都要有搜尋關鍵字。 */
export function keywordProblemIds(): string[] {
  return Object.keys(KEYWORDS);
}

// ───────────── 自訂主訴 ─────────────

export interface CustomComplaint {
  phrase: string;
  seq: number;
}

export function customComplaints(
  findings: Readonly<Record<string, FindingValue | undefined>>,
): CustomComplaint[] {
  const stored = findings[edKey.custom]?.fu ?? {};
  return Object.entries(stored)
    .map(([phrase, seq]) => ({ phrase, seq: Number(seq) || 0 }))
    .filter((entry) => entry.phrase.trim() !== "")
    .sort((a, b) => a.seq - b.seq);
}

/** 目前最大的選取順序（標準問題與自訂主訴共用同一個序號）。 */
export function maxComplaintSeq(
  findings: Readonly<Record<string, FindingValue | undefined>>,
): number {
  const problemSeqs = ED_PROBLEMS.map((problem) => findings[edKey.problem(problem.id)])
    .filter((finding) => finding?.on)
    .map((finding) => Number(finding?.note) || 0);
  const customSeqs = customComplaints(findings).map((entry) => entry.seq);
  return Math.max(0, ...problemSeqs, ...customSeqs);
}

export function addCustomComplaint(
  findings: Readonly<Record<string, FindingValue | undefined>>,
  rawPhrase: string,
): FindingValue | null {
  const phrase = rawPhrase.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!phrase) return null;
  const current = findings[edKey.custom]?.fu ?? {};
  if (phrase in current) return null;
  return {
    ...(findings[edKey.custom] ?? {}),
    fu: { ...current, [phrase]: String(maxComplaintSeq(findings) + 1) },
  };
}

export function removeCustomComplaint(
  findings: Readonly<Record<string, FindingValue | undefined>>,
  phrase: string,
): FindingValue {
  const next = { ...(findings[edKey.custom]?.fu ?? {}) };
  delete next[phrase];
  return { ...(findings[edKey.custom] ?? {}), fu: next };
}

// ───────────── 指定主訴 ─────────────

export const CUSTOM_MAIN_PREFIX = "custom:";

/** `ed.main` 的值：標準問題 id，或 `custom:<phrase>`；空字串 = 沒指定（第一個選的就是主訴）。 */
export function mainComplaintId(
  findings: Readonly<Record<string, FindingValue | undefined>>,
): string {
  return findings[edKey.main]?.sel ?? "";
}

export interface ComplaintEntry {
  /** 標準問題用問題 id；自訂主訴用 `custom:<phrase>`。 */
  id: string;
  kind: "problem" | "custom";
  label: string;
  seq: number;
}

/** 所有已選主訴（標準＋自訂），指定的主訴排第一，其餘依選取順序。 */
export function selectedComplaints(
  findings: Readonly<Record<string, FindingValue | undefined>>,
): ComplaintEntry[] {
  const entries: ComplaintEntry[] = [];
  for (const problem of ED_PROBLEMS) {
    const finding = findings[edKey.problem(problem.id)];
    if (finding?.on) {
      const seq = Number(finding.note);
      entries.push({
        id: problem.id,
        kind: "problem",
        label: problem.label,
        seq: Number.isFinite(seq) ? seq : 0,
      });
    }
  }
  for (const custom of customComplaints(findings)) {
    entries.push({
      id: `${CUSTOM_MAIN_PREFIX}${custom.phrase}`,
      kind: "custom",
      label: custom.phrase,
      seq: custom.seq,
    });
  }
  entries.sort((a, b) => a.seq - b.seq);
  const main = mainComplaintId(findings);
  const at = entries.findIndex((entry) => entry.id === main);
  if (at > 0) entries.unshift(...entries.splice(at, 1));
  return entries;
}
