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
  /** 同一個症狀已經在前面寫過時，只補這段細節（例如 "at rest"）；缺省用 text。 */
  detail?: string;
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
  /** 可複選（例如腹痛部位可以同時右上腹＋上腹）。 */
  multi?: boolean;
  /** 複選時寫進 PI 的樣板：{v} = 各選項 cc（或 text）以 ", " 串接，例如 "abd pain ({v})"。 */
  joinTemplate?: string;
  /** grid9 = 腹部九宮格排列（前九個選項依右上→左下，之後的選項接在旁邊）。 */
  layout?: "grid9";
}

/** 自由文字（例如 LMP、最後正常時間）；有填才輸出。 */
export interface HistoryText extends HistoryBase {
  type: "text";
  placeholder?: string;
  /** 輸出格式，{v} 代入輸入值。 */
  template: string;
}

export type HistoryItem = HistoryYesNo | HistoryPick | HistoryText;

/**
 * 「類型 × 部位」的異常所見（呼吸音、心雜音、水腫、肌力…）。
 * 每個類型可以各自選變化型（fine／coarse…）與部位（R lower／bil…），輸出時併成
 * 一句，例如 "fine rales (RLL, LLL); expiratory wheezing (bil)"，同一個類型不會重複寫。
 * 存檔在 finding.fu：`m:<類型>` = "1" 選了這個類型、`v:<類型>@<變化型>`、`s:<類型>@<部位>`。
 */
export interface PeMatrixRow {
  /** 按鈕文字（也是存檔的 key）。 */
  label: string;
  /** 寫進病歷的名稱。 */
  text: string;
  /** 變化型：放在名稱前面（"fine" rales），suffix 時放後面（"RUE MP" + "4"）。 */
  variants?: string[];
  variantAfter?: boolean;
  /** 這個類型不需要部位（stridor、prolonged expiration）。 */
  noSites?: boolean;
}

export interface PeMatrix {
  rows: PeMatrixRow[];
  /** 部位選項（依畫面順序）。 */
  sites: string[];
  /** 部位的標題，畫面顯示用。 */
  siteTitle?: string;
}

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
  /** grid9 = 異常快選用腹部九宮格排列。 */
  layout?: "grid9";
  /** 類型 × 部位的異常所見（有的話，畫面用矩陣；abnormal 仍可當一般快選）。 */
  matrix?: PeMatrix;
  /** 舊版快選片語：畫面不再顯示，但舊資料裡已勾的仍照樣輸出。 */
  legacy?: string[];
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
  /** 搭配 offWhenPicked：只有選到這些選項才取消預設（其餘選項仍維持預設勾選）。 */
  offWhenOptions?: string[];
  /** 某個有／無題回答「無」時自動勾選（例如沒有嘔吐 → R11.0 Nausea）。 */
  whenNo?: string;
  /** 某個有／無題回答「無」時，不再因 defaultOn 而勾選。 */
  offWhenNo?: string;
  /**
   * 依該主訴的時間決定：acute = 有標時間且在 3 週內才勾；
   * chronicOrUnknown = 上述情況以外才勾（例如 R05.1 acute cough／R05.9）。
   */
  duration?: "acute" | "chronicOrUnknown";
}

export type EdProblemGroup =
  "全身代謝" | "心肺" | "消化" | "泌尿婦產" | "神經" | "五官" | "外傷皮膚骨科" | "精神";

export interface EdProblem {
  id: string;
  /** 畫面上的短名（四個字以內）。 */
  label: string;
  /** 較完整的說明（舊的長標籤），給搜尋與滑鼠提示用。 */
  hint?: string;
  /** 主訴片語（英文，精簡）。 */
  cc: string;
  /** 以某個 pick 題的選項修飾主訴（例如腹痛部位 → "RLQ abd pain"）。 */
  ccFrom?: string;
  /**
   * prefix（缺省）：選項的 cc 加在 cc 前面（"RLQ" + "abd pain"）。
   * replace：選項的 cc 取代整個主訴片語（"melena" 取代 "GI bleeding"）。
   */
  ccMode?: "prefix" | "replace";
  /** 主訴依「有」的題目決定（例如神經缺損：單側無力／麻木／口齒不清／臉歪），多個以逗號串接。 */
  ccFromYes?: { item: string; cc: string }[];
  /** 搭配 ccFromYes：列出的題目全部都是「有」時，改用 cc（例如噁心＋嘔吐 → N/V）。 */
  ccWhenAllYes?: boolean;
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
  order: (id: string) => `ed.ord.${id}`,
  /** 自訂主訴：fu = { 症狀文字: 選取順序 }。 */
  custom: "ed.custom",
  /** 指定的主要主訴：sel = 問題 id 或 `custom:<症狀文字>`。 */
  main: "ed.main",
  /** 特別情境：on = 勾選，text = 細節。 */
  special: (id: string) => `ed.sp.${id}`,
  /** 各 PE 欄位的自由補充文字。 */
  peExtra: (field: EdPeField) => `ed.pex.${field}`,
  /** 每一句的寫入設定：sel = "omit"（不寫入）或 "keep"（一定寫入）。 */
  omit: (clauseId: string) => `ed.omit.${clauseId}`,
  icd: "ed.icd",
  /** 每個主訴各自的時間：fu = { 主訴 id: 代碼 }，grp = { 主訴 id: 自訂文字 }。 */
  duration: "ed.dur",
} as const;

/** 主訴、背景相關的單欄文字。 */
export type EdContextKey =
  | "duration"
  | "nrs"
  | "allergy"
  | "meds"
  | "referral"
  | "ccExtra"
  /** 問診補充（自由輸入，寫進 PI 結尾）。 */
  | "piExtra"
  /** "off" = 關閉超過字數時的自動精簡。 */
  | "autoFit"
  /** 其他（自由輸入的背景情境，直接接在 PH 的 HX／Med 後面，不加前綴）。 */
  | "situation";
