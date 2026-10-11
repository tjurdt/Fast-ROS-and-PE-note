import type { FindingValue } from "../clinical/finding";
import { pickedOptions } from "./picks";
import { edKey, type EdProblem, type HistoryItem } from "./types";

/**
 * 「同一個症狀」的對照表，讓 PI 不會把同一件事寫兩次。
 *
 * 題庫裡同一個症狀常常有好幾個入口：主訴（腹痛）、有／無題（腹痛）、分型題的選項（右上腹）。
 * 每個入口都對應到一組「概念」（concept）；PI 組句時，後面出現的句子如果它的概念
 * 已經被前面的句子講過，就不再重複寫（有細節時改成附加在前一句），
 * 陰性句如果它的概念在別處已經是陽性，也不寫（避免 "abd pain ... no abd pain"）。
 *
 * 沒有列在這裡的題目，概念就是它自己的 id，只會跟自己重複（一題只有一句，不會重複）。
 */

/** 有／無題或單／複選題 → 概念；沒列 = [id]。 */
export const ITEM_COVERS: Readonly<Record<string, readonly string[]>> = {
  abd_site: ["abd_pain"],
  abd_quality: ["abd_pain"],
  chest_quality: ["chest_pain"],
  palp_pattern: ["palpitation"],
  syncope_trigger: ["syncope"],
  abd_pain: ["abd_pain"],
  dysp_trigger: ["dyspnea"],
  dizzy_kind: ["dizzy"],
  gib_type: ["melena", "hematochezia", "hematemesis"],
  uri_type: [
    "dysuria",
    "frequency",
    "hematuria",
    "retention",
    "flank_pain",
    "low_urine",
  ],
  ent_type: [
    "sore_throat",
    "ear_pain",
    "epistaxis",
    "dysphagia",
    "hoarseness",
    "neck_mass",
    "toothache",
  ],
  eye_type: ["eye_symptom"],
  limb_site: ["limb_pain", "swelling"],
  back_site: ["back_pain"],
  psych_type: ["anxiety", "si", "self_harm", "agitation", "insomnia", "hallucination"],
  chest_tight: ["chest_tight"],
  flank_pain: ["flank_pain"],
};

/** 單／複選題的某個選項 → 概念；沒列 = 該題的 ITEM_COVERS。 */
export const OPTION_COVERS: Readonly<Record<string, readonly string[]>> = {
  "gib_type:黑便": ["melena"],
  "gib_type:血便": ["hematochezia"],
  "gib_type:吐血": ["hematemesis"],
  "gib_type:咖啡渣": ["hematemesis"],
  "uri_type:解尿疼痛": ["dysuria"],
  "uri_type:頻尿": ["frequency"],
  "uri_type:血尿": ["hematuria"],
  "uri_type:解不出來": ["retention"],
  "uri_type:腰／側腹痛": ["flank_pain"],
  "uri_type:尿量減少": ["low_urine"],
  "ent_type:喉嚨痛": ["sore_throat"],
  "ent_type:耳痛": ["ear_pain"],
  "ent_type:流鼻血": ["epistaxis"],
  "ent_type:吞嚥困難／梗到": ["dysphagia"],
  "ent_type:聲音沙啞": ["hoarseness"],
  "ent_type:頸部腫塊": ["neck_mass"],
  "ent_type:牙痛": ["toothache"],
  "psych_type:焦慮／恐慌": ["anxiety"],
  "psych_type:自殺意念": ["si"],
  "psych_type:自傷／服藥過量": ["self_harm"],
  "psych_type:躁動": ["agitation"],
  "psych_type:失眠": ["insomnia"],
  "psych_type:幻覺": ["hallucination"],
};

/** 主訴（問題）本身代表哪些症狀；沒列 = [問題 id]。 */
export const PROBLEM_COVERS: Readonly<Record<string, readonly string[]>> = {
  abd_pain: ["abd_pain"],
  nausea_vomiting: ["nausea", "vomiting"],
  chest_pain: ["chest_pain", "chest_tight"],
  cough_uri: ["cough"],
  dizziness: ["dizzy"],
  constipation_bloating: ["constipation", "bloating"],
  gi_bleed: ["melena", "hematochezia", "hematemesis"],
  urinary: [
    "dysuria",
    "frequency",
    "hematuria",
    "retention",
    "flank_pain",
    "low_urine",
  ],
  ent: [
    "sore_throat",
    "ear_pain",
    "epistaxis",
    "dysphagia",
    "hoarseness",
    "neck_mass",
    "toothache",
  ],
  eye: ["eye_symptom", "vision"],
  limb: ["limb_pain", "swelling", "redness"],
  back_pain: ["back_pain"],
  weakness: ["malaise"],
  gyn: ["vag_bleed"],
  skin_allergy: ["rash", "itch"],
  ams: ["confusion"],
  focal_neuro: ["weak_focal", "numb", "slurred", "facial_droop", "vision"],
  psych: ["anxiety", "si", "self_harm", "agitation", "insomnia", "hallucination"],
};

type Findings = Readonly<Record<string, FindingValue | undefined>>;

/** 一題問診目前代表的概念（單／複選題依已選的選項）。 */
export function coversOfHistory(item: HistoryItem, findings: Findings): string[] {
  if (item.type !== "pick") return [...(ITEM_COVERS[item.id] ?? [item.id])];
  const chosen = pickedOptions(findings, item.id);
  const covers = new Set<string>();
  for (const label of chosen) {
    for (const concept of OPTION_COVERS[`${item.id}:${label}`] ??
      ITEM_COVERS[item.id] ?? [item.id])
      covers.add(concept);
  }
  return [...covers];
}

/** 一個主訴寫進 PI 的那句話代表哪些症狀。 */
export function coversOfProblem(problem: EdProblem, findings: Findings): string[] {
  if (problem.ccFromYes) {
    const yes = problem.ccFromYes
      .filter((entry) => findings[edKey.history(entry.item)]?.on === true)
      .map((entry) => entry.item);
    if (yes.length > 0) return yes;
  }
  if (problem.ccFrom) {
    const item = problem.ccFrom;
    const fromPick = pickedOptions(findings, item).flatMap(
      (label) => OPTION_COVERS[`${item}:${label}`] ?? [],
    );
    if (fromPick.length > 0) return fromPick;
  }
  return [...(PROBLEM_COVERS[problem.id] ?? [problem.id])];
}
