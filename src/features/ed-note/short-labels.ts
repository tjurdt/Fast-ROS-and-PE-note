/**
 * 格子裡顯示的短字（使用者要求：一格最多四個中文字，含斜線；放不下就佔兩到三格，不要換行）。
 * 這裡只管顯示：存檔的值、病歷輸出、aria-label 都還是題庫裡的完整標籤。
 */

/** 問診題的短名。 */
export const HISTORY_SHORT: Readonly<Record<string, string>> = {
  similar_episode: "曾發作",
  chills: "畏寒",
  sick_contact: "接觸病人",
  dyspnea: "喘",
  orthopnea: "端坐呼吸",
  rhinorrhea: "流鼻水",
  pleuritic: "吸氣加劇",
  syncope: "暈厥",
  presyncope: "快暈倒",
  chest_radiate: "放射痛",
  chest_exert: "活動誘發",
  chest_position: "按壓痛",
  abd_migrate: "轉移右下",
  no_flatus: "無排氣",
  hematochezia: "血便",
  hematemesis: "吐血",
  dysphagia: "吞嚥困難",
  heartburn: "火燒心",
  food_trigger: "飲食誘發",
  nsaid_steroid: "NSAID",
  jaundice: "黃疸",
  abd_surgery: "腹部手術",
  frequency: "頻尿",
  flank_pain: "腰側痛",
  genital_discharge: "分泌物",
  lmp: "LMP",
  headache_worst: "雷擊頭痛",
  dizzy_position: "姿勢誘發",
  weak_focal: "單側無力",
  slurred: "口齒不清",
  vision: "視力模糊",
  confusion: "意識混亂",
  hearing: "聽力耳鳴",
  lkw: "LKW",
  walk_after: "能走路",
  tetanus: "破傷風",
  limb_pain: "肢體痛",
  wound: "傷口",
  allergen: "過敏原",
  lip_swell: "唇舌腫",
  calf_pain: "小腿腫痛",
  immobil: "久臥制動",
  anticoag: "抗凝血",
  self_harm: "自傷",
  anxiety: "焦慮",
  substance: "物質濫用",
  hallucination: "幻覺",
  polyuria: "多尿多渴",
  dm_meds_issue: "糖藥異常",
  bp_meds_issue: "壓藥異常",
  abx_recent: "用抗生素",
  ent_type: "症狀",
  eye_type: "症狀",
  uri_type: "症狀",
  psych_type: "症狀",
  back_radiate: "下肢放射",
  bp_type: "方向",
  glu_type: "方向",
  gib_type: "型態",
  last_hd: "末次洗腎",
  hd_missed: "漏洗腎",
  access_problem: "廔管問題",
  last_chemo: "末次化療",
  device: "管路",
  steroid_use: "類固醇",
  dysuria: "解尿痛",
  neck_stiff_h: "頸僵硬",
  low_urine: "尿量少",
  retention: "解不出",
  leg_edema: "腳水腫",
  injury_site: "部位",
  injury_time: "時間",
};

/** 選項短名：key = `題目id:選項標籤`。 */
export const OPTION_SHORT: Readonly<Record<string, string>> = {
  "abd_site:右上腹": "右上",
  "abd_site:上腹／心窩": "上腹",
  "abd_site:左上腹": "左上",
  "abd_site:右腰側": "右側",
  "abd_site:臍周": "臍周",
  "abd_site:左腰側": "左側",
  "abd_site:右下腹": "右下",
  "abd_site:下腹／恥骨上": "下腹",
  "abd_site:左下腹": "左下",
  "abd_site:全腹": "全腹",
  "back_site:上背／胸背": "上背",
  "back_site:下背／腰": "下背腰",
  "syncope_trigger:休息或平躺": "平躺時",
  "syncope_trigger:排尿／排便／咳嗽時": "解尿便咳",
  "syncope_trigger:無明顯誘因": "無誘因",
  "dysp_trigger:休息時也喘": "休息也喘",
  "ent_type:吞嚥困難／梗到": "吞嚥困難",
  "eye_type:視野缺損／閃光": "視野缺損",
  "psych_type:焦慮／恐慌": "焦慮",
  "psych_type:自傷／服藥過量": "自傷",
  "palp_pattern:突然開始突然停": "突發突停",
  "uri_type:腰／側腹痛": "腰側痛",
  "mechanism:機車／車禍": "車禍",
  "mechanism:被打／攻擊": "被攻擊",
};

/** PE 項目短名。 */
export const PE_SHORT_LABEL: Readonly<Record<string, string>> = {
  heent_pupil: "瞳孔",
  heent_mucosa: "口腔黏膜",
  heent_head_trauma: "頭臉外傷",
  neck_jve: "頸靜脈",
  neck_accessory: "呼吸輔肌",
  neck_lap: "淋巴結",
  chest_wall: "胸壁",
  abd_inspect: "外觀軟硬",
  abd_murphy: "Murphy",
  abd_mass: "腫塊肝脾",
  back_cva: "CVA",
  back_slr: "SLR",
  gu_ext: "外生殖器",
  ext_motion: "活動關節",
  neuro_orient: "定向力",
  neuro_face: "顱神經",
  neuro_cerebellar: "小腦步態",
  neuro_babinski: "Babinski",
  neuro_dixhallpike: "Dix-H",
};

/** PE 異常快選的九宮格中文（腹部部位）。 */
export const SITE_SHORT: Readonly<Record<string, string>> = {
  RUQ: "右上",
  epigastric: "上腹",
  LUQ: "左上",
  "R flank": "右側",
  periumbilical: "臍周",
  "L flank": "左側",
  RLQ: "右下",
  suprapubic: "下腹",
  LLQ: "左下",
  diffuse: "全腹",
};

/** 過去病史短名。 */
export const PMH_SHORT: Readonly<Record<string, string>> = {
  none: "無病史",
  stroke: "中風TIA",
  hbv: "B/C肝",
};

/** 視覺寬度：中日文全形字 1，其他 0.55。 */
export function visualLength(text: string): number {
  let length = 0;
  for (const ch of text) length += ch.charCodeAt(0) >= 0x2e80 ? 1 : 0.55;
  return length;
}

/** 一格放得下約四個中文字；超過就佔兩格、三格（不換行）。extra = ★、+／− 等小記號。 */
export function cellSpan(text: string, extra = 0): 1 | 2 | 3 {
  const length = visualLength(text) + extra;
  if (length <= 4.3) return 1;
  if (length <= 8.8) return 2;
  return 3;
}

export function spanStyle(span: number) {
  return span > 1 ? { gridColumn: `span ${span}` } : undefined;
}
