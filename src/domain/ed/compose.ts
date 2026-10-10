import type { FindingValue } from "../clinical/finding";
import { maxComplaintSeq, selectedComplaints, type ComplaintEntry } from "./complaints";
import {
  autoFitEnabled,
  clauseOverride,
  fitClauses,
  type Clause,
  type FieldDetail,
} from "./condense";
import { durationPhrase, isAcuteDuration } from "./duration";
import { HISTORY_ITEMS, PMH_ITEMS, SYSTEM_ORDER, historyItem } from "./history-library";
import {
  PE_COLLAPSED_NORMAL,
  PE_FIELD_ORDER,
  PE_ITEMS,
  PE_SHORT_NORMAL,
  peItem,
} from "./pe-library";
import { ED_PROBLEMS } from "./problems";
import { SPECIAL_ITEMS, specialPhrase } from "./special";
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

/** 已選標準問題：指定的主訴排第一，其餘依選取順序。自訂主訴不在這裡（沒有題庫）。 */
export function selectedProblems(findings: EdFindings): EdProblem[] {
  const byId = new Map(ED_PROBLEMS.map((problem) => [problem.id, problem]));
  return selectedComplaints(findings)
    .filter((entry) => entry.kind === "problem")
    .map((entry) => byId.get(entry.id))
    .filter((problem): problem is EdProblem => problem !== undefined);
}

export function toggleProblemFinding(
  findings: EdFindings,
  problemId: string,
): FindingValue {
  const current = findings[edKey.problem(problemId)];
  if (current?.on) return { on: false };
  return { on: true, note: String(maxComplaintSeq(findings) + 1) };
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

interface HistoryClause extends Clause {
  kind: "lead" | "pos" | "neg" | "extra";
}

/** 一題問診 → 一句：陽性寫進正文，陰性併入「no …」。 */
function historyClause(
  id: string,
  findings: EdFindings,
  must: boolean,
): HistoryClause | null {
  const item = historyItem(id);
  if (!item) return null;
  const finding = findings[edKey.history(id)];
  const clauseId = `h.${id}`;
  if (item.type === "pick") {
    const option = pickOption(item, finding);
    return option
      ? { id: clauseId, kind: "pos", text: option.text, score: must ? 80 : 60 }
      : null;
  }
  if (item.type === "text") {
    const value = text(finding);
    return value
      ? {
          id: clauseId,
          kind: "pos",
          text: item.template.replace("{v}", value),
          score: must ? 80 : 60,
        }
      : null;
  }
  if (finding?.on === true) {
    const detail = text(finding);
    return {
      id: clauseId,
      kind: "pos",
      text: detail ? `${item.pos} (${detail})` : item.pos,
      score: must ? 80 : detail ? 60 : 50,
    };
  }
  if (finding?.on === false) {
    if (item.negPhrase) {
      return { id: clauseId, kind: "pos", text: item.negPhrase, score: must ? 80 : 50 };
    }
    return {
      id: clauseId,
      kind: "neg",
      text: item.neg ?? item.pos,
      score: must ? 40 : 10,
    };
  }
  return null;
}

/** 一個主訴的英文片語（含 ccFrom 修飾），不含時間。 */
function complaintPhrase(
  entry: ComplaintEntry,
  byId: ReadonlyMap<string, EdProblem>,
  findings: EdFindings,
): string {
  if (entry.kind === "custom") return entry.label;
  const problem = byId.get(entry.id);
  if (!problem) return "";
  if (!problem.ccFrom) return problem.cc;
  const item = historyItem(problem.ccFrom);
  const option = item
    ? pickOption(item, findings[edKey.history(problem.ccFrom)])
    : undefined;
  if (!option?.cc) return problem.cc;
  return problem.ccMode === "replace" ? option.cc : `${option.cc} ${problem.cc}`;
}

/** 主訴片語＋該主訴自己的時間，例如 "RUQ abd pain for 2 days"。 */
function complaintWithDuration(
  entry: ComplaintEntry,
  byId: ReadonlyMap<string, EdProblem>,
  findings: EdFindings,
): string {
  return [complaintPhrase(entry, byId, findings), durationPhrase(findings, entry.id)]
    .filter(Boolean)
    .join(" ");
}

/**
 * CC 只寫一個主訴（標★的那個）。其他已選症狀改寫進 PI 開頭，不塞進 CC。
 * 舊資料的單一「主訴時間」（ed.ctx.duration）在主訴沒有自己的時間時沿用。
 */
export function composeCC(
  problems: readonly EdProblem[],
  findings: EdFindings,
): string {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const main = selectedComplaints(findings)[0];
  if (!main) return text(findings[edKey.ctx("ccExtra")]);
  const phrase = complaintPhrase(main, byId, findings);
  const duration =
    durationPhrase(findings, main.id) || text(findings[edKey.ctx("duration")]);
  const extra = text(findings[edKey.ctx("ccExtra")]);
  const head = [phrase, duration].filter(Boolean).join(" ");
  return [head, extra].filter(Boolean).join(", ");
}

/** 主訴以外的已選症狀（含各自時間），依選取順序。 */
export function secondaryComplaints(
  problems: readonly EdProblem[],
  findings: EdFindings,
): { id: string; text: string }[] {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  return selectedComplaints(findings)
    .slice(1)
    .map((entry) => ({
      id: entry.id,
      text: complaintWithDuration(entry, byId, findings),
    }))
    .filter((entry) => entry.text !== "");
}

/** 只回傳分數；帶入 ERS 時由油猴腳本寫成「NRS:6」。 */
export function composeNRS(findings: EdFindings): string {
  return text(findings[edKey.ctx("nrs")]);
}

/** 目前勾選的特別情境（依目錄順序）。 */
function specialClauses(findings: EdFindings): Clause[] {
  // 舊版勾選式情境（已改為自由輸入）；舊資料仍照樣輸出。
  const legacy = SPECIAL_ITEMS.filter(
    (item) => findings[edKey.special(item.id)]?.on === true,
  ).map((item) => ({
    id: `sp.${item.id}`,
    text: specialPhrase(item, text(findings[edKey.special(item.id)])),
    score: 75,
  }));
  const typed = text(findings[edKey.ctx("situation")]);
  return typed ? [...legacy, { id: "sp.text", text: typed, score: 85 }] : legacy;
}

export function composePIDetail(
  problems: readonly EdProblem[],
  findings: EdFindings,
  patient: EdPatientContext,
): FieldDetail {
  const interview = buildInterview(problems, findings, patient);
  const mustIds = new Set<string>();
  for (const block of [
    ...interview.characterize,
    ...interview.core,
    ...(interview.conditional ? [interview.conditional] : []),
    ...interview.more,
  ]) {
    for (const item of block.items) if (item.must) mustIds.add(item.id);
  }
  const clauses: HistoryClause[] = [];
  const referral = text(findings[edKey.ctx("referral")]);
  if (referral) {
    clauses.push({
      id: "lead.referral",
      kind: "lead",
      text: `referred from ${referral}`,
      score: 95,
    });
  }
  // 其他已選症狀寫在 PI 開頭；同名的問診題（例如「發燒」）不再重複寫，細節併進來。
  const secondary = secondaryComplaints(problems, findings);
  const secondaryIds = new Set(secondary.map((entry) => entry.id));
  for (const entry of secondary) {
    const detail =
      historyItem(entry.id)?.type === "yn"
        ? text(findings[edKey.history(entry.id)])
        : "";
    clauses.push({
      id: `cc2.${entry.id}`,
      kind: "lead",
      text: detail ? `${entry.text} (${detail})` : entry.text,
      score: 90,
    });
  }
  for (const id of interviewItemIds(interview)) {
    if (secondaryIds.has(id)) continue;
    const clause = historyClause(id, findings, mustIds.has(id));
    if (clause) clauses.push(clause);
  }
  const extra = text(findings[edKey.ctx("piExtra")]);
  if (extra) {
    clauses.push({
      id: "pi.extra",
      kind: "extra",
      text: extra,
      score: 100,
      locked: true,
    });
  }

  const render = (kept: readonly HistoryClause[]) => {
    const positives = kept
      .filter((clause) => clause.kind === "lead" || clause.kind === "pos")
      .map((clause) => clause.text);
    const negatives = kept
      .filter((clause) => clause.kind === "neg")
      .map((clause) => clause.text);
    const extras = kept
      .filter((clause) => clause.kind === "extra")
      .map((clause) => clause.text);
    const positiveText = positives.join(", ");
    const negativeText = negatives.length > 0 ? `no ${negatives.join(", ")}` : "";
    return [positiveText, negativeText, ...extras].filter(Boolean).join(". ");
  };
  return fitClauses(
    clauses,
    render,
    FIELD_LIMITS.PI,
    (id) => clauseOverride(findings, id),
    autoFitEnabled(findings),
  );
}

export function composePI(
  problems: readonly EdProblem[],
  findings: EdFindings,
  patient: EdPatientContext,
): string {
  return composePIDetail(problems, findings, patient).text;
}

const TOCC_LETTERS: readonly ["t" | "o" | "c1" | "c2", string][] = [
  ["t", "T"],
  ["o", "O"],
  ["c1", "C"],
  ["c2", "C"],
];

/** TOCC 預設全部 (-)；只有標成 (+) 的才改寫。 */
export function composeTOCC(findings: EdFindings): string {
  return TOCC_LETTERS.map(([key, letter]) => {
    const finding = findings[edKey.tocc(key)];
    if (finding?.sel === "+") {
      const detail = text(finding);
      return detail ? `${letter}(+: ${detail})` : `${letter}(+)`;
    }
    return `${letter}(-)`;
  }).join(" ");
}

interface PhClause extends Clause {
  kind: "hx" | "med" | "situation" | "tocc" | "allergy";
}

export function composePHDetail(findings: EdFindings): FieldDetail {
  const clauses: PhClause[] = [];
  for (const item of PMH_ITEMS) {
    if (findings[edKey.pmh(item.id)]?.on !== true) continue;
    const detail = text(findings[edKey.pmh(item.id)]);
    const base = item.text ?? item.label;
    clauses.push({
      id: `pmh.${item.id}`,
      kind: "hx",
      text: detail ? `${base} (${detail})` : base,
      score: 70,
    });
  }
  const meds = text(findings[edKey.ctx("meds")]);
  if (meds) clauses.push({ id: "ph.meds", kind: "med", text: meds, score: 80 });
  for (const clause of specialClauses(findings)) {
    clauses.push({ ...clause, kind: "situation" });
  }
  const tocc = composeTOCC(findings);
  if (tocc) clauses.push({ id: "ph.tocc", kind: "tocc", text: tocc, score: 60 });
  const allergy = text(findings[edKey.ctx("allergy")]);
  if (allergy)
    clauses.push({ id: "ph.allergy", kind: "allergy", text: allergy, score: 90 });

  const render = (kept: readonly PhClause[]) => {
    const parts: string[] = [];
    const hx = kept
      .filter((clause) => clause.kind === "hx")
      .map((clause) => clause.text);
    if (hx.length > 0) parts.push(`HX: ${hx.join(", ")}`);
    const med = kept.find((clause) => clause.kind === "med");
    if (med) parts.push(`Med: ${med.text}`);
    const situation = kept
      .filter((clause) => clause.kind === "situation")
      .map((clause) => clause.text);
    if (situation.length > 0) parts.push(`Situation: ${situation.join(", ")}`);
    const toccClause = kept.find((clause) => clause.kind === "tocc");
    if (toccClause) parts.push(toccClause.text);
    const allergyClause = kept.find((clause) => clause.kind === "allergy");
    if (allergyClause) parts.push(`Drug allergy: ${allergyClause.text}`);
    return parts.join("; ");
  };
  return fitClauses(
    clauses,
    render,
    FIELD_LIMITS.PH,
    (id) => clauseOverride(findings, id),
    autoFitEnabled(findings),
  );
}

export function composePH(findings: EdFindings): string {
  return composePHDetail(findings).text;
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

export function composePeFieldDetail(
  field: EdPeField,
  itemIds: readonly string[],
  findings: EdFindings,
): FieldDetail {
  const all = itemIds
    .map((id) => peItem(id))
    .filter((item): item is PeItem => item !== undefined && item.field === field);
  const limit = FIELD_LIMITS[field];
  const omitted = new Set(
    all
      .filter((item) => clauseOverride(findings, `pe.${item.id}`) === "omit")
      .map((item) => item.id),
  );
  const items = all.filter((item) => !omitted.has(item.id));
  const extra = text(findings[edKey.peExtra(field)]);
  const render = (compact: boolean, list: readonly PeItem[]) =>
    [...list.map((item) => peClause(item, findings[edKey.pe(item.id)], compact)), extra]
      .filter(Boolean)
      .join(", ");
  const auto = autoFitEnabled(findings);

  let textOut = render(false, items);
  let collapsedNormals = new Set<string>();
  if (auto && textOut.length > limit) {
    textOut = render(true, items);
    if (textOut.length > limit) {
      // 最後手段：異常照寫，其餘正常項目合併成一句。
      const abnormal = items
        .filter((item) => findings[edKey.pe(item.id)]?.sel === "abn")
        .map((item) => peClause(item, findings[edKey.pe(item.id)], true))
        .filter(Boolean);
      const normals = items.filter(
        (item) => findings[edKey.pe(item.id)]?.sel === "normal",
      );
      collapsedNormals = new Set(normals.map((item) => item.id));
      if (normals.length > 0) {
        abnormal.push(
          abnormal.length > 0 ? "others normal" : PE_COLLAPSED_NORMAL[field],
        );
      }
      if (extra) abnormal.push(extra);
      textOut = abnormal.join(", ");
    }
  }

  const clauses = all
    .map((item) => {
      const clause = peClause(item, findings[edKey.pe(item.id)], false);
      if (!clause) return null;
      const state = omitted.has(item.id)
        ? ("user" as const)
        : collapsedNormals.has(item.id)
          ? ("auto" as const)
          : ("in" as const);
      return { id: `pe.${item.id}`, text: clause, state };
    })
    .filter((view): view is NonNullable<typeof view> => view !== null);
  return { text: textOut, clauses, limit, over: textOut.length > limit };
}

export function composePeField(
  field: EdPeField,
  itemIds: readonly string[],
  findings: EdFindings,
): string {
  return composePeFieldDetail(field, itemIds, findings).text;
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

function icdDefault(
  choice: IcdChoice,
  findings: EdFindings,
  problemId: string,
): boolean {
  const history = (id: string) => findings[edKey.history(id)];
  if (choice.duration) {
    const acute = isAcuteDuration(findings, problemId);
    if ((choice.duration === "acute") !== acute) return false;
  }
  const matched =
    (choice.whenPick !== undefined &&
      history(choice.whenPick.item)?.sel === choice.whenPick.option) ||
    (choice.whenNo !== undefined && history(choice.whenNo)?.on === false);
  if (matched) return true;
  if (!choice.defaultOn) return false;
  if (choice.offWhenPicked) {
    const picked = history(choice.offWhenPicked)?.sel;
    if (picked && (!choice.offWhenOptions || choice.offWhenOptions.includes(picked))) {
      return false;
    }
  }
  if (choice.offWhenNo && history(choice.offWhenNo)?.on === false) return false;
  return true;
}

export function icdCandidates(
  problems: readonly EdProblem[],
  findings: EdFindings,
): IcdCandidate[] {
  const overrides = findings[edKey.icd]?.fu ?? {};
  const byCode = new Map<string, IcdCandidate>();
  for (const problem of problems) {
    for (const choice of problem.icd) {
      // 同一代碼可由多條規則觸發（例如「壓迫」「悶」都對應 R07.89）：任一條成立就勾。
      const suggested = icdDefault(choice, findings, problem.id);
      const existing = byCode.get(choice.code);
      if (existing) {
        if (overrides[choice.code] === undefined) existing.on ||= suggested;
        continue;
      }
      const override = overrides[choice.code];
      const on = override === undefined ? suggested : override === "1";
      byCode.set(choice.code, { ...choice, problemId: problem.id, on });
    }
  }
  return [...byCode.values()];
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
  /** 各欄位的逐句明細（哪些寫入、哪些因字數被略過／被你指定不寫入）。 */
  detail: Partial<Record<EdFieldKey, FieldDetail>>;
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
  const detail: Partial<Record<EdFieldKey, FieldDetail>> = {};
  fields.CC = composeCC(problems, findings);
  fields.NRS = composeNRS(findings);
  detail.PI = composePIDetail(problems, findings, patient);
  fields.PI = detail.PI.text;
  detail.PH = composePHDetail(findings);
  fields.PH = detail.PH.text;
  const peFields = new Set<EdPeField>(physical.map((section) => section.field));
  for (const section of physical) {
    const ids = [...section.core, ...section.more].map((item) => item.id);
    detail[section.field] = composePeFieldDetail(section.field, ids, findings);
    fields[section.field] = detail[section.field]?.text ?? "";
  }
  // 沒有勾任何 PE 題、但使用者在該欄位打了補充：直接輸出補充文字。
  for (const field of PE_FIELD_ORDER) {
    if (peFields.has(field)) continue;
    const extra = text(findings[edKey.peExtra(field)]);
    if (extra) fields[field] = extra;
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
    detail,
  };
}

export function edContextValue(findings: EdFindings, key: EdContextKey): string {
  return text(findings[edKey.ctx(key)]);
}
