import type { FindingValue } from "../clinical/finding";
import { HISTORY_ITEMS, PMH_ITEMS, SYSTEM_ORDER, historyItem } from "./history-library";
import {
  PE_COLLAPSED_NORMAL,
  PE_FIELD_ORDER,
  PE_ITEMS,
  PE_SHORT_NORMAL,
  peItem,
} from "./pe-library";
import { ED_PROBLEMS } from "./problems";
import {
  edKey,
  type EdContextKey,
  type EdFieldKey,
  type EdPeField,
  type EdProblem,
  type EdSystemKey,
  type HistoryItem,
  type IcdChoice,
  type PeItem,
} from "./types";

export type EdFindings = Readonly<Record<string, FindingValue | undefined>>;

export interface EdPatientContext {
  sex: string;
  age: string;
}

/** 病歷表單各欄位字數上限（ERS createRecord 的 maxlength）。 */
export const FIELD_LIMITS: Readonly<Record<EdFieldKey, number>> = {
  CC: 180,
  NRS: 60,
  PI: 240,
  PH: 180,
  GC: 120,
  HEENT: 60,
  NECK: 60,
  CHEST: 120,
  ABD: 120,
  BACK: 60,
  GU: 60,
  RECTAL: 60,
  EXT: 60,
  NEURO: 60,
};

export const FIELD_ORDER: readonly EdFieldKey[] = [
  "CC",
  "NRS",
  "PI",
  "PH",
  ...PE_FIELD_ORDER,
];

/** 表單最多 5 筆 ICD。 */
export const MAX_ICD = 5;

const text = (finding: FindingValue | undefined) => (finding?.text ?? "").trim();

// ───────────── 問題選擇 ─────────────

/** 已選問題，依選取順序排列（第一個 = 主要問題）。 */
export function selectedProblems(findings: EdFindings): EdProblem[] {
  const picked: { problem: EdProblem; seq: number }[] = [];
  for (const problem of ED_PROBLEMS) {
    const finding = findings[edKey.problem(problem.id)];
    if (finding?.on) {
      const seq = Number(finding.note);
      picked.push({ problem, seq: Number.isFinite(seq) ? seq : 0 });
    }
  }
  return picked.sort((a, b) => a.seq - b.seq).map((entry) => entry.problem);
}

export function toggleProblemFinding(
  findings: EdFindings,
  problemId: string,
): FindingValue {
  const current = findings[edKey.problem(problemId)];
  if (current?.on) return { on: false };
  const used = ED_PROBLEMS.map((problem) => findings[edKey.problem(problem.id)])
    .filter((finding) => finding?.on)
    .map((finding) => Number(finding?.note) || 0);
  return { on: true, note: String(Math.max(0, ...used) + 1) };
}

// ───────────── 問診題排版 ─────────────

export interface InterviewItem {
  id: string;
  /** 任一已選問題將此題列為紅旗。 */
  must: boolean;
  /** 哪些問題要求這題（用來顯示「為什麼問」）。 */
  reasons: string[];
}

export interface InterviewBlock {
  key: string;
  title: string;
  items: InterviewItem[];
}

export interface Interview {
  /** 各問題的特徵題（起病、性質…）。 */
  characterize: InterviewBlock[];
  /** 依系統合併後的核心問診。 */
  core: InterviewBlock[];
  /** 因病史勾選而追加。 */
  conditional: InterviewBlock | null;
  /** 視情況再問（預設收合）。 */
  more: InterviewBlock[];
}

/** 女性且 12–55 歲（年齡空白也算）。 */
export function isFertilePatient(patient: EdPatientContext): boolean {
  if (patient.sex !== "女 F") return false;
  const age = Number.parseInt(patient.age, 10);
  return Number.isNaN(age) || (age >= 12 && age <= 55);
}

function itemVisible(item: HistoryItem, patient: EdPatientContext): boolean {
  return item.gate === "fertile" ? isFertilePatient(patient) : true;
}

function groupBySystem(
  ids: readonly string[],
  meta: ReadonlyMap<string, InterviewItem>,
  suffix: string,
): InterviewBlock[] {
  const bySystem = new Map<EdSystemKey, InterviewItem[]>();
  for (const id of ids) {
    const item = historyItem(id);
    const entry = meta.get(id);
    if (!item || !entry) continue;
    bySystem.set(item.system, [...(bySystem.get(item.system) ?? []), entry]);
  }
  const libraryIndex = new Map(HISTORY_ITEMS.map((item, index) => [item.id, index]));
  return SYSTEM_ORDER.filter((system) => bySystem.has(system)).map((system) => ({
    key: `${suffix}.${system}`,
    title: system,
    items: [...(bySystem.get(system) ?? [])].sort(
      (a, b) => (libraryIndex.get(a.id) ?? 0) - (libraryIndex.get(b.id) ?? 0),
    ),
  }));
}

export function pmhPositiveIds(findings: EdFindings): string[] {
  return PMH_ITEMS.filter((item) => findings[edKey.pmh(item.id)]?.on).map(
    (item) => item.id,
  );
}

export function buildInterview(
  problems: readonly EdProblem[],
  findings: EdFindings,
  patient: EdPatientContext,
): Interview {
  const meta = new Map<string, InterviewItem>();
  const seen = new Set<string>();

  const register = (id: string, reason: string, must: boolean) => {
    const item = historyItem(id);
    if (!item || !itemVisible(item, patient)) return false;
    const entry = meta.get(id) ?? { id, must: false, reasons: [] };
    entry.must ||= must;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    meta.set(id, entry);
    return true;
  };

  // 1) 特徵題：每個問題一組，已出現過的不重複。
  const characterize: InterviewBlock[] = [];
  for (const problem of problems) {
    const items: InterviewItem[] = [];
    for (const id of problem.characterize) {
      const must = problem.must.includes(id);
      if (!register(id, problem.label, must)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      const entry = meta.get(id);
      if (entry) items.push(entry);
    }
    if (items.length > 0) {
      characterize.push({ key: `char.${problem.id}`, title: problem.label, items });
    }
  }

  // 2) 核心題：所有問題的 ask 取聯集，依系統分組。
  const coreIds: string[] = [];
  for (const problem of problems) {
    for (const id of problem.ask) {
      if (!register(id, problem.label, problem.must.includes(id))) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      coreIds.push(id);
    }
  }
  // 已在特徵題出現、但也被其他問題要求的題，補記 reason（不重複顯示）。
  const core = groupBySystem(coreIds, meta, "core");

  // 3) 病史勾選追加。
  const conditionalIds: string[] = [];
  for (const pmhId of pmhPositiveIds(findings)) {
    const pmh = PMH_ITEMS.find((item) => item.id === pmhId);
    for (const id of pmh?.asks ?? []) {
      if (!register(id, `病史：${pmh?.label ?? pmhId}`, false)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      conditionalIds.push(id);
    }
  }
  const conditional: InterviewBlock | null =
    conditionalIds.length > 0
      ? {
          key: "conditional",
          title: "因病史追加",
          items: conditionalIds
            .map((id) => meta.get(id))
            .filter((entry): entry is InterviewItem => entry !== undefined),
        }
      : null;

  // 4) 視情況再問。
  const moreIds: string[] = [];
  for (const problem of problems) {
    for (const id of problem.askMore) {
      if (!register(id, problem.label, false)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      moreIds.push(id);
    }
  }
  const more = groupBySystem(moreIds, meta, "more");

  return { characterize, core, conditional, more };
}

export function interviewItemIds(interview: Interview, includeMore = true): string[] {
  const blocks = [
    ...interview.characterize,
    ...interview.core,
    ...(interview.conditional ? [interview.conditional] : []),
    ...(includeMore ? interview.more : []),
  ];
  return blocks.flatMap((block) => block.items.map((item) => item.id));
}

// ───────────── PE 排版 ─────────────

export interface PhysicalItem {
  id: string;
  must: boolean;
  reasons: string[];
}

export interface PhysicalSection {
  field: EdPeField;
  core: PhysicalItem[];
  more: PhysicalItem[];
}

export function buildPhysical(problems: readonly EdProblem[]): PhysicalSection[] {
  const meta = new Map<string, PhysicalItem>();
  const coreIds = new Set<string>();
  const moreIds = new Set<string>();
  const note = (id: string, reason: string, must: boolean) => {
    if (!peItem(id)) return;
    const entry = meta.get(id) ?? { id, must: false, reasons: [] };
    entry.must ||= must;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    meta.set(id, entry);
  };
  for (const problem of problems) {
    for (const id of problem.pe) {
      note(id, problem.label, problem.peMust.includes(id));
      coreIds.add(id);
    }
  }
  for (const problem of problems) {
    for (const id of problem.peMore) {
      note(id, problem.label, false);
      if (!coreIds.has(id)) moreIds.add(id);
    }
  }
  const libraryIndex = new Map(PE_ITEMS.map((item, index) => [item.id, index]));
  const byLibrary = (a: PhysicalItem, b: PhysicalItem) =>
    (libraryIndex.get(a.id) ?? 0) - (libraryIndex.get(b.id) ?? 0);
  const pick = (ids: Set<string>, field: EdPeField) =>
    [...ids]
      .filter((id) => peItem(id)?.field === field)
      .map((id) => meta.get(id))
      .filter((entry): entry is PhysicalItem => entry !== undefined)
      .sort(byLibrary);

  return PE_FIELD_ORDER.map((field) => ({
    field,
    core: pick(coreIds, field),
    more: pick(moreIds, field),
  })).filter((section) => section.core.length + section.more.length > 0);
}

// ───────────── 文字產生 ─────────────

function pickOption(item: HistoryItem, finding: FindingValue | undefined) {
  if (item.type !== "pick") return undefined;
  return item.options.find((option) => option.label === finding?.sel);
}

function historyPhrases(
  ids: readonly string[],
  findings: EdFindings,
): { positives: string[]; negatives: string[] } {
  const positives: string[] = [];
  const negatives: string[] = [];
  for (const id of ids) {
    const item = historyItem(id);
    if (!item) continue;
    const finding = findings[edKey.history(id)];
    if (item.type === "pick") {
      const option = pickOption(item, finding);
      if (option) positives.push(option.text);
    } else if (item.type === "text") {
      const value = text(finding);
      if (value) positives.push(item.template.replace("{v}", value));
    } else if (finding?.on === true) {
      const detail = text(finding);
      positives.push(detail ? `${item.pos} (${detail})` : item.pos);
    } else if (finding?.on === false) {
      if (item.negPhrase) positives.push(item.negPhrase);
      else negatives.push(item.neg ?? item.pos);
    }
  }
  return { positives, negatives };
}

export function composeCC(
  problems: readonly EdProblem[],
  findings: EdFindings,
): string {
  const phrases = problems.map((problem) => {
    if (!problem.ccFrom) return problem.cc;
    const item = historyItem(problem.ccFrom);
    const option = item
      ? pickOption(item, findings[edKey.history(problem.ccFrom)])
      : undefined;
    if (!option?.cc) return problem.cc;
    return problem.ccMode === "replace" ? option.cc : `${option.cc} ${problem.cc}`;
  });
  const unique = [...new Set(phrases)];
  const duration = text(findings[edKey.ctx("duration")]);
  const extra = text(findings[edKey.ctx("ccExtra")]);
  const head = [unique.join(", "), duration].filter(Boolean).join(" ");
  return [head, extra].filter(Boolean).join(", ");
}

/** 只回傳分數；帶入 ERS 時由油猴腳本寫成「NRS:6」。 */
export function composeNRS(findings: EdFindings): string {
  return text(findings[edKey.ctx("nrs")]);
}

export function composePI(
  problems: readonly EdProblem[],
  findings: EdFindings,
  patient: EdPatientContext,
): string {
  const interview = buildInterview(problems, findings, patient);
  const { positives, negatives } = historyPhrases(
    interviewItemIds(interview),
    findings,
  );
  const referral = text(findings[edKey.ctx("referral")]);
  const lead = referral ? [`referred from ${referral}`] : [];
  const positiveText = [...lead, ...positives].join(", ");
  const negativeText = negatives.length > 0 ? `no ${negatives.join(", ")}` : "";
  return [positiveText, negativeText].filter(Boolean).join(". ");
}

const TOCC_LETTERS: readonly ["t" | "o" | "c1" | "c2", string][] = [
  ["t", "T"],
  ["o", "O"],
  ["c1", "C"],
  ["c2", "C"],
];

export function composeTOCC(findings: EdFindings): string {
  const answered = TOCC_LETTERS.some(([key]) => findings[edKey.tocc(key)]?.sel);
  if (!answered) return "";
  return TOCC_LETTERS.map(([key, letter]) => {
    const finding = findings[edKey.tocc(key)];
    if (finding?.sel === "+") {
      const detail = text(finding);
      return detail ? `${letter}(+: ${detail})` : `${letter}(+)`;
    }
    return finding?.sel === "-" ? `${letter}(-)` : `${letter}(?)`;
  }).join(" ");
}

export function composePH(findings: EdFindings): string {
  const parts: string[] = [];
  const history = PMH_ITEMS.filter((item) => findings[edKey.pmh(item.id)]?.on).map(
    (item) => {
      const detail = text(findings[edKey.pmh(item.id)]);
      const base = item.text ?? item.label;
      return detail ? `${base} (${detail})` : base;
    },
  );
  if (history.length > 0) parts.push(`HX: ${history.join(", ")}`);
  const meds = text(findings[edKey.ctx("meds")]);
  if (meds) parts.push(`Med: ${meds}`);
  const tocc = composeTOCC(findings);
  if (tocc) parts.push(tocc);
  const allergy = text(findings[edKey.ctx("allergy")]);
  if (allergy) parts.push(`Drug allergy: ${allergy}`);
  return parts.join("; ");
}

function peClause(
  item: PeItem,
  finding: FindingValue | undefined,
  compact: boolean,
): string {
  if (finding?.sel === "normal") {
    return compact ? (PE_SHORT_NORMAL[item.id] ?? item.normal) : item.normal;
  }
  if (finding?.sel !== "abn") return "";
  const chosen = item.abnormal.filter((phrase) => finding.fu?.[phrase] === "1");
  const note = (finding.note ?? "").trim();
  let body = "";
  if (chosen.length > 0) {
    body = item.abnormalTemplate
      ? item.abnormalTemplate.replace("{v}", chosen.join("/"))
      : chosen.join(", ");
  }
  return [body, note].filter(Boolean).join(", ");
}

export function composePeField(
  field: EdPeField,
  itemIds: readonly string[],
  findings: EdFindings,
): string {
  const items = itemIds
    .map((id) => peItem(id))
    .filter((item): item is PeItem => item !== undefined && item.field === field);
  const limit = FIELD_LIMITS[field];
  const render = (compact: boolean) =>
    items
      .map((item) => peClause(item, findings[edKey.pe(item.id)], compact))
      .filter(Boolean)
      .join(", ");
  const full = render(false);
  if (full.length <= limit) return full;
  const compact = render(true);
  if (compact.length <= limit) return compact;

  // 最後手段：異常照寫，其餘正常項目合併成一句。
  const abnormal = items
    .filter((item) => findings[edKey.pe(item.id)]?.sel === "abn")
    .map((item) => peClause(item, findings[edKey.pe(item.id)], true))
    .filter(Boolean);
  const normalCount = items.filter(
    (item) => findings[edKey.pe(item.id)]?.sel === "normal",
  ).length;
  if (normalCount > 0) {
    abnormal.push(abnormal.length > 0 ? "others normal" : PE_COLLAPSED_NORMAL[field]);
  }
  return abnormal.join(", ");
}

// ───────────── ICD ─────────────

const KNOWN_ICD = new Map<string, IcdChoice>();
for (const problem of ED_PROBLEMS) {
  for (const choice of problem.icd) {
    if (!KNOWN_ICD.has(choice.code)) KNOWN_ICD.set(choice.code, choice);
  }
}

export function knownIcdDescription(code: string): string {
  return KNOWN_ICD.get(code.toUpperCase())?.desc ?? "";
}

export const KNOWN_ICD_CODES: readonly IcdChoice[] = [...KNOWN_ICD.values()];

export interface IcdCandidate extends IcdChoice {
  problemId: string;
  on: boolean;
}

function icdDefault(choice: IcdChoice, findings: EdFindings): boolean {
  const matched =
    choice.whenPick !== undefined &&
    findings[edKey.history(choice.whenPick.item)]?.sel === choice.whenPick.option;
  if (matched) return true;
  if (!choice.defaultOn) return false;
  if (choice.offWhenPicked && findings[edKey.history(choice.offWhenPicked)]?.sel) {
    return false;
  }
  return true;
}

export function icdCandidates(
  problems: readonly EdProblem[],
  findings: EdFindings,
): IcdCandidate[] {
  const overrides = findings[edKey.icd]?.fu ?? {};
  const seen = new Set<string>();
  const candidates: IcdCandidate[] = [];
  for (const problem of problems) {
    for (const choice of problem.icd) {
      if (seen.has(choice.code)) continue;
      seen.add(choice.code);
      const override = overrides[choice.code];
      const on =
        override === undefined ? icdDefault(choice, findings) : override === "1";
      candidates.push({ ...choice, problemId: problem.id, on });
    }
  }
  return candidates;
}

export function customIcdCodes(findings: EdFindings): string[] {
  return text(findings[edKey.icd])
    .split(/[\s,;，；]+/)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]\d[0-9A-Z]{1,2}(\.[0-9A-Z]{1,4})?$/.test(code));
}

export interface IcdLine {
  code: string;
  desc: string;
}

export function composeIcd(
  problems: readonly EdProblem[],
  findings: EdFindings,
): IcdLine[] {
  const lines: IcdLine[] = icdCandidates(problems, findings)
    .filter((candidate) => candidate.on)
    .map(({ code, desc }) => ({ code, desc }));
  for (const code of customIcdCodes(findings)) {
    if (!lines.some((line) => line.code === code)) {
      lines.push({ code, desc: knownIcdDescription(code) });
    }
  }
  return lines;
}

// ───────────── 完整病歷 ─────────────

export interface MissingItem {
  kind: "history" | "pe";
  id: string;
  label: string;
  reasons: string[];
}

export interface EdChart {
  fields: Record<EdFieldKey, string>;
  overridden: EdFieldKey[];
  overLimit: EdFieldKey[];
  icd: IcdLine[];
  /** ICD 超過表單可容納的 5 筆時，被捨去的代碼。 */
  icdDropped: IcdLine[];
  missing: MissingItem[];
}

function answeredHistory(id: string, findings: EdFindings): boolean {
  const item = historyItem(id);
  const finding = findings[edKey.history(id)];
  if (!item) return true;
  if (item.type === "yn") return finding?.on === true || finding?.on === false;
  if (item.type === "pick") return Boolean(finding?.sel);
  return text(finding).length > 0;
}

function answeredPe(id: string, findings: EdFindings): boolean {
  const sel = findings[edKey.pe(id)]?.sel;
  return sel === "normal" || sel === "abn";
}

export function composeChart(findings: EdFindings, patient: EdPatientContext): EdChart {
  const problems = selectedProblems(findings);
  const interview = buildInterview(problems, findings, patient);
  const physical = buildPhysical(problems);

  const fields = Object.fromEntries(FIELD_ORDER.map((key) => [key, ""])) as Record<
    EdFieldKey,
    string
  >;
  fields.CC = composeCC(problems, findings);
  fields.NRS = composeNRS(findings);
  fields.PI = composePI(problems, findings, patient);
  fields.PH = composePH(findings);
  for (const section of physical) {
    const ids = [...section.core, ...section.more].map((item) => item.id);
    fields[section.field] = composePeField(section.field, ids, findings);
  }

  const overridden: EdFieldKey[] = [];
  for (const key of FIELD_ORDER) {
    const override = findings[edKey.override(key)];
    if (override?.on) {
      // 不 trim：使用者還在打字時，結尾空白不能被吃掉；輸出文字時才會 trim。
      fields[key] = override.text ?? "";
      overridden.push(key);
    }
  }
  const overLimit = FIELD_ORDER.filter((key) => fields[key].length > FIELD_LIMITS[key]);

  const allIcd = composeIcd(problems, findings);

  const missing: MissingItem[] = [];
  for (const block of [...interview.characterize, ...interview.core]) {
    for (const item of block.items) {
      if (item.must && !answeredHistory(item.id, findings)) {
        missing.push({
          kind: "history",
          id: item.id,
          label: historyItem(item.id)?.label ?? item.id,
          reasons: item.reasons,
        });
      }
    }
  }
  for (const section of physical) {
    for (const item of section.core) {
      if (item.must && !answeredPe(item.id, findings)) {
        missing.push({
          kind: "pe",
          id: item.id,
          label: peItem(item.id)?.label ?? item.id,
          reasons: item.reasons,
        });
      }
    }
  }

  return {
    fields,
    overridden,
    overLimit,
    icd: allIcd.slice(0, MAX_ICD),
    icdDropped: allIcd.slice(MAX_ICD),
    missing,
  };
}

export function edContextValue(findings: EdFindings, key: EdContextKey): string {
  return text(findings[edKey.ctx(key)]);
}
