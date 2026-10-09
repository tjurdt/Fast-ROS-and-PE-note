/**
 * 急診問題導向模式的資料型別。
 *
 * 設計重點：題目（問診／PE）是「共用題庫」，問題（problem）只是引用題庫 id 的清單。
 * 同一題被多個問題引用時，畫面只出現一次、答案只記一次，輸出也只算一次。
 */

/** 急診病歷表單（ERS createRecord）上可輸出的欄位。 */
export type EdFieldKey =
  | "CC"
  | "NRS"
  | "PI"
  | "PH"
  | "GC"
  | "HEENT"
  | "NECK"
  | "CHEST"
  | "ABD"
  | "BACK"
  | "GU"
  | "RECTAL"
  | "EXT"
  | "NEURO";

/** PE 對應的欄位（依表單順序）。 */
export type EdPeField = Extract<
  EdFieldKey,
  "GC" | "HEENT" | "NECK" | "CHEST" | "ABD" | "BACK" | "GU" | "RECTAL" | "EXT" | "NEURO"
>;

/** 問診題所屬系統；同系統的題目在畫面上排在一起。 */
export type EdSystemKey =
  | "const"
  | "resp"
  | "cv"
  | "gi"
  | "gu"
  | "neuro"
  | "trauma"
  | "msk"
  | "bleed"
  | "psych"
  | "meta";

export interface EdPickOption {
  /** 畫面按鈕文字（繁中）。 */
  label: string;
  /** 寫進病歷的英文片段。 */
  text: string;
  /** 若這題被指定為主訴修飾詞（ccFrom），主訴使用的片語；缺省則不修飾。 */
  cc?: string;
}

interface HistoryBase {
  id: string;
  system: EdSystemKey;
  label: string;
  /** 只在符合條件時出現。fertile = 女性且 12–55 歲（年齡空白也算）。 */
  gate?: "fertile";
}

/** 有／無（可附細節）。未回答 = 不寫進病歷。 */
export interface HistoryYesNo extends HistoryBase {
  type: "yn";
  /** 陽性時的片語。 */
  pos: string;
  /** 陰性時列在 "no ..." 清單中的簡短詞（缺省 = pos）。 */
  neg?: string;
  /** 陰性時不適合用 "no ..." 句型時，直接輸出這個完整片語（例如 unable to walk）。 */
  negPhrase?: string;
  /** 細節輸入：chips 為快選，text 為自由輸入；陽性時附在片語後面括號內。 */
  detail?: { chips?: string[]; placeholder?: string };
}

/** 單選（例如起病方式、疼痛性質）。 */
export interface HistoryPick extends HistoryBase {
  type: "pick";
  options: EdPickOption[];
}

/** 自由文字（例如 LMP、最後正常時間）；有填才輸出。 */
export interface HistoryText extends HistoryBase {
  type: "text";
  placeholder?: string;
  /** 輸出格式，{v} 代入輸入值。 */
  template: string;
}

export type HistoryItem = HistoryYesNo | HistoryPick | HistoryText;

export interface PeItem {
  id: string;
  field: EdPeField;
  label: string;
  /** 正常時寫進病歷的片語。 */
  normal: string;
  /** 異常快選（可複選）。 */
  abnormal: string[];
  /**
   * 異常片語樣板：有的話，複選結果以 "/" 串接後代入 {v}
   * （例如 "tenderness(+) at {v}"）；缺省則各自成為獨立片語。
   */
  abnormalTemplate?: string;
}

/** 病史快選（寫進 PH 的 HX:）。 */
export interface PmhItem {
  id: string;
  label: string;
  /** 寫進病歷的片語；缺省 = label。 */
  text?: string;
  /** 允許補充細節（例如癌別、洗腎方式）。 */
  detail?: boolean;
  /** 勾選此項時，額外要問的題目。 */
  asks?: string[];
}

export interface IcdChoice {
  code: string;
  /** ICD-10-CM 英文描述（病歷頁在帶入後顯示用）。 */
  desc: string;
  /** 選了此問題就預設勾選。 */
  defaultOn?: boolean;
  /** 當某個 pick 題選到指定選項時自動勾選（例如解尿疼痛 → R30.0）。 */
  whenPick?: { item: string; option: string };
  /** 該 pick 題已回答時，不再因 defaultOn 而勾選（改由 whenPick 決定）。 */
  offWhenPicked?: string;
}

export type EdProblemGroup =
  "全身" | "心肺" | "消化" | "泌尿婦產" | "神經" | "外傷皮膚骨科" | "其他";

export interface EdProblem {
  id: string;
  label: string;
  /** 主訴片語（英文，精簡）。 */
  cc: string;
  /** 以某個 pick 題的選項修飾主訴（例如腹痛部位 → "RLQ abd pain"）。 */
  ccFrom?: string;
  /**
   * prefix（缺省）：選項的 cc 加在 cc 前面（"RLQ" + "abd pain"）。
   * replace：選項的 cc 取代整個主訴片語（"melena" 取代 "GI bleeding"）。
   */
  ccMode?: "prefix" | "replace";
  group: EdProblemGroup;
  /** 此問題專屬的特徵題（起病、性質、部位…），畫面放在問題標題下。 */
  characterize: string[];
  /** 必問或常問：預設展開。 */
  ask: string[];
  /** 視情況再問：預設收合。 */
  askMore: string[];
  /** 不可漏問的題（紅旗）；必須是 characterize/ask 的子集。 */
  must: string[];
  /** 預設 PE。 */
  pe: string[];
  /** 視情況再做的 PE。 */
  peMore: string[];
  /** 不可漏做的 PE。 */
  peMust: string[];
  /** 是否顯示 NRS 疼痛評分。 */
  pain?: boolean;
  icd: IcdChoice[];
}

/** 存在 patient.findings 裡的 key 命名空間；統一從這裡產生，避免字串散落。 */
export const edKey = {
  problem: (id: string) => `ed.p.${id}`,
  history: (id: string) => `ed.h.${id}`,
  pe: (id: string) => `ed.pe.${id}`,
  pmh: (id: string) => `ed.pmh.${id}`,
  ctx: (id: EdContextKey) => `ed.ctx.${id}`,
  tocc: (id: "t" | "o" | "c1" | "c2") => `ed.tocc.${id}`,
  override: (field: EdFieldKey) => `ed.ov.${field}`,
  icd: "ed.icd",
} as const;

/** 主訴、背景相關的單欄文字。 */
export type EdContextKey =
  "duration" | "nrs" | "allergy" | "meds" | "referral" | "ccExtra";
