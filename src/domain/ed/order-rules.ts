import {
  isFertilePatient,
  pmhPositiveIds,
  selectedProblems,
  type EdFindings,
  type EdPatientContext,
} from "./compose";
import { ED_ORDERS, ED_ORDER_GROUP_ORDER, edOrder, type EdOrder } from "./orders";
import { edKey } from "./types";

/**
 * 檢查建議引擎：依「已選問題＋問診答案＋病史＋年齡性別」建議 ERS 檢查驗系統的項目。
 *
 * 原則（使用者指定）：寧可合理地多開，也不要漏做。因此：
 *   core = 該問題的標準檢查，預設勾選
 *   plus = 合理的加開（情境成立才出現），預設勾選
 *   ask  = 輻射量大／需會診或 VS 同意／證據較弱，只列出，預設不勾
 * 同一項目被多個問題要求時只出現一次（取最高層級，理由合併）；
 * 功能重複的項目只留一個（例如 troponin 只開一種、CXR 只開一種）。
 *
 * 規則依據：北榮急診 PGY 口袋書（各主訴檢查表、抽血提醒）與急診科常用組套
 * （新手指引、r/o ACS、SOB、敗血症、腦中風、OHCA、外傷總表等）。
 * 這是「建議」，不是醫囑；最終由醫師判斷，並以 ERS 開單時的檢核為準。
 */

export type OrderTier = "core" | "plus" | "ask";

const TIER_RANK: Readonly<Record<OrderTier, number>> = { core: 3, plus: 2, ask: 1 };

/** 規則可引用的「虛擬項目」，在最後一步依情境換成實際項目。 */
type PseudoId = "trop" | "cxr";

interface Rule {
  id: string;
  tier: OrderTier;
  why: string;
  when?: (ctx: Ctx) => boolean;
}

interface Ctx {
  problems: ReadonlySet<string>;
  pmh: ReadonlySet<string>;
  age: number | null;
  female: boolean;
  fertile: boolean;
  /** 年齡 ≥ 65。 */
  older: boolean;
  /** 年齡 ≥ 50。 */
  midlife: boolean;
  /** 心血管風險：年齡 ≥ 50 或有相關病史。 */
  cardiacRisk: boolean;
  /** 免疫低下或重大共病（感染風險高）。 */
  vulnerable: boolean;
  yes: (id: string) => boolean;
  sel: (id: string) => string;
  text: (id: string) => string;
}

const r = (
  id: string,
  tier: OrderTier,
  why: string,
  when?: (ctx: Ctx) => boolean,
): Rule => ({ id, tier, why, ...(when ? { when } : {}) });

// ───────────── 情境 ─────────────

function buildContext(findings: EdFindings, patient: EdPatientContext): Ctx {
  const problems = new Set(selectedProblems(findings).map((problem) => problem.id));
  const pmh = new Set(pmhPositiveIds(findings));
  const parsedAge = Number.parseInt(patient.age, 10);
  const age = Number.isNaN(parsedAge) ? null : parsedAge;
  const cardiacHistory = [
    "cad",
    "chf",
    "af",
    "stroke",
    "dm",
    "htn",
    "hld",
    "ckd",
    "esrd",
  ];
  return {
    problems,
    pmh,
    age,
    female: patient.sex === "女 F",
    fertile: isFertilePatient(patient),
    older: age !== null && age >= 65,
    midlife: age !== null && age >= 50,
    cardiacRisk:
      (age !== null && age >= 50) || cardiacHistory.some((id) => pmh.has(id)),
    vulnerable: ["cancer", "immuno", "ckd", "esrd", "cirrhosis", "dm"].some((id) =>
      pmh.has(id),
    ),
    yes: (id) => findings[edKey.history(id)]?.on === true,
    sel: (id) => findings[edKey.history(id)]?.sel ?? "",
    text: (id) => (findings[edKey.history(id)]?.text ?? "").trim(),
  };
}

// ───────────── 共用規則組 ─────────────

/** 新手指引「基本兩管」：CBC/DC、Na、K、Crea、Glu、CRP。 */
const basic = (why: string, tier: OrderTier = "core"): Rule[] => [
  r("cbc_dc", tier, why),
  r("na", tier, why),
  r("k", tier, why),
  r("crea", tier, why),
  r("glu", tier, why),
  r("crp", tier, why),
];

// ───────────── 各問題的規則 ─────────────

const PROBLEM_RULES: Readonly<Record<string, readonly Rule[]>> = {
  fever: [
    ...basic("發燒基本檢查"),
    r("alt", "core", "發燒找感染源：肝功能"),
    r("cxr" as PseudoId, "core", "發燒：肺部感染篩檢"),
    r("urine_routine", "core", "發燒：泌尿道感染篩檢"),
    r("flu", "core", "發燒：流感快篩"),
    r("covid_ag", "core", "發燒：COVID 快篩"),
    r("bcx", "plus", "發燒：血液培養兩套（檢傷 1-2 類用抗生素前必開）"),
    r("lactate", "plus", "發燒且高風險：評估敗血症", (c) => c.older || c.vulnerable),
    r("pct", "plus", "發燒且年長：細菌感染參考", (c) => c.older),
    r("tbil", "plus", "發燒：肝膽感染篩檢"),
    r("ggt", "plus", "發燒：肝膽感染篩檢"),
    r(
      "urine_cx",
      "plus",
      "發燒＋泌尿危險因子：尿液培養",
      (c) => c.yes("dysuria") || c.yes("foley") || c.yes("flank_pain") || c.older,
    ),
    r("sputum_cx", "plus", "發燒＋有痰：痰液培養", (c) => c.yes("sputum")),
    r("stool_routine", "plus", "發燒＋腹瀉", (c) => c.yes("diarrhea")),
    r(
      "c_diff",
      "plus",
      "腹瀉＋近期抗生素",
      (c) => c.yes("diarrhea") && c.yes("abx_recent"),
    ),
    r("vbg", "plus", "發燒＋喘", (c) => c.yes("dyspnea")),
    r("ecg", "plus", "老人發燒常不典型", (c) => c.older),
  ],

  weakness: [
    ...basic("全身無力基本檢查"),
    r("alt", "core", "全身無力：肝功能"),
    r("urine_routine", "core", "全身無力：泌尿道感染／電解質"),
    r("ck", "plus", "全身無力：橫紋肌／心肌"),
    r("ca", "plus", "全身無力：鈣"),
    r("mg", "plus", "全身無力：鎂"),
    r("phos", "plus", "全身無力：磷"),
    r("bun", "plus", "全身無力：脫水／腎功能"),
    r("ecg", "core", "年長或有心血管風險的無力", (c) => c.cardiacRisk),
    r("ecg", "plus", "全身無力：排除心律不整"),
    r("trop" as PseudoId, "plus", "年長或有心血管風險的無力", (c) => c.cardiacRisk),
    r("cxr" as PseudoId, "plus", "年長無力：隱性肺炎", (c) => c.older),
    r("lactate", "plus", "年長無力：隱性敗血症", (c) => c.older),
    r("urine_cx", "plus", "年長無力：隱性泌尿道感染", (c) => c.older),
    r("tsh", "plus", "全身無力：甲狀腺"),
  ],

  bp_abnormal: [
    ...basic("血壓異常基本檢查"),
    r("ecg", "core", "血壓異常"),
    r("bun", "plus", "血壓異常：腎功能"),
    r("urine_routine", "plus", "血壓異常：蛋白尿／感染"),
    r(
      "cxr" as PseudoId,
      "plus",
      "血壓異常：肺水腫／縱膈",
      (c) => c.sel("bp_type") === "偏高",
    ),
    r("trop" as PseudoId, "plus", "血壓異常且有風險", (c) => c.cardiacRisk),
    r(
      "bnp",
      "plus",
      "血壓異常＋喘或水腫",
      (c) => c.yes("dyspnea") || c.yes("leg_edema"),
    ),
    r("lactate", "plus", "低血壓：灌流", (c) => c.sel("bp_type") === "偏低"),
    r("vbg", "plus", "低血壓：酸鹼", (c) => c.sel("bp_type") === "偏低"),
    r(
      "bcx",
      "plus",
      "低血壓＋發燒",
      (c) => c.sel("bp_type") === "偏低" && c.yes("fever"),
    ),
  ],

  glucose: [
    r("glu", "core", "血糖異常"),
    r("onetouch", "core", "血糖異常：床邊血糖（護理師）"),
    r("na", "core", "血糖異常：電解質"),
    r("k", "core", "血糖異常：電解質"),
    r("crea", "core", "血糖異常：腎功能"),
    r("bun", "core", "血糖異常：腎功能"),
    r("ketone", "core", "高血糖：酮體", (c) => c.sel("glu_type") !== "偏低"),
    r("vbg", "core", "高血糖：酸鹼（DKA/HHS）", (c) => c.sel("glu_type") !== "偏低"),
    r("urine_routine", "core", "血糖異常：酮尿／感染"),
    r("cbc_dc", "plus", "血糖異常：找誘因"),
    r("crp", "plus", "血糖異常：找誘因"),
    r("ecg", "plus", "血糖異常：鉀離子影響"),
    r("hba1c", "plus", "血糖異常：長期控制"),
    r("lactate", "plus", "血糖異常：酸中毒"),
    r("mg", "plus", "血糖異常：電解質"),
    r("phos", "plus", "血糖異常：電解質"),
    r("alt", "plus", "低血糖：肝功能", (c) => c.sel("glu_type") === "偏低"),
  ],

  lab_referral: [
    ...basic("檢驗異常／門診轉入：重新確認"),
    r("alt", "plus", "檢驗異常／門診轉入"),
    r("bun", "plus", "檢驗異常／門診轉入"),
    r("urine_routine", "plus", "檢驗異常／門診轉入"),
    r("ecg", "plus", "檢驗異常／門診轉入（電解質）"),
    r("ck", "plus", "檢驗異常／門診轉入"),
  ],

  chest_pain: [
    ...basic("胸痛基本檢查"),
    r("ck", "core", "胸痛：心肌酵素"),
    r("trop" as PseudoId, "core", "胸痛：心肌 troponin"),
    r("ecg", "core", "胸痛：10 分鐘內 EKG"),
    r("cxr" as PseudoId, "core", "胸痛：胸部 X 光"),
    r("ddimer", "plus", "胸痛：排除肺栓塞"),
    r("pt", "plus", "胸痛：凝血（可能需抗凝或介入）"),
    r("aptt", "plus", "胸痛：凝血（可能需抗凝或介入）"),
    r("lactate", "plus", "胸痛：灌流"),
    r("alt", "plus", "胸痛：肝功能／上腹痛"),
    r(
      "bnp",
      "plus",
      "胸痛＋喘／水腫／心衰",
      (c) => c.yes("dyspnea") || c.yes("leg_edema") || c.pmh.has("chf"),
    ),
    r("sono_cardiac", "plus", "胸痛：心包膜積液／心室功能"),
    r("sono_sob", "plus", "胸痛＋喘：肺部超音波", (c) => c.yes("dyspnea")),
    r(
      "ct_chest",
      "ask",
      "懷疑主動脈剝離／肺栓塞（背痛放射、血壓差、D-dimer 高）→ 與 VS 討論",
      (c) => c.yes("chest_radiate") || c.cardiacRisk,
    ),
  ],

  dyspnea: [
    ...basic("喘基本檢查"),
    r("ck", "core", "喘：心肌酵素"),
    r("trop" as PseudoId, "core", "喘：心肌 troponin"),
    r("ecg", "core", "喘：EKG"),
    r("cxr" as PseudoId, "core", "喘：胸部 X 光"),
    r("vbg", "core", "喘：血氧／酸鹼（至少要有血氧）"),
    r("bnp", "core", "喘：心衰竭"),
    r("ddimer", "plus", "喘：排除肺栓塞"),
    r("pt", "plus", "喘：凝血"),
    r("aptt", "plus", "喘：凝血"),
    r("lactate", "plus", "喘：灌流"),
    r("alb", "plus", "喘：水腫／營養"),
    r("alt", "plus", "喘：肝功能"),
    r("tbil", "plus", "喘：肝功能"),
    r("ca_free", "plus", "喘：離子鈣"),
    r("bun", "plus", "喘：腎功能"),
    r("flu", "plus", "喘＋發燒或咳嗽", (c) => c.yes("fever") || c.yes("cough")),
    r("covid_ag", "plus", "喘＋發燒或咳嗽", (c) => c.yes("fever") || c.yes("cough")),
    r("sputum_cx", "plus", "喘＋有痰", (c) => c.yes("sputum")),
    r("bcx", "plus", "喘＋發燒", (c) => c.yes("fever")),
    r("pct", "plus", "喘＋發燒", (c) => c.yes("fever")),
    r("urine_routine", "plus", "喘：找感染源"),
    r("sono_sob", "plus", "喘：床邊肺部超音波"),
    r("sono_cardiac", "plus", "喘：床邊心臟超音波"),
    r("ct_chest", "ask", "喘：懷疑肺栓塞或肺部病灶，需影像時與 VS 討論"),
  ],

  palpitation: [
    ...basic("心悸基本檢查"),
    r("ecg", "core", "心悸：抓心律"),
    r("mg", "core", "心悸：鎂"),
    r("tsh", "core", "心悸：甲狀腺"),
    r("ca", "plus", "心悸：鈣"),
    r("phos", "plus", "心悸：磷"),
    r("ft4", "plus", "心悸：甲狀腺"),
    r(
      "trop" as PseudoId,
      "plus",
      "心悸：排除缺血",
      (c) => c.cardiacRisk || c.yes("chest_pain"),
    ),
    r("cxr" as PseudoId, "plus", "心悸：胸部 X 光"),
    r(
      "digoxin",
      "plus",
      "心悸＋心房顫動／心衰：藥物濃度",
      (c) => c.pmh.has("af") || c.pmh.has("chf"),
    ),
    r(
      "ddimer",
      "plus",
      "心悸＋喘或胸痛",
      (c) => c.yes("dyspnea") || c.yes("chest_pain"),
    ),
    r("bun", "plus", "心悸：脫水"),
    r("sono_cardiac", "plus", "心悸：床邊心臟超音波"),
  ],

  syncope: [
    ...basic("暈厥基本檢查"),
    r("ecg", "core", "暈厥：EKG"),
    r("trop" as PseudoId, "core", "暈厥：排除心因性"),
    r("ck", "plus", "暈厥：心肌酵素"),
    r("bun", "plus", "暈厥：脫水／上消化道出血"),
    r("mg", "plus", "暈厥：電解質"),
    r("ca", "plus", "暈厥：電解質"),
    r("cxr" as PseudoId, "plus", "暈厥：胸部 X 光"),
    r("urine_routine", "plus", "暈厥：感染／脫水"),
    r("lactate", "plus", "暈厥：灌流"),
    r("alt", "plus", "暈厥：肝功能"),
    r(
      "ddimer",
      "plus",
      "暈厥＋喘／胸痛／水腫／久臥：排除肺栓塞",
      (c) =>
        c.yes("dyspnea") ||
        c.yes("chest_pain") ||
        c.yes("leg_edema") ||
        c.yes("immobil"),
    ),
    r(
      "pt",
      "plus",
      "暈厥＋抗凝血藥或可能出血",
      (c) => c.yes("anticoag") || c.yes("melena") || c.yes("hematochezia"),
    ),
    r(
      "aptt",
      "plus",
      "暈厥＋抗凝血藥或可能出血",
      (c) => c.yes("anticoag") || c.yes("melena") || c.yes("hematochezia"),
    ),
    r("etoh", "plus", "暈厥＋飲酒", (c) => c.yes("alcohol")),
    r("sono_cardiac", "plus", "暈厥：床邊心臟超音波"),
    r(
      "ct_brain",
      "plus",
      "暈厥＋年長／抗凝血／頭部外傷／神經症狀",
      (c) =>
        c.older ||
        c.yes("anticoag") ||
        c.yes("head_strike") ||
        c.yes("weak_focal") ||
        c.yes("headache"),
    ),
    r(
      "ct_brain",
      "ask",
      "暈厥：無危險因子時由 VS 決定是否做腦部 CT",
      (c) =>
        !(
          c.older ||
          c.yes("anticoag") ||
          c.yes("head_strike") ||
          c.yes("weak_focal") ||
          c.yes("headache")
        ),
    ),
  ],

  cough_uri: [
    r("flu", "core", "咳嗽／上呼吸道感染：流感快篩"),
    r("covid_ag", "core", "咳嗽／上呼吸道感染：COVID 快篩"),
    r("cxr" as PseudoId, "core", "咳嗽：胸部 X 光"),
    r("cbc_dc", "plus", "咳嗽／上呼吸道感染"),
    r("crp", "plus", "咳嗽／上呼吸道感染"),
    r("sputum_cx", "plus", "咳嗽＋有痰", (c) => c.yes("sputum")),
    r("bcx", "plus", "咳嗽＋發燒且年長", (c) => c.yes("fever") && c.older),
    r("crea", "plus", "年長／共病的咳嗽", (c) => c.older || c.vulnerable),
    r("na", "plus", "年長／共病的咳嗽", (c) => c.older || c.vulnerable),
    r("k", "plus", "年長／共病的咳嗽", (c) => c.older || c.vulnerable),
    r(
      "ddimer",
      "plus",
      "咳嗽＋咳血或久臥",
      (c) => c.yes("hemoptysis") || c.yes("immobil"),
    ),
  ],

  ent: [
    r("cbc_dc", "plus", "耳鼻喉＋發燒", (c) => c.yes("fever")),
    r("crp", "plus", "耳鼻喉＋發燒", (c) => c.yes("fever")),
    r("flu", "plus", "喉嚨痛：流感快篩", (c) => c.yes("sore_throat")),
    r("covid_ag", "plus", "喉嚨痛：COVID 快篩", (c) => c.yes("sore_throat")),
    r("pt", "plus", "流鼻血：凝血", (c) => c.yes("epistaxis")),
    r("aptt", "plus", "流鼻血：凝血", (c) => c.yes("epistaxis")),
    r("cbc_dc", "plus", "流鼻血：血色素", (c) => c.yes("epistaxis")),
    r("neck_soft_xr", "plus", "吞嚥困難／異物感：頸部軟組織 X 光", (c) =>
      c.yes("dysphagia"),
    ),
    r(
      "ct_neck",
      "ask",
      "懷疑深頸部感染或異物：與 VS／ENT 討論",
      (c) => c.yes("dysphagia") || c.yes("fever"),
    ),
  ],

  eye: [],

  abd_pain: [
    ...basic("腹痛基本檢查"),
    r("alt", "core", "腹痛：肝功能"),
    r("lipase", "core", "腹痛：胰臟（上腹痛）"),
    r("urine_routine", "core", "腹痛：泌尿道"),
    r("cxr" as PseudoId, "core", "腹痛：胸部 X 光（註明站立，看橫膈下游離氣體）"),
    r("kub", "core", "腹痛：KUB"),
    r("bun", "plus", "腹痛：脫水／腎功能"),
    r("tbil", "plus", "腹痛：肝膽"),
    r("ggt", "plus", "腹痛：肝膽"),
    r("lactate", "plus", "腹痛：缺血／敗血症"),
    r("ecg", "plus", "年長／風險族群的上腹痛：排除心肌梗塞", (c) => c.cardiacRisk),
    r(
      "trop" as PseudoId,
      "plus",
      "年長／風險族群的上腹痛：排除心肌梗塞",
      (c) => c.cardiacRisk,
    ),
    r("ck", "plus", "年長／風險族群的上腹痛：排除心肌梗塞", (c) => c.midlife),
    r(
      "pt",
      "plus",
      "腹痛＋年長／抗凝血／肝硬化",
      (c) => c.older || c.yes("anticoag") || c.pmh.has("cirrhosis"),
    ),
    r(
      "aptt",
      "plus",
      "腹痛＋年長／抗凝血／肝硬化",
      (c) => c.older || c.yes("anticoag") || c.pmh.has("cirrhosis"),
    ),
    r(
      "urine_cx",
      "plus",
      "腹痛＋泌尿症狀／發燒／年長",
      (c) => c.yes("dysuria") || c.yes("fever") || c.older,
    ),
    r("bcx", "plus", "腹痛＋發燒", (c) => c.yes("fever")),
    r("sono_abd", "plus", "腹痛：床邊腹部超音波"),
    r("sono_pelvic", "plus", "育齡女性腹痛：子宮外孕／卵巢", (c) => c.fertile),
    r("sono_aortic_renal", "plus", "年長腹痛：腹主動脈瘤／腎", (c) => c.midlife),
    r("ct_upper_abd", "ask", "腹痛：腹膜徵象、年長或懷疑穿孔／阻塞／缺血 → 與 VS 討論"),
    r("ct_pelvis", "ask", "腹痛：下腹痛／懷疑闌尾炎 → 與 VS 討論"),
  ],

  nausea_vomiting: [
    ...basic("噁心嘔吐基本檢查"),
    r("alt", "core", "噁心嘔吐：肝功能"),
    r("lipase", "core", "噁心嘔吐：胰臟"),
    r("urine_routine", "core", "噁心嘔吐：酮尿／泌尿道"),
    r("bun", "plus", "噁心嘔吐：脫水"),
    r("ketone", "plus", "噁心嘔吐：酮體"),
    r("vbg", "plus", "噁心嘔吐：酸鹼"),
    r("mg", "plus", "噁心嘔吐：電解質"),
    r("phos", "plus", "噁心嘔吐：電解質"),
    r("lactate", "plus", "噁心嘔吐：灌流"),
    r("kub", "plus", "噁心嘔吐：腸阻塞"),
    r("ecg", "plus", "噁心嘔吐：排除心肌梗塞（年長／糖尿病）", (c) => c.cardiacRisk),
    r(
      "trop" as PseudoId,
      "plus",
      "噁心嘔吐：排除心肌梗塞（年長／糖尿病）",
      (c) => c.cardiacRisk,
    ),
    r("etoh", "plus", "噁心嘔吐＋飲酒", (c) => c.yes("alcohol")),
    r("sono_abd", "plus", "噁心嘔吐：床邊腹部超音波"),
    r(
      "ct_brain",
      "ask",
      "噁心嘔吐＋頭痛／神經症狀",
      (c) => c.yes("headache") || c.yes("weak_focal"),
    ),
  ],

  diarrhea: [
    ...basic("腹瀉基本檢查"),
    r("bun", "plus", "腹瀉：脫水"),
    r("stool_routine", "core", "腹瀉：糞便常規"),
    r("stool_ob", "plus", "腹瀉：潛血"),
    r("lactate", "plus", "腹瀉：灌流"),
    r("mg", "plus", "腹瀉：電解質"),
    r("phos", "plus", "腹瀉：電解質"),
    r("urine_routine", "plus", "腹瀉：脫水／感染"),
    r(
      "c_diff",
      "plus",
      "腹瀉＋近期抗生素或發燒",
      (c) => c.yes("abx_recent") || c.yes("fever"),
    ),
    r(
      "stool_cx",
      "plus",
      "腹瀉＋發燒或血便",
      (c) => c.yes("fever") || c.yes("hematochezia"),
    ),
    r("ecg", "plus", "年長腹瀉：鉀離子影響", (c) => c.older),
    r("kub", "ask", "腹瀉＋腹脹或腹痛：排除阻塞"),
  ],

  constipation_bloating: [
    ...basic("便秘腹脹基本檢查", "plus"),
    r("kub", "core", "便秘／腹脹：KUB"),
    r("alt", "plus", "便秘／腹脹"),
    r("lipase", "plus", "便秘／腹脹"),
    r("ca", "plus", "便秘：高血鈣"),
    r("lactate", "plus", "無排氣排便：缺血", (c) => c.yes("no_flatus")),
    r("stool_ob", "plus", "便秘／腹脹：潛血"),
    r("cxr" as PseudoId, "plus", "腹脹：橫膈下游離氣體"),
    r("ecg", "plus", "年長：排除心肌梗塞", (c) => c.older),
    r("ct_upper_abd", "ask", "無排氣排便／懷疑阻塞 → 與 VS 討論", (c) =>
      c.yes("no_flatus"),
    ),
    r("ct_pelvis", "ask", "無排氣排便／懷疑阻塞 → 與 VS 討論", (c) =>
      c.yes("no_flatus"),
    ),
  ],

  gi_bleed: [
    r("cbc_dc", "core", "消化道出血：血色素"),
    r("pt", "core", "消化道出血：凝血"),
    r("aptt", "core", "消化道出血：凝血"),
    r("crea", "core", "消化道出血：腎功能"),
    r("bun", "core", "消化道出血：BUN/Cr 比"),
    r("na", "core", "消化道出血：電解質"),
    r("k", "core", "消化道出血：電解質"),
    r("glu", "core", "消化道出血"),
    r("alt", "core", "消化道出血：肝功能"),
    r("tbil", "core", "消化道出血：肝功能"),
    r("cxr" as PseudoId, "core", "消化道出血：胸部 X 光"),
    r("stool_ob", "core", "消化道出血：潛血"),
    r("crp", "plus", "消化道出血"),
    r("alb", "plus", "消化道出血：肝硬化／營養"),
    r("lactate", "plus", "消化道出血：灌流"),
    r("stool_routine", "plus", "消化道出血：糞便常規"),
    r("kub", "plus", "消化道出血：KUB"),
    r("ecg", "core", "消化道出血：年長或有風險", (c) => c.cardiacRisk),
    r("ecg", "plus", "消化道出血：貧血相關缺血"),
    r("trop" as PseudoId, "plus", "消化道出血：貧血相關缺血", (c) => c.cardiacRisk),
    r("ammonia", "plus", "肝硬化消化道出血：肝腦病變", (c) => c.pmh.has("cirrhosis")),
    r("gastric_ob", "plus", "吐血：胃液潛血", (c) => c.yes("hematemesis")),
    r("ct_upper_abd", "ask", "血流動力不穩或找不到出血點：CTA → 與 VS 討論"),
  ],

  jaundice: [
    r("cbc_dc", "core", "黃疸"),
    r("alt", "core", "黃疸：肝功能"),
    r("ast", "core", "黃疸：肝功能（AST/ALT 比）"),
    r("tbil", "core", "黃疸：膽紅素"),
    r("dbil", "core", "黃疸：直接膽紅素"),
    r("ggt", "core", "黃疸：膽道"),
    r("alp", "core", "黃疸：膽道"),
    r("pt", "core", "黃疸：凝血"),
    r("aptt", "core", "黃疸：凝血"),
    r("crea", "core", "黃疸：腎功能"),
    r("na", "core", "黃疸"),
    r("k", "core", "黃疸"),
    r("glu", "core", "黃疸"),
    r("crp", "core", "黃疸：膽管炎"),
    r("lipase", "core", "黃疸：胰臟"),
    r("urine_routine", "core", "黃疸：尿膽紅素"),
    r("sono_abd", "core", "黃疸：床邊腹部超音波（膽管擴張）"),
    r("alb", "plus", "黃疸：肝功能"),
    r("lactate", "plus", "黃疸：灌流"),
    r("ammonia", "plus", "黃疸＋意識混亂", (c) => c.yes("confusion")),
    r("bcx", "plus", "黃疸＋發燒：膽管炎", (c) => c.yes("fever")),
    r("ct_upper_abd", "ask", "黃疸：影像確認膽道／腫瘤 → 與 VS 討論"),
  ],

  urinary: [
    r("urine_routine", "core", "泌尿症狀"),
    r("urine_cx", "core", "泌尿症狀：尿液培養"),
    r("cbc_dc", "core", "泌尿症狀"),
    r("crea", "core", "泌尿症狀：腎功能"),
    r("bun", "core", "泌尿症狀：腎功能"),
    r("na", "core", "泌尿症狀"),
    r("k", "core", "泌尿症狀"),
    r("crp", "core", "泌尿症狀"),
    r("glu", "plus", "泌尿症狀"),
    r(
      "sono_aortic_renal",
      "core",
      "腰痛／血尿／解不出尿：腎臟超音波（水腎）",
      (c) =>
        c.yes("flank_pain") ||
        c.yes("hematuria") ||
        c.yes("retention") ||
        c.yes("low_urine"),
    ),
    r("sono_aortic_renal", "plus", "泌尿症狀：腎臟超音波"),
    r("sono_abd", "plus", "解不出尿：膀胱超音波", (c) => c.yes("retention")),
    r(
      "kub",
      "plus",
      "腰痛／血尿：泌尿道結石",
      (c) => c.yes("flank_pain") || c.yes("hematuria"),
    ),
    r("bcx", "plus", "泌尿症狀＋發燒", (c) => c.yes("fever")),
    r("lactate", "plus", "泌尿症狀＋發燒", (c) => c.yes("fever")),
    r("ct_upper_abd", "ask", "疑似結石／腎盂腎炎併發症 → 與 VS 討論", (c) =>
      c.yes("flank_pain"),
    ),
    r("ct_pelvis", "ask", "疑似結石 → 與 VS 討論", (c) => c.yes("flank_pain")),
  ],

  gyn: [
    r("bhcg", "core", "陰道出血／婦科下腹痛：抽血 β-hCG", (c) => c.fertile),
    r("cbc_dc", "core", "陰道出血／婦科下腹痛"),
    r("urine_routine", "core", "陰道出血／婦科下腹痛"),
    r("sono_pelvic", "core", "陰道出血／婦科下腹痛：骨盆超音波"),
    r("pt", "plus", "陰道出血：凝血", (c) => c.yes("vag_bleed")),
    r("aptt", "plus", "陰道出血：凝血", (c) => c.yes("vag_bleed")),
    r("crea", "plus", "婦科下腹痛"),
    r("na", "plus", "婦科下腹痛"),
    r("k", "plus", "婦科下腹痛"),
    r("crp", "plus", "婦科下腹痛"),
    r("glu", "plus", "婦科下腹痛"),
    r("urine_cx", "plus", "婦科下腹痛＋解尿疼痛", (c) => c.yes("dysuria")),
    r("bcx", "plus", "婦科下腹痛＋發燒", (c) => c.yes("fever")),
  ],

  dizziness: [
    ...basic("頭暈基本檢查"),
    r("ecg", "core", "頭暈：排除心律不整"),
    r("alt", "plus", "頭暈"),
    r("ca_free", "plus", "頭暈：離子鈣"),
    r("ck", "plus", "頭暈"),
    r("mg", "plus", "頭暈：電解質"),
    r("urine_routine", "plus", "頭暈：感染／脫水"),
    r("cxr" as PseudoId, "plus", "頭暈：胸部 X 光"),
    r("trop" as PseudoId, "plus", "頭暈：年長或有風險，排除缺血", (c) => c.cardiacRisk),
    r(
      "digoxin",
      "plus",
      "頭暈＋心房顫動／心衰：藥物濃度",
      (c) => c.pmh.has("af") || c.pmh.has("chf"),
    ),
    r(
      "ct_brain",
      "plus",
      "頭暈＋年長／血管風險／神經症狀：排除小腦中風與出血",
      (c) =>
        c.older ||
        ["htn", "dm", "af", "stroke", "cad"].some((id) => c.pmh.has(id)) ||
        c.yes("weak_focal") ||
        c.yes("gait") ||
        c.yes("vision") ||
        c.yes("headache"),
    ),
    r(
      "ct_brain",
      "ask",
      "頭暈：無危險因子時由 VS 決定是否做腦部 CT",
      (c) =>
        !(
          c.older ||
          ["htn", "dm", "af", "stroke", "cad"].some((id) => c.pmh.has(id)) ||
          c.yes("weak_focal") ||
          c.yes("gait") ||
          c.yes("vision") ||
          c.yes("headache")
        ),
    ),
    r(
      "mri_brain",
      "ask",
      "頭暈：懷疑後循環中風、CT 陰性仍高度懷疑 → 與 VS／神經科討論",
    ),
  ],

  headache: [
    r("cbc_dc", "plus", "頭痛"),
    r("crp", "plus", "頭痛"),
    r("na", "plus", "頭痛"),
    r("k", "plus", "頭痛"),
    r("crea", "plus", "頭痛"),
    r("glu", "plus", "頭痛"),
    r("ecg", "plus", "年長頭痛", (c) => c.older),
    r("pt", "plus", "頭痛＋抗凝血藥", (c) => c.yes("anticoag")),
    r("aptt", "plus", "頭痛＋抗凝血藥", (c) => c.yes("anticoag")),
    r(
      "bcx",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r(
      "lactate",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r(
      "cbc_dc",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r(
      "crp",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r(
      "ct_brain",
      "core",
      "頭痛紅旗（雷擊樣／頸僵硬／神經症狀／意識／抽搐／發燒／抗凝血／年長）：排除出血與腫瘤",
      (c) =>
        c.yes("headache_worst") ||
        c.yes("neck_stiff_h") ||
        c.yes("weak_focal") ||
        c.yes("confusion") ||
        c.yes("seizure") ||
        c.yes("fever") ||
        c.yes("anticoag") ||
        c.older,
    ),
    r(
      "ct_brain",
      "ask",
      "頭痛：無紅旗時，止痛後仍未改善再與 VS 討論",
      (c) =>
        !(
          c.yes("headache_worst") ||
          c.yes("neck_stiff_h") ||
          c.yes("weak_focal") ||
          c.yes("confusion") ||
          c.yes("seizure") ||
          c.yes("fever") ||
          c.yes("anticoag") ||
          c.older
        ),
    ),
    r(
      "cta_head_neck",
      "ask",
      "雷擊樣頭痛／疑 SAH：CT 後加做 aneurysm protocol → 與 VS 討論",
      (c) => c.yes("headache_worst"),
    ),
  ],

  focal_neuro: [
    r("cbc_dc", "core", "疑似中風：24 小時中風組套"),
    r("crea", "core", "疑似中風：中風組套"),
    r("na", "core", "疑似中風：中風組套"),
    r("k", "core", "疑似中風：中風組套"),
    r("glu", "core", "疑似中風：先排除低血糖"),
    r("onetouch", "core", "疑似中風：馬上測床邊血糖（護理師）"),
    r("alt", "core", "疑似中風：中風組套"),
    r("tbil", "core", "疑似中風：中風組套"),
    r("ck", "core", "疑似中風：中風組套"),
    r("trop" as PseudoId, "core", "疑似中風：中風組套"),
    r("crp", "core", "疑似中風：中風組套"),
    r("pt", "core", "疑似中風：凝血（溶栓／抗凝前）"),
    r("aptt", "core", "疑似中風：凝血（溶栓／抗凝前）"),
    r("ddimer", "core", "疑似中風：中風組套"),
    r("ecg", "core", "疑似中風：心房顫動"),
    r("cxr" as PseudoId, "core", "疑似中風：中風組套"),
    r("ct_brain", "core", "疑似中風：先排除出血（切 CT 前先問 VS）"),
    r("cta_head_neck", "core", "疑似中風：血管評估"),
    r("ct_perfusion", "plus", "疑似中風：發作 24 小時內，評估可挽救腦組織"),
    r("bun", "plus", "疑似中風：腎功能（顯影劑）"),
    r("ammonia", "plus", "疑似中風＋意識改變", (c) => c.yes("confusion")),
    r("mri_brain", "ask", "CT 陰性仍高度懷疑中風（後循環）→ 與 VS／神經科討論"),
  ],

  ams: [
    r("cbc_dc", "core", "意識改變：基本檢查"),
    r("bun", "core", "意識改變：尿毒"),
    r("crea", "core", "意識改變"),
    r("na", "core", "意識改變：低血鈉"),
    r("k", "core", "意識改變"),
    r("ca", "core", "意識改變：高血鈣"),
    r("mg", "core", "意識改變"),
    r("glu", "core", "意識改變：先排除低血糖"),
    r("onetouch", "core", "意識改變：馬上測床邊血糖（護理師）"),
    r("alt", "core", "意識改變：肝功能"),
    r("tbil", "core", "意識改變：肝功能"),
    r("ammonia", "core", "意識改變：肝腦病變"),
    r("lactate", "core", "意識改變：灌流"),
    r("pt", "core", "意識改變：凝血"),
    r("aptt", "core", "意識改變：凝血"),
    r("vbg", "core", "意識改變：酸鹼／CO2"),
    r("crp", "core", "意識改變：感染"),
    r("urine_routine", "core", "意識改變：泌尿道感染"),
    r("cxr" as PseudoId, "core", "意識改變：肺炎"),
    r("ecg", "core", "意識改變：心律不整"),
    r("ct_brain", "core", "意識改變：先排除出血／腦梗塞"),
    r("kub", "plus", "意識改變：找感染源／阻塞"),
    r("phos", "plus", "意識改變：電解質"),
    r("alb", "plus", "意識改變"),
    r("pct", "plus", "意識改變：感染"),
    r("urine_cx", "plus", "意識改變：泌尿道感染"),
    r("bcx", "plus", "意識改變＋發燒", (c) => c.yes("fever")),
    r("flu", "plus", "意識改變：流感／COVID", (c) => c.yes("fever") || c.yes("cough")),
    r(
      "covid_ag",
      "plus",
      "意識改變：流感／COVID",
      (c) => c.yes("fever") || c.yes("cough"),
    ),
    r(
      "trop" as PseudoId,
      "plus",
      "意識改變：年長或有風險，排除缺血",
      (c) => c.cardiacRisk,
    ),
    r("etoh", "plus", "意識改變：酒精"),
    r("urine_drug", "plus", "意識改變：找不到原因，驗尿液毒藥物"),
    r("tsh", "plus", "意識改變：甲狀腺"),
    r(
      "apap",
      "core",
      "意識改變＋自傷／過量／物質濫用：乙醯胺酚濃度",
      (c) => c.yes("self_harm") || c.yes("substance") || c.yes("si"),
    ),
    r(
      "salicylate",
      "core",
      "意識改變＋自傷／過量／物質濫用：水楊酸濃度",
      (c) => c.yes("self_harm") || c.yes("substance") || c.yes("si"),
    ),
    r(
      "apap",
      "ask",
      "意識改變：原因不明時考慮藥物濃度",
      (c) => !(c.yes("self_harm") || c.yes("substance") || c.yes("si")),
    ),
  ],

  seizure: [
    r("cbc_dc", "core", "抽搐：基本檢查"),
    r("na", "core", "抽搐：低血鈉"),
    r("k", "core", "抽搐"),
    r("crea", "core", "抽搐"),
    r("glu", "core", "抽搐：低血糖"),
    r("onetouch", "core", "抽搐：馬上測床邊血糖（護理師）"),
    r("ca_free", "core", "抽搐：離子鈣"),
    r("mg", "core", "抽搐"),
    r("phos", "plus", "抽搐"),
    r("ammonia", "core", "抽搐：肝腦病變"),
    r("lactate", "core", "抽搐：發作後乳酸"),
    r("vbg", "core", "抽搐：酸鹼"),
    r("ck", "plus", "抽搐：橫紋肌溶解"),
    r("ecg", "core", "抽搐：與暈厥鑑別"),
    r("alt", "plus", "抽搐"),
    r("urine_routine", "plus", "抽搐"),
    r("ct_brain", "core", "第一次抽搐：腦部 CT", (c) => !c.pmh.has("epilepsy")),
    r("ct_brain", "plus", "抽搐：有癲癇病史仍要排除新病灶", (c) =>
      c.pmh.has("epilepsy"),
    ),
    r("etoh", "plus", "抽搐：酒精"),
    r("urine_drug", "plus", "抽搐：毒藥物"),
    r("phenytoin", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
    r("valproate", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
    r("carbamazepine", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
  ],

  trauma: [
    r("cbc_dc", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("pt", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("aptt", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("crea", "plus", "外傷＋年長", (c) => c.older),
    r("glu", "plus", "外傷＋年長", (c) => c.older),
    r(
      "ecg",
      "core",
      "外傷前有暈厥：排除心因性",
      (c) => c.yes("syncope") || c.yes("presyncope"),
    ),
    r("ecg", "plus", "年長跌倒：排除心律不整", (c) => c.older),
    r("etoh", "plus", "車禍／被打：酒精濃度", (c) =>
      ["機車／車禍", "被打／攻擊"].includes(c.sel("mechanism")),
    ),
    r(
      "ct_brain",
      "core",
      "撞到頭＋失憶／意識喪失／抗凝血／年長：腦部 CT",
      (c) =>
        c.yes("head_strike") &&
        (c.yes("loc") || c.yes("amnesia") || c.yes("anticoag") || c.older),
    ),
    r(
      "ct_brain",
      "ask",
      "撞到頭：2 小時 GCS 未回到 15、顱骨骨折疑慮、局部神經症狀、抽搐時 → 與 VS 討論",
      (c) =>
        c.yes("head_strike") &&
        !(c.yes("loc") || c.yes("amnesia") || c.yes("anticoag") || c.older),
    ),
    r("cspine_xr", "plus", "頸／背痛：頸椎 X 光", (c) => c.yes("neck_back_pain")),
    r(
      "ct_cspine",
      "plus",
      "頸痛＋年長：頸椎 CT",
      (c) => c.yes("neck_back_pain") && c.older,
    ),
    r(
      "ct_cspine",
      "ask",
      "頸／背痛：高風險機轉或神經症狀 → 與 VS 討論",
      (c) => c.yes("neck_back_pain") && !c.older,
    ),
    r("cxr" as PseudoId, "plus", "胸部外傷", (c) =>
      /chest|rib|胸|肋/i.test(c.text("injury_site")),
    ),
    r("sono_fast", "plus", "腹部外傷：FAST", (c) =>
      /abd|belly|腹/i.test(c.text("injury_site")),
    ),
    r("ct_upper_abd", "ask", "腹部外傷：疑腹內出血 → 與 VS 討論", (c) =>
      /abd|belly|腹/i.test(c.text("injury_site")),
    ),
    r("pelvis_xr", "plus", "骨盆／髖部外傷", (c) =>
      /pelvi|hip|骨盆|髖/i.test(c.text("injury_site")),
    ),
    r("lspine_xr", "plus", "腰背外傷", (c) =>
      /lumbar|back|腰|背/i.test(c.text("injury_site")),
    ),
    r("skull_xr", "ask", "頭部外傷：顱骨 X 光（通常以 CT 取代）", (c) =>
      /head|skull|頭/i.test(c.text("injury_site")),
    ),
    r("sono_fb", "ask", "傷口異物疑慮：軟組織超音波", (c) => c.yes("wound")),
  ],

  back_pain: [
    r("urine_routine", "plus", "背／腰痛：泌尿道結石或感染"),
    r("cbc_dc", "plus", "背／腰痛"),
    r("crp", "plus", "背／腰痛"),
    r("crea", "plus", "背／腰痛：腎功能"),
    r(
      "cbc_dc",
      "core",
      "背痛＋發燒／癌症／免疫低下／體重減輕：排除感染或轉移",
      (c) =>
        c.yes("fever") ||
        c.pmh.has("cancer") ||
        c.pmh.has("immuno") ||
        c.yes("wt_loss"),
    ),
    r(
      "crp",
      "core",
      "背痛＋發燒／癌症／免疫低下／體重減輕：排除感染或轉移",
      (c) =>
        c.yes("fever") ||
        c.pmh.has("cancer") ||
        c.pmh.has("immuno") ||
        c.yes("wt_loss"),
    ),
    r("sono_aortic_renal", "plus", "年長背痛：腹主動脈瘤破裂／腎", (c) => c.midlife),
    r("ecg", "plus", "年長背痛：排除心肌梗塞", (c) => c.midlife),
    r("trop" as PseudoId, "plus", "年長背痛：排除心肌梗塞", (c) => c.midlife),
    r(
      "lspine_xr",
      "plus",
      "腰痛：腰椎 X 光（外傷或年長）",
      (c) => c.yes("neck_back_pain") || c.older,
    ),
    r(
      "ct_lspine",
      "ask",
      "背痛＋神經缺損／大小便障礙（馬尾症候群）：CT → 會診 NS＋緊急 MRI",
      (c) => c.yes("weak_focal") || c.yes("numb") || c.yes("retention"),
    ),
  ],

  limb: [
    r(
      "sono_dvt",
      "core",
      "肢體腫脹或小腿痛：排除深部靜脈栓塞",
      (c) => c.yes("calf_pain") || c.yes("swelling"),
    ),
    r(
      "ddimer",
      "plus",
      "肢體腫脹／小腿痛／久臥：排除 DVT",
      (c) => c.yes("calf_pain") || c.yes("swelling") || c.yes("immobil"),
    ),
    r(
      "cbc_dc",
      "core",
      "紅熱腫痛或發燒：蜂窩性組織炎",
      (c) => c.yes("redness") || c.yes("fever"),
    ),
    r(
      "crp",
      "core",
      "紅熱腫痛或發燒：蜂窩性組織炎",
      (c) => c.yes("redness") || c.yes("fever"),
    ),
    r("crea", "plus", "肢體疼痛腫脹：腎功能／橫紋肌"),
    r(
      "glu",
      "plus",
      "肢體紅熱：糖尿病控制",
      (c) => c.pmh.has("dm") || c.yes("redness"),
    ),
    r("ck", "plus", "肢體疼痛：橫紋肌溶解"),
    r(
      "lactate",
      "plus",
      "紅熱疼痛伴發燒：壞死性筋膜炎",
      (c) => c.yes("redness") && c.yes("fever"),
    ),
    r("bcx", "plus", "紅熱疼痛伴發燒", (c) => c.yes("redness") && c.yes("fever")),
    r(
      "doppler_limbs",
      "ask",
      "疑急性肢體缺血／DVT：下班時間先問放射科值班 → 與 VS 討論",
    ),
  ],

  skin_allergy: [
    r("cbc_dc", "plus", "皮疹＋發燒", (c) => c.yes("fever")),
    r("crp", "plus", "皮疹＋發燒或紅熱", (c) => c.yes("fever") || c.yes("redness")),
    r("alt", "plus", "皮疹＋新藥物：藥物疹／肝功能", (c) => c.yes("allergen")),
    r("crea", "plus", "皮疹＋新藥物：腎功能", (c) => c.yes("allergen")),
  ],

  bleeding: [
    r("cbc_dc", "core", "出血：血色素／血小板"),
    r("pt", "core", "出血：凝血"),
    r("aptt", "core", "出血：凝血"),
    r("crea", "plus", "出血：腎功能"),
    r("alt", "plus", "出血：肝功能"),
    r("fibrinogen", "plus", "出血：凝血"),
    r("na", "plus", "出血"),
    r("k", "plus", "出血"),
    r("glu", "plus", "出血"),
    r(
      "stool_ob",
      "plus",
      "出血：消化道出血",
      (c) => c.yes("melena") || c.yes("hematochezia"),
    ),
  ],

  psych: [
    r("cbc_dc", "core", "精神症狀：排除器質性原因"),
    r("na", "core", "精神症狀"),
    r("k", "core", "精神症狀"),
    r("crea", "core", "精神症狀"),
    r("glu", "core", "精神症狀：低血糖"),
    r("alt", "core", "精神症狀"),
    r("etoh", "core", "精神症狀：酒精"),
    r("urine_drug", "core", "精神症狀：毒藥物"),
    r("ecg", "core", "精神症狀：QT 間期"),
    r("urine_routine", "plus", "精神症狀：泌尿道感染"),
    r("crp", "plus", "精神症狀"),
    r("tsh", "plus", "精神症狀：甲狀腺"),
    r("cxr" as PseudoId, "plus", "精神症狀：常規篩檢"),
    r("apap", "core", "自傷／過量：乙醯胺酚濃度", (c) => c.yes("self_harm")),
    r("salicylate", "core", "自傷／過量：水楊酸濃度", (c) => c.yes("self_harm")),
    r("apap", "plus", "自殺意念：乙醯胺酚濃度", (c) => c.yes("si")),
    r("salicylate", "plus", "自殺意念：水楊酸濃度", (c) => c.yes("si")),
  ],
};

// ───────────── 全域規則（跨問題）─────────────

/** 這些問題在育齡女性身上，檢查前都需要排除懷孕。 */
const HCG_PROBLEMS: ReadonlySet<string> = new Set([
  "abd_pain",
  "nausea_vomiting",
  "urinary",
  "syncope",
  "dizziness",
  "back_pain",
  "ams",
  "seizure",
  "psych",
  "gi_bleed",
  "trauma",
]);

/** 含輻射的檢查：育齡女性要先驗孕（或簽拒絕驗孕同意書）。 */
const RADIATION_IDS: ReadonlySet<string> = new Set([
  "kub",
  "pelvis_xr",
  "lspine_xr",
  "cspine_xr",
  "ct_brain",
  "cta_head_neck",
  "ct_perfusion",
  "ct_chest",
  "ct_upper_abd",
  "ct_pelvis",
  "ct_cspine",
  "ct_lspine",
  "ct_face",
  "ct_neck",
]);

// ───────────── 建議結果 ─────────────

export interface OrderSuggestion {
  order: EdOrder;
  tier: OrderTier;
  /** 為什麼建議（去重後最多 3 條）。 */
  reasons: string[];
  /** 目前是否勾選（含使用者覆寫）。 */
  selected: boolean;
  /** 預設是否勾選（依層級）。 */
  defaultSelected: boolean;
}

export interface OrderPlan {
  suggestions: OrderSuggestion[];
  /** 最後要帶到 ERS 的項目（依畫面順序）。 */
  selected: EdOrder[];
  /** 不屬於檢查項目、但這些問題需要注意的提醒。 */
  notes: string[];
  /** 目錄中其他可手動加入的項目（未被建議）。 */
  extras: OrderSuggestion[];
}

function resolvePseudo(id: string, ctx: Ctx): string {
  if (id === "trop") {
    // 年輕且無風險 → hs-cTnT；其餘 → TnI（口袋書：年輕無共病可改 hs-TnT）
    return !ctx.cardiacRisk ? "hs_tnt" : "tni";
  }
  if (id === "cxr") {
    const needsPortable =
      ctx.problems.has("ams") ||
      ctx.problems.has("seizure") ||
      ctx.problems.has("trauma");
    return needsPortable ? "cxr_port" : "cxr_pa";
  }
  return id;
}

export function orderSelection(findings: EdFindings, id: string): boolean | undefined {
  const value = findings[edKey.order(id)];
  return value?.on === undefined ? undefined : value.on;
}

export function planOrders(findings: EdFindings, patient: EdPatientContext): OrderPlan {
  const ctx = buildContext(findings, patient);
  const problems = selectedProblems(findings);
  const merged = new Map<string, { tier: OrderTier; reasons: string[] }>();
  const add = (rawId: string, tier: OrderTier, why: string) => {
    const id = resolvePseudo(rawId, ctx);
    const current = merged.get(id);
    if (!current) {
      merged.set(id, { tier, reasons: [why] });
      return;
    }
    if (TIER_RANK[tier] > TIER_RANK[current.tier]) current.tier = tier;
    if (!current.reasons.includes(why)) current.reasons.push(why);
  };

  for (const problem of problems) {
    for (const rule of PROBLEM_RULES[problem.id] ?? []) {
      if (!rule.when || rule.when(ctx)) add(rule.id, rule.tier, rule.why);
    }
  }

  // 育齡女性：影像前驗孕（口袋書：育齡女性做影像前一定要驗 β-hCG）
  if (ctx.fertile && problems.length > 0 && !merged.has("bhcg")) {
    const relevantProblem = problems.some((problem) => HCG_PROBLEMS.has(problem.id));
    const hasRadiation = [...merged].some(
      ([id, entry]) => RADIATION_IDS.has(id) && entry.tier !== "ask",
    );
    if (relevantProblem || hasRadiation) {
      add("urine_hcg", "core", "育齡女性：檢查／影像前排除懷孕");
    }
  }

  const rank = (id: string) => ED_ORDER_GROUP_ORDER.indexOf(edOrder(id)?.group ?? "ct");
  const position = new Map(ED_ORDERS.map((order, index) => [order.id, index]));

  const suggestions: OrderSuggestion[] = [];
  for (const [id, entry] of merged) {
    const order = edOrder(id);
    if (!order) continue;
    const defaultSelected = entry.tier !== "ask";
    const override = orderSelection(findings, id);
    suggestions.push({
      order,
      tier: entry.tier,
      reasons: entry.reasons.slice(0, 3),
      selected: override ?? defaultSelected,
      defaultSelected,
    });
  }
  suggestions.sort(
    (a, b) =>
      rank(a.order.id) - rank(b.order.id) ||
      TIER_RANK[b.tier] - TIER_RANK[a.tier] ||
      (position.get(a.order.id) ?? 0) - (position.get(b.order.id) ?? 0),
  );

  const suggestedIds = new Set(suggestions.map((entry) => entry.order.id));
  const extras: OrderSuggestion[] = ED_ORDERS.filter(
    (order) => !suggestedIds.has(order.id),
  ).map((order) => ({
    order,
    tier: "ask" as const,
    reasons: [],
    selected: orderSelection(findings, order.id) === true,
    defaultSelected: false,
  }));

  const selected = [...suggestions, ...extras]
    .filter((entry) => entry.selected)
    .map((entry) => entry.order)
    .sort(
      (a, b) =>
        ED_ORDER_GROUP_ORDER.indexOf(a.group) - ED_ORDER_GROUP_ORDER.indexOf(b.group) ||
        (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
    );

  return {
    suggestions,
    selected,
    notes: planNotes(
      ctx,
      problems.map((p) => p.id),
      selected,
    ),
    extras,
  };
}

// ───────────── 提醒（不是檢查項目）─────────────

function planNotes(
  ctx: Ctx,
  problemIds: readonly string[],
  selected: readonly EdOrder[],
): string[] {
  const has = (id: string) => problemIds.includes(id);
  const picked = new Set(selected.map((order) => order.id));
  const notes: string[] = [];
  if (problemIds.length === 0) return notes;

  if (has("chest_pain"))
    notes.push(
      "胸痛：EKG 要在 10 分鐘內開單、判讀、發報告；STEMI 目標 D2B ≤ 90 分鐘。",
    );
  if (has("focal_neuro"))
    notes.push(
      "疑似中風：點 24 小時中風組套＋備血，急會診 Neuro（開會診單）、NIHSS；rt-PA 4.5 小時內、IA 24 小時內。",
    );
  if (has("gi_bleed"))
    notes.push(
      "消化道出血：備血請到「輸血作業」開立（需輸血同意書）；大量出血先告知 VS。",
    );
  if (has("gyn"))
    notes.push("婦科出血／下腹痛：Rh 血型與備血請到「輸血作業」；必要時盡早會診婦產。");
  if (has("trauma") || has("limb") || has("back_pain"))
    notes.push(
      "四肢／部位 X 光請依部位與側別另選（科常用 → 急診創傷 → Extremity），清單未預設，以免選錯側。",
    );
  if (has("trauma"))
    notes.push(
      "重大外傷（休克、高處墜落、多處嚴重傷）請啟動 Trauma team，改用 Major trauma 組套。",
    );
  if (has("eye") || has("ent"))
    notes.push(
      "眼科／耳鼻喉專科檢查（眼壓、裂隙燈、鼻咽內視鏡等）不在此建議，請依需要另開或會診。",
    );
  if (has("skin_allergy"))
    notes.push("過敏：以藥物處置為主（例如 Dexa＋CTM），多半不需要檢查。");
  if (ctx.fertile && [...picked].some((id) => RADIATION_IDS.has(id)))
    notes.push("育齡女性做輻射檢查前須驗孕，病人拒絕要簽拒絕驗孕同意書。");
  if (picked.has("bcx") || picked.has("vbg"))
    notes.push(
      "血液培養與 VBG 只有護理師抽血：請在第一次打 IV 時一併抽；單子夾板夾，不要給病人。",
    );
  if (picked.has("urine_cx"))
    notes.push(
      "尿液培養（ORDINARY CULTURE-A）加入時會跳出檢體視窗，請選 Urine（導尿檢體選 Urine (catheter)）。",
    );
  if (
    [...picked].some((id) =>
      [
        "ct_chest",
        "ct_upper_abd",
        "ct_pelvis",
        "cta_head_neck",
        "ct_perfusion",
      ].includes(id),
    )
  )
    notes.push("CT 若需顯影劑：確認腎功能與顯影劑同意書；危急可不等 Cr。");
  return notes;
}

// ───────────── 給測試用：規則完整性檢查 ─────────────

/** 規則實際會引用的所有項目 id（虛擬項目展開成可能的實際項目）。 */
export function referencedOrderIds(): string[] {
  const ids = new Set<string>(["urine_hcg"]);
  for (const rules of Object.values(PROBLEM_RULES)) {
    for (const rule of rules) {
      if (rule.id === "trop") {
        ids.add("tni");
        ids.add("hs_tnt");
      } else if (rule.id === "cxr") {
        ids.add("cxr_pa");
        ids.add("cxr_port");
      } else {
        ids.add(rule.id);
      }
    }
  }
  return [...ids];
}

/** 有定義規則的問題 id。 */
export function orderRuleProblemIds(): string[] {
  return Object.keys(PROBLEM_RULES);
}
