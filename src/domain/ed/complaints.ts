import type { FindingValue } from "../clinical/finding";
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

/** 搜尋用的關鍵字（中英文、口語、部位）；標籤與 cc 本身也會比對。 */
const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  fever: ["發燒", "燒", "發熱", "畏寒", "寒顫", "fever", "chills", "temp"],
  weakness: [
    "無力",
    "倦怠",
    "虛弱",
    "沒力",
    "疲倦",
    "累",
    "weak",
    "fatigue",
    "malaise",
  ],
  bp_abnormal: ["血壓", "高血壓", "低血壓", "BP", "hypertension", "hypotension"],
  glucose: ["血糖", "糖尿病", "低血糖", "高血糖", "glucose", "DM", "sugar"],
  lab_referral: [
    "檢驗異常",
    "報告異常",
    "門診轉入",
    "回診",
    "lab",
    "referral",
    "abnormal lab",
  ],
  chest_pain: ["胸痛", "胸悶", "胸口", "心絞痛", "chest", "angina", "ACS"],
  dyspnea: ["喘", "呼吸困難", "呼吸喘", "氣喘", "上不來", "dyspnea", "SOB", "breath"],
  palpitation: [
    "心悸",
    "心跳快",
    "心跳",
    "心律",
    "palpitation",
    "tachycardia",
    "arrhythmia",
  ],
  syncope: ["暈厥", "昏倒", "暈倒", "昏厥", "眼前發黑", "syncope", "faint", "LOC"],
  cough_uri: [
    "咳嗽",
    "咳",
    "感冒",
    "上呼吸道",
    "流鼻水",
    "喉嚨",
    "cough",
    "URI",
    "cold",
  ],
  ent: [
    "耳",
    "鼻",
    "喉",
    "耳鳴",
    "鼻血",
    "吞嚥",
    "聽力",
    "喉嚨痛",
    "ENT",
    "ear",
    "nose",
    "throat",
  ],
  eye: ["眼", "視力", "紅眼", "眼痛", "複視", "eye", "vision"],
  abd_pain: [
    "肚子痛",
    "腹痛",
    "胃痛",
    "上腹",
    "下腹",
    "右下腹",
    "絞痛",
    "abd",
    "abdominal",
    "belly",
    "stomach",
  ],
  nausea_vomiting: ["噁心", "嘔吐", "吐", "想吐", "nausea", "vomit", "N/V"],
  diarrhea: ["腹瀉", "拉肚子", "水瀉", "diarrhea", "loose stool"],
  constipation_bloating: [
    "便秘",
    "腹脹",
    "脹氣",
    "排便困難",
    "constipation",
    "bloating",
    "distension",
  ],
  gi_bleed: [
    "吐血",
    "黑便",
    "血便",
    "解血便",
    "出血",
    "GI bleed",
    "melena",
    "hematemesis",
    "hematochezia",
  ],
  jaundice: ["黃疸", "皮膚黃", "眼睛黃", "茶色尿", "jaundice", "icteric"],
  urinary: [
    "解尿",
    "尿",
    "血尿",
    "頻尿",
    "尿痛",
    "解不出",
    "尿滯留",
    "UTI",
    "dysuria",
    "hematuria",
    "retention",
  ],
  gyn: [
    "陰道",
    "月經",
    "婦科",
    "下腹痛",
    "出血",
    "懷孕",
    "vaginal",
    "gyn",
    "menses",
    "pregnan",
  ],
  dizziness: [
    "頭暈",
    "暈",
    "眩暈",
    "天旋地轉",
    "站不穩",
    "dizzy",
    "vertigo",
    "giddiness",
  ],
  headache: ["頭痛", "偏頭痛", "頭很痛", "headache", "migraine"],
  focal_neuro: [
    "中風",
    "單側無力",
    "麻",
    "言語",
    "口齒不清",
    "臉歪",
    "偏癱",
    "stroke",
    "weakness",
    "numb",
    "aphasia",
    "facial droop",
  ],
  ams: [
    "意識",
    "意識不清",
    "嗜睡",
    "昏迷",
    "混亂",
    "譫妄",
    "AMS",
    "confusion",
    "drowsy",
    "conscious",
  ],
  seizure: ["抽搐", "癲癇", "痙攣", "抽筋", "seizure", "convulsion", "epilepsy"],
  trauma: [
    "外傷",
    "跌倒",
    "車禍",
    "撞",
    "摔",
    "受傷",
    "傷口",
    "割傷",
    "trauma",
    "fall",
    "MVA",
    "injury",
    "laceration",
  ],
  back_pain: ["背痛", "腰痛", "頸痛", "脖子", "下背", "back", "lumbar", "neck pain"],
  limb: [
    "腳痛",
    "手痛",
    "腫",
    "關節",
    "四肢",
    "紅熱",
    "腿",
    "limb",
    "swelling",
    "joint",
    "edema",
  ],
  skin_allergy: [
    "皮疹",
    "癢",
    "過敏",
    "蕁麻疹",
    "紅疹",
    "蟲咬",
    "rash",
    "itch",
    "allergy",
    "urticaria",
  ],
  bleeding: ["流血", "出血", "瘀青", "牙齦", "止不住", "鼻血", "bleeding", "bruise"],
  psych: [
    "焦慮",
    "自殺",
    "自傷",
    "失眠",
    "躁動",
    "憂鬱",
    "恐慌",
    "psych",
    "anxiety",
    "suicide",
    "insomnia",
  ],
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/** 依輸入搜尋標準問題；空白回傳空陣列。比對標籤、英文主訴與關鍵字。 */
export function searchProblems(query: string): EdProblem[] {
  const needle = normalize(query);
  if (!needle) return [];
  const scored: { problem: EdProblem; score: number }[] = [];
  for (const problem of ED_PROBLEMS) {
    const label = normalize(problem.label);
    const cc = normalize(problem.cc);
    const words = (KEYWORDS[problem.id] ?? []).map(normalize);
    let score = 0;
    if (label === needle || words.includes(needle)) score = 100;
    else if (label.includes(needle) || cc.includes(needle)) score = 60;
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
