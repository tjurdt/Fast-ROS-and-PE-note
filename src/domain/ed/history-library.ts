import type {
  EdSystemKey,
  HistoryItem,
  HistoryPick,
  HistoryText,
  HistoryYesNo,
  PmhItem,
} from "./types";

function yn(
  id: string,
  system: EdSystemKey,
  label: string,
  pos: string,
  extra: Partial<Omit<HistoryYesNo, "id" | "system" | "label" | "pos" | "type">> = {},
): HistoryYesNo {
  return { type: "yn", id, system, label, pos, ...extra };
}

function pick(
  id: string,
  system: EdSystemKey,
  label: string,
  options: HistoryPick["options"],
): HistoryPick {
  return { type: "pick", id, system, label, options };
}

function text(
  id: string,
  system: EdSystemKey,
  label: string,
  template: string,
  extra: Partial<Pick<HistoryText, "placeholder" | "gate">> = {},
): HistoryText {
  return { type: "text", id, system, label, template, ...extra };
}

/** 單一選項：中文按鈕與英文片語相同時的簡寫。 */
const opt = (label: string, textValue: string, cc?: string) =>
  cc === undefined ? { label, text: textValue } : { label, text: textValue, cc };

/**
 * 急診問診題庫。順序即畫面順序（同系統內）。
 * 資料依據：臺北榮總急診歷史病歷的 CC/PI 實際會被問到與記錄的項目。
 */
export const HISTORY_ITEMS: readonly HistoryItem[] = [
  // ── 起病與病程（通用特徵題）─────────────────────────────
  pick("onset", "const", "起病方式", [
    opt("突然", "sudden onset"),
    opt("漸進", "gradual onset"),
    opt("陣發", "intermittent"),
    opt("持續加重", "progressively worsening"),
  ]),
  yn("similar_episode", "const", "以前發作過", "similar episode before", {
    neg: "similar episode before",
  }),

  // ── 全身／感染 ───────────────────────────────────────────
  yn("fever", "const", "發燒", "fever", {
    detail: { placeholder: "Tmax，例 38.5" },
  }),
  yn("chills", "const", "畏寒／寒顫", "chills"),
  yn("night_sweat", "const", "夜間盜汗", "night sweats"),
  yn("wt_loss", "const", "體重減輕", "body weight loss"),
  yn("anorexia", "const", "食慾差", "poor appetite"),
  yn("malaise", "const", "全身倦怠", "general malaise", { neg: "malaise" }),
  yn("cold_sweat", "const", "冷汗", "cold sweating"),
  yn("sick_contact", "const", "接觸感染者", "sick contact", {
    detail: { placeholder: "誰／何時" },
  }),

  // ── 呼吸 ────────────────────────────────────────────────
  yn("cough", "resp", "咳嗽", "cough"),
  yn("sputum", "resp", "痰", "sputum", {
    detail: { chips: ["白", "黃", "綠", "血絲", "泡沫"] },
  }),
  yn("dyspnea", "resp", "喘／呼吸困難", "dyspnea", { neg: "dyspnea" }),
  yn("orthopnea", "resp", "端坐呼吸／夜間喘醒", "orthopnea/PND", {
    neg: "orthopnea",
  }),
  yn("wheeze", "resp", "喘鳴", "wheezing"),
  yn("hemoptysis", "resp", "咳血", "hemoptysis"),
  yn("sore_throat", "resp", "喉嚨痛", "sore throat"),
  yn("rhinorrhea", "resp", "流鼻水／鼻塞", "rhinorrhea"),
  yn("pleuritic", "resp", "深呼吸或咳嗽時加劇", "pleuritic pain", {
    neg: "pleuritic pain",
  }),

  // ── 心血管 ──────────────────────────────────────────────
  yn("chest_pain", "cv", "胸痛", "chest pain"),
  yn("chest_tight", "cv", "胸悶", "chest tightness"),
  yn("palpitation", "cv", "心悸", "palpitation"),
  yn("syncope", "cv", "暈厥／昏倒", "syncope"),
  yn("presyncope", "cv", "快暈倒／眼前發黑", "presyncope"),
  yn("leg_edema", "cv", "下肢水腫", "leg edema", { neg: "leg edema" }),
  pick("chest_quality", "cv", "胸痛性質", [
    opt("壓迫／緊縮", "pressure-like"),
    opt("刺痛", "stabbing"),
    opt("撕裂", "tearing"),
    opt("灼熱", "burning"),
    opt("悶", "tightness", "chest tightness"),
  ]),
  yn("chest_radiate", "cv", "放射（手臂／下巴／背）", "radiating", {
    neg: "radiation",
    detail: { chips: ["L arm", "R arm", "jaw", "back", "neck"] },
  }),
  yn("chest_exert", "cv", "活動誘發、休息緩解", "exertional", {
    neg: "exertional",
  }),
  yn(
    "chest_position",
    "cv",
    "姿勢改變或按壓會痛",
    "positional/reproducible by palpation",
    {
      neg: "positional pain",
    },
  ),

  // ── 消化 ────────────────────────────────────────────────
  pick("abd_site", "gi", "腹痛部位", [
    opt("上腹／心窩", "epigastric pain", "epigastric"),
    opt("右上腹", "RUQ pain", "RUQ"),
    opt("左上腹", "LUQ pain", "LUQ"),
    opt("臍周", "periumbilical pain", "periumbilical"),
    opt("右下腹", "RLQ pain", "RLQ"),
    opt("左下腹", "LLQ pain", "LLQ"),
    opt("下腹／恥骨上", "lower abdominal pain", "lower"),
    opt("全腹", "diffuse abdominal pain", "diffuse"),
  ]),
  pick("abd_quality", "gi", "腹痛性質", [
    opt("絞痛", "colicky"),
    opt("悶痛", "dull"),
    opt("刺痛", "sharp"),
    opt("灼熱", "burning"),
    opt("持續性", "constant"),
  ]),
  yn("abd_migrate", "gi", "疼痛由臍周移到右下腹", "pain migration to RLQ", {
    neg: "pain migration",
  }),
  yn("abd_pain", "gi", "腹痛", "abd pain", { neg: "abd pain" }),
  yn("nausea", "gi", "噁心", "nausea"),
  yn("vomiting", "gi", "嘔吐", "vomiting", {
    neg: "vomiting",
    detail: { placeholder: "次數／內容物" },
  }),
  yn("diarrhea", "gi", "腹瀉", "diarrhea", {
    detail: { placeholder: "次數／水樣／黏液" },
  }),
  yn("constipation", "gi", "便秘", "constipation"),
  yn("no_flatus", "gi", "無排氣排便", "no flatus/stool passage", {
    neg: "obstipation",
  }),
  yn("melena", "gi", "黑便", "melena"),
  yn("hematochezia", "gi", "血便／解鮮血", "hematochezia"),
  yn("hematemesis", "gi", "吐血／咖啡渣", "hematemesis"),
  yn("bloating", "gi", "腹脹", "abdominal distension"),
  yn("dysphagia", "gi", "吞嚥困難／梗到", "dysphagia"),
  yn("heartburn", "gi", "火燒心／逆流", "heartburn/reflux", { neg: "heartburn" }),
  yn("food_trigger", "gi", "飲食誘發（不潔／油膩／辛辣）", "related to food intake", {
    neg: "food relation",
    detail: { placeholder: "吃了什麼" },
  }),
  yn("alcohol", "gi", "飲酒", "alcohol use", {
    detail: { placeholder: "量／最近一次" },
  }),
  yn("nsaid_steroid", "gi", "NSAID／類固醇", "NSAID/steroid use", {
    detail: { placeholder: "藥名" },
  }),
  yn("jaundice", "gi", "黃疸／茶色尿", "jaundice/dark urine"),
  yn("abd_surgery", "gi", "腹部手術史", "prior abdominal surgery", {
    neg: "prior abdominal surgery",
    detail: { placeholder: "什麼手術" },
  }),

  // ── 泌尿生殖 ────────────────────────────────────────────
  yn("dysuria", "gu", "解尿疼痛", "dysuria"),
  yn("frequency", "gu", "頻尿／急尿", "frequency/urgency"),
  yn("hematuria", "gu", "血尿", "hematuria"),
  yn("flank_pain", "gu", "腰／側腹痛", "flank pain"),
  yn("low_urine", "gu", "尿量減少", "decreased urine output", { neg: "oliguria" }),
  yn("retention", "gu", "解不出尿", "urinary retention"),
  yn("foley", "gu", "留置尿管", "indwelling Foley"),
  yn("genital_discharge", "gu", "陰道／尿道分泌物", "genital discharge"),
  yn("vag_bleed", "gu", "陰道出血", "vaginal bleeding", { gate: "fertile" }),
  text("lmp", "gu", "最後一次月經 LMP", "LMP {v}", {
    placeholder: "例 10/2",
    gate: "fertile",
  }),
  yn("pregnancy_possible", "gu", "可能懷孕", "possible pregnancy", {
    gate: "fertile",
    neg: "pregnancy",
  }),

  // ── 神經 ────────────────────────────────────────────────
  yn("headache", "neuro", "頭痛", "headache"),
  yn("headache_worst", "neuro", "雷擊樣／生平最痛", "thunderclap headache", {
    neg: "thunderclap onset",
  }),
  pick("dizzy_kind", "neuro", "頭暈性質", [
    opt("天旋地轉", "vertigo (spinning)", "vertigo"),
    opt("頭重腳輕", "lightheadedness", "lightheadedness"),
    opt("走路不穩", "disequilibrium", "unsteadiness"),
    opt("說不清", "non-specific dizziness"),
  ]),
  yn("dizzy_position", "neuro", "姿勢改變／轉頭誘發", "positional trigger", {
    neg: "positional trigger",
  }),
  yn("dizzy", "neuro", "頭暈", "dizziness"),
  yn("weak_focal", "neuro", "單側／局部無力", "focal weakness", {
    detail: {
      chips: ["L arm", "R arm", "L leg", "R leg", "L side", "R side", "bil legs"],
    },
  }),
  yn("numb", "neuro", "麻木", "numbness", {
    detail: { placeholder: "部位" },
  }),
  yn("slurred", "neuro", "言語不清／說不出話", "slurred speech"),
  yn("facial_droop", "neuro", "臉歪", "facial droop"),
  yn("vision", "neuro", "複視／視力模糊", "diplopia/blurred vision"),
  yn("gait", "neuro", "走路不穩", "gait unsteadiness"),
  yn("loc", "neuro", "意識喪失", "LOC", { neg: "LOC" }),
  yn("confusion", "neuro", "意識混亂／嗜睡", "confusion/drowsiness"),
  yn("seizure", "neuro", "抽搐", "seizure", {
    detail: { placeholder: "時間／型態／有無咬舌失禁" },
  }),
  yn("neck_stiff_h", "neuro", "頸部僵硬", "neck stiffness"),
  yn("photophobia", "neuro", "畏光", "photophobia"),
  yn("hearing", "neuro", "聽力下降／耳鳴", "hearing loss/tinnitus"),
  text("lkw", "neuro", "最後正常時間 LKW", "LKW {v}", { placeholder: "例 今天 08:00" }),

  // ── 外傷 ────────────────────────────────────────────────
  pick("mechanism", "trauma", "受傷機轉", [
    opt("平地跌倒", "fall from standing"),
    opt("高處墜落", "fall from height"),
    opt("機車／車禍", "MVA"),
    opt("被打／攻擊", "assault"),
    opt("運動傷害", "sports injury"),
    opt("其他", "injury"),
  ]),
  text("injury_site", "trauma", "受傷部位", "injury at {v}", {
    placeholder: "例 R knee",
  }),
  text("injury_time", "trauma", "受傷時間", "injured {v}", {
    placeholder: "例 今天 14:00",
  }),
  yn("head_strike", "trauma", "撞到頭", "head strike"),
  yn("amnesia", "trauma", "失憶", "amnesia"),
  yn("neck_back_pain", "trauma", "頸／背痛", "neck/back pain"),
  yn("walk_after", "trauma", "受傷後能自己走", "ambulatory after injury", {
    negPhrase: "unable to walk after injury",
  }),
  yn("wound_bleed", "trauma", "傷口出血", "wound bleeding"),
  text("tetanus", "trauma", "破傷風免疫", "last tetanus {v}", {
    placeholder: "年份／不確定",
  }),

  // ── 皮膚／肌肉骨骼 ──────────────────────────────────────
  yn("limb_pain", "msk", "肢體／關節痛", "limb/joint pain", {
    detail: { placeholder: "部位" },
  }),
  yn("swelling", "msk", "腫脹", "swelling"),
  yn("redness", "msk", "紅熱", "redness/warmth"),
  yn("wound", "msk", "傷口／破皮／蟲咬", "skin break/wound"),
  yn("rash", "msk", "皮疹", "rash"),
  yn("itch", "msk", "癢", "itching"),
  yn("allergen", "msk", "新藥物／食物／蟲咬暴露", "new exposure", {
    detail: { placeholder: "什麼" },
  }),
  yn(
    "lip_swell",
    "msk",
    "嘴唇舌頭腫／喉嚨緊",
    "lip/tongue swelling or throat tightness",
    {
      neg: "lip/tongue swelling",
    },
  ),
  yn("calf_pain", "msk", "小腿痛／單側腫", "calf pain/unilateral swelling", {
    neg: "calf pain",
  }),
  yn(
    "immobil",
    "msk",
    "近期久臥／手術／長途旅行",
    "recent immobilization/surgery/travel",
    {
      neg: "recent immobilization",
    },
  ),

  // ── 出血／抗凝 ──────────────────────────────────────────
  yn("epistaxis", "bleed", "流鼻血", "epistaxis"),
  yn("gum_bleed", "bleed", "牙齦出血", "gum bleeding"),
  yn("bruise", "bleed", "容易瘀青", "easy bruising"),
  yn("anticoag", "bleed", "抗凝血／抗血小板藥", "on anticoagulant/antiplatelet", {
    neg: "anticoagulant use",
    detail: { placeholder: "藥名／最後一次" },
  }),

  // ── 精神 ────────────────────────────────────────────────
  yn("si", "psych", "自殺意念", "suicidal ideation", { neg: "suicidal ideation" }),
  yn("self_harm", "psych", "自傷／服藥過量", "self-harm/overdose", {
    neg: "self-harm",
    detail: { placeholder: "藥名／劑量／時間" },
  }),
  yn("anxiety", "psych", "焦慮／恐慌", "anxiety/panic"),
  yn("insomnia", "psych", "失眠", "insomnia"),
  yn("substance", "psych", "酒精／藥物濫用", "substance use"),
  yn("hallucination", "psych", "幻聽／幻覺", "hallucination"),

  // ── 代謝／血壓 ──────────────────────────────────────────
  yn("polyuria", "meta", "多尿／多渴", "polyuria/polydipsia"),
  text("glucose_home", "meta", "自測血糖", "home glucose {v}", { placeholder: "數值" }),
  yn("dm_meds_issue", "meta", "降血糖藥漏吃／多吃", "missed or extra DM medication", {
    neg: "DM medication change",
  }),
  text("bp_home", "meta", "家中血壓", "home BP {v}", { placeholder: "例 180/100" }),
  yn("bp_meds_issue", "meta", "降血壓藥漏吃／新增", "missed or new BP medication", {
    neg: "BP medication change",
  }),

  // ── 問題專屬特徵（主訴修飾／分型）──────────────────────
  pick("dysp_trigger", "resp", "喘的情境", [
    opt("休息時也喘", "dyspnea at rest"),
    opt("活動時喘", "exertional dyspnea"),
    opt("平躺加重", "worse when lying flat"),
  ]),
  pick("palp_pattern", "cv", "心悸型態", [
    opt("規則快速", "regular rapid"),
    opt("不規則", "irregular"),
    opt("突然開始突然停", "paroxysmal, abrupt onset/offset"),
  ]),
  pick("syncope_trigger", "cv", "暈厥情境", [
    opt("站起時", "orthostatic"),
    opt("運動時", "during exertion"),
    opt("排尿／排便／咳嗽時", "situational"),
    opt("休息或平躺", "at rest/supine"),
    opt("無明顯誘因", "no trigger"),
  ]),
  pick("gib_type", "gi", "出血型態", [
    opt("黑便", "melena", "melena"),
    opt("血便", "hematochezia", "hematochezia"),
    opt("吐血", "hematemesis", "hematemesis"),
    opt("咖啡渣", "coffee-ground vomitus", "coffee-ground vomitus"),
  ]),
  yn("abx_recent", "gi", "近期使用抗生素", "recent antibiotic use", {
    neg: "recent antibiotic use",
  }),
  pick("ent_type", "resp", "耳鼻喉症狀", [
    opt("喉嚨痛", "sore throat", "sore throat"),
    opt("耳痛", "ear pain", "ear pain"),
    opt("流鼻血", "epistaxis", "epistaxis"),
    opt("吞嚥困難／梗到", "dysphagia/foreign body sensation", "dysphagia"),
    opt("聲音沙啞", "hoarseness", "hoarseness"),
    opt("頸部腫塊", "neck mass", "neck mass"),
    opt("牙痛", "toothache", "toothache"),
  ]),
  pick("eye_type", "neuro", "眼睛症狀", [
    opt("視力模糊", "blurred vision", "blurred vision"),
    opt("眼痛", "eye pain", "eye pain"),
    opt("紅眼", "red eye", "red eye"),
    opt("複視", "diplopia", "diplopia"),
    opt("視野缺損／閃光", "visual field loss/flashes", "visual field loss"),
    opt("異物感", "foreign body sensation", "eye foreign body sensation"),
  ]),
  pick("uri_type", "gu", "泌尿症狀", [
    opt("解尿疼痛", "dysuria", "dysuria"),
    opt("頻尿", "frequency", "frequency"),
    opt("血尿", "hematuria", "hematuria"),
    opt("解不出來", "urinary retention", "urinary retention"),
    opt("腰／側腹痛", "flank pain", "flank pain"),
    opt("尿量減少", "oliguria", "oliguria"),
  ]),
  pick("limb_site", "msk", "哪一肢", [
    opt("右上肢", "involving R upper limb", "R arm pain/swelling"),
    opt("左上肢", "involving L upper limb", "L arm pain/swelling"),
    opt("右下肢", "involving R lower limb", "R leg pain/swelling"),
    opt("左下肢", "involving L lower limb", "L leg pain/swelling"),
  ]),
  pick("back_site", "msk", "疼痛部位", [
    opt("頸", "neck pain", "neck pain"),
    opt("上背／胸背", "upper back pain", "upper back pain"),
    opt("下背／腰", "low back pain", "low back pain"),
  ]),
  yn("back_radiate", "msk", "往下肢放射", "radiating to leg", {
    neg: "leg radiation",
    detail: { chips: ["R", "L", "bil"] },
  }),
  pick("bp_type", "meta", "血壓異常方向", [
    opt("偏高", "elevated BP", "elevated BP"),
    opt("偏低", "hypotension", "hypotension"),
  ]),
  pick("glu_type", "meta", "血糖異常方向", [
    opt("偏高", "hyperglycemia", "hyperglycemia"),
    opt("偏低", "hypoglycemia", "hypoglycemia"),
  ]),
  pick("psych_type", "psych", "精神症狀", [
    opt("焦慮／恐慌", "anxiety/panic", "anxiety"),
    opt("自殺意念", "suicidal ideation", "suicidal ideation"),
    opt("自傷／服藥過量", "self-harm/overdose", "self-harm"),
    opt("躁動", "agitation", "agitation"),
    opt("失眠", "insomnia", "insomnia"),
    opt("幻覺", "hallucination", "hallucination"),
  ]),

  // ── 背景條件追加題 ──────────────────────────────────────
  text("last_hd", "meta", "最後一次洗腎", "last HD {v}", {
    placeholder: "例 昨天／週一",
  }),
  yn("hd_missed", "meta", "漏洗或少洗", "missed HD session", { neg: "missed HD" }),
  yn("access_problem", "meta", "廔管／導管問題", "access site problem", {
    neg: "access problem",
  }),
  text("last_chemo", "meta", "最後一次化療／標靶", "last chemo {v}", {
    placeholder: "日期",
  }),
  yn("device", "meta", "體內管路（Port-A／CVC／引流）", "indwelling device", {
    neg: "device-related problem",
    detail: { placeholder: "哪一種" },
  }),
  yn("steroid_use", "meta", "長期類固醇／免疫抑制", "on steroid/immunosuppressant", {
    detail: { placeholder: "藥名" },
  }),
];

/** 病史快選（寫進 PH 的 HX:）。asks = 勾選後額外要問的題。 */
export const PMH_ITEMS: readonly PmhItem[] = [
  { id: "none", label: "無特殊病史", text: "nil" },
  { id: "htn", label: "高血壓", text: "HTN", asks: ["bp_home", "bp_meds_issue"] },
  { id: "dm", label: "糖尿病", text: "DM", asks: ["glucose_home", "dm_meds_issue"] },
  { id: "hld", label: "高血脂", text: "hyperlipidemia" },
  { id: "cad", label: "冠心症", text: "CAD", detail: true },
  { id: "chf", label: "心衰竭", text: "HF", asks: ["orthopnea", "leg_edema"] },
  { id: "af", label: "心房顫動", text: "AF", asks: ["anticoag"] },
  { id: "stroke", label: "中風／TIA", text: "stroke/TIA", detail: true },
  { id: "copd", label: "COPD", text: "COPD", asks: ["wheeze"] },
  { id: "asthma", label: "氣喘", text: "asthma", asks: ["wheeze"] },
  { id: "ckd", label: "慢性腎病", text: "CKD", asks: ["low_urine"] },
  {
    id: "esrd",
    label: "洗腎 ESRD",
    text: "ESRD on HD",
    detail: true,
    asks: ["last_hd", "hd_missed", "access_problem", "low_urine"],
  },
  {
    id: "cirrhosis",
    label: "肝硬化",
    text: "liver cirrhosis",
    asks: ["melena", "hematemesis"],
  },
  { id: "hbv", label: "B/C 肝帶原", text: "HBV/HCV carrier" },
  {
    id: "cancer",
    label: "癌症",
    text: "cancer",
    detail: true,
    asks: ["last_chemo", "device", "fever"],
  },
  {
    id: "immuno",
    label: "免疫低下／移植",
    text: "immunocompromised",
    detail: true,
    asks: ["steroid_use"],
  },
  { id: "epilepsy", label: "癲癇", text: "epilepsy", asks: ["seizure"] },
  { id: "dementia", label: "失智", text: "dementia" },
  { id: "psych", label: "精神疾病", text: "psychiatric disease", detail: true },
  { id: "gout", label: "痛風", text: "gout" },
  { id: "smoking", label: "抽菸", text: "smoker" },
  { id: "surgery", label: "手術史", text: "s/p surgery", detail: true },
];

const itemById = new Map<string, HistoryItem>(
  HISTORY_ITEMS.map((item) => [item.id, item]),
);

export function historyItem(id: string): HistoryItem | undefined {
  return itemById.get(id);
}

export const SYSTEM_LABELS: Record<EdSystemKey, string> = {
  const: "全身／感染",
  resp: "呼吸",
  cv: "心血管",
  gi: "消化",
  gu: "泌尿生殖",
  neuro: "神經",
  trauma: "外傷",
  msk: "皮膚・肌肉骨骼",
  bleed: "出血／抗凝",
  psych: "精神",
  meta: "代謝／背景",
};

export const SYSTEM_ORDER: readonly EdSystemKey[] = [
  "const",
  "resp",
  "cv",
  "gi",
  "gu",
  "neuro",
  "trauma",
  "msk",
  "bleed",
  "psych",
  "meta",
];
