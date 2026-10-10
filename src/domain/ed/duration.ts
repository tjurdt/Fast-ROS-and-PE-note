import type { FindingValue } from "../clinical/finding";
import { edKey } from "./types";

/**
 * 每個已選主訴各自的時間（取代舊的單一「主訴時間」）。
 *
 * 畫面上是循環按鈕：未標 → TODAY → 2HOUR → … → 1W → 自訂 → 未標。
 * 存在 `ed.dur`：fu[主訴 id] = 代碼，grp[主訴 id] = 自訂文字。
 */
export const DURATION_CYCLE = [
  "TODAY",
  "2H",
  "6H",
  "12H",
  "1D",
  "2D",
  "3D",
  "5D",
  "1W",
  "CUSTOM",
] as const;

export type DurationCode = (typeof DURATION_CYCLE)[number];

export const DURATION_LABELS: Readonly<Record<DurationCode, string>> = {
  TODAY: "TODAY",
  "2H": "2HOUR",
  "6H": "6HOUR",
  "12H": "12HOUR",
  "1D": "1D",
  "2D": "2D",
  "3D": "3D",
  "5D": "5D",
  "1W": "1W",
  CUSTOM: "自訂",
};

const PHRASES: Readonly<Record<Exclude<DurationCode, "CUSTOM">, string>> = {
  TODAY: "today",
  "2H": "for 2 hours",
  "6H": "for 6 hours",
  "12H": "for 12 hours",
  "1D": "for 1 day",
  "2D": "for 2 days",
  "3D": "for 3 days",
  "5D": "for 5 days",
  "1W": "for 1 week",
};

/** 3 週內算急性（例如 acute cough）；自訂文字無法判斷，視為未知。 */
const ACUTE_CODES: ReadonlySet<DurationCode> = new Set(
  DURATION_CYCLE.filter((code) => code !== "CUSTOM"),
);

type Findings = Readonly<Record<string, FindingValue | undefined>>;

function isCode(value: string | undefined): value is DurationCode {
  return (DURATION_CYCLE as readonly string[]).includes(value ?? "");
}

export function durationCode(
  findings: Findings,
  complaintId: string,
): DurationCode | "" {
  const value = findings[edKey.duration]?.fu?.[complaintId];
  return isCode(value) ? value : "";
}

/** 自訂時間的原始輸入（不 trim：使用者打字中的空白不能被吃掉）。 */
export function customDuration(findings: Findings, complaintId: string): string {
  return findings[edKey.duration]?.grp?.[complaintId] ?? "";
}

/** 寫進病歷的時間片語；沒標就回傳空字串。 */
export function durationPhrase(findings: Findings, complaintId: string): string {
  const code = durationCode(findings, complaintId);
  if (!code) return "";
  if (code === "CUSTOM") return customDuration(findings, complaintId).trim();
  return PHRASES[code];
}

/** 這個主訴是否確定在急性期（有標時間且不是自訂）。 */
export function isAcuteDuration(findings: Findings, complaintId: string): boolean {
  const code = durationCode(findings, complaintId);
  return code !== "" && ACUTE_CODES.has(code);
}

/** 循環到下一個時間；回傳要存回 `ed.dur` 的新值。 */
export function cycleDuration(findings: Findings, complaintId: string): FindingValue {
  const current = findings[edKey.duration] ?? {};
  const code = durationCode(findings, complaintId);
  const index = code ? DURATION_CYCLE.indexOf(code) : -1;
  const next =
    index + 1 < DURATION_CYCLE.length ? DURATION_CYCLE[index + 1] : undefined;
  const fu = { ...(current.fu ?? {}) };
  if (next) fu[complaintId] = next;
  else delete fu[complaintId];
  return { ...current, fu };
}

export function setCustomDuration(
  findings: Findings,
  complaintId: string,
  value: string,
): FindingValue {
  const current = findings[edKey.duration] ?? {};
  return {
    ...current,
    fu: { ...(current.fu ?? {}), [complaintId]: "CUSTOM" },
    grp: { ...(current.grp ?? {}), [complaintId]: value },
  };
}
