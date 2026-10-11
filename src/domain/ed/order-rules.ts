import {
  isFertilePatient,
  pmhPositiveIds,
  selectedProblems,
  type EdFindings,
  type EdPatientContext,
} from "./compose";
import { ED_ORDERS, ED_ORDER_GROUP_ORDER, edOrder, type EdOrder } from "./orders";
import { pickedOptions } from "./picks";
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

// 規則可引用「trop」「cxr」兩個虛擬項目，在 resolvePseudo 依情境換成實際項目。

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
  /** 未成年（< 18 歲）：CT 一律改為需討論。 */
  child: boolean;
  /** 有心血管相關病史（不含年齡）。 */
  cardiacHistory: boolean;
  /** 發燒但沒有咳嗽／喉嚨痛／流鼻水等明顯上呼吸道病灶。 */
  noUriFocus: boolean;
  /** 頭暈的危險因子：年長、血管風險病史或神經症狀。 */
  dizzyRisk: boolean;
  /** 頭痛紅旗：雷擊樣、頸僵硬、神經症狀、意識改變、抽搐、抗凝血、年長。 */
  headacheRedFlag: boolean;
  /** 懷疑肝膽：右上腹／上腹痛、黃疸／茶色尿、Murphy sign 陽性。 */
  hepatobiliary: boolean;
  /** 育齡女性且未明確否認懷孕：輻射 X 光先不勾，驗孕後再開。 */
  pregnancyNotExcluded: boolean;
  yes: (id: string) => boolean;
  /** 單／複選題目前選了哪些選項（中文標籤）。 */
  picks: (id: string) => string[];
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
  const yes = (id: string) => findings[edKey.history(id)]?.on === true;
  const abdSites = new Set(pickedOptions(findings, "abd_site"));
  const older = age !== null && age >= 65;
  const hasCardiacHistory = cardiacHistory.some((id) => pmh.has(id));
  return {
    problems,
    pmh,
    age,
    child: age !== null && age < 18,
    cardiacHistory: hasCardiacHistory,
    noUriFocus: !(yes("cough") || yes("sore_throat") || yes("rhinorrhea")),
    dizzyRisk:
      older ||
      ["htn", "dm", "af", "stroke", "cad"].some((id) => pmh.has(id)) ||
      yes("weak_focal") ||
      yes("gait") ||
      yes("vision") ||
      yes("headache"),
    headacheRedFlag:
      older ||
      yes("headache_worst") ||
      yes("neck_stiff_h") ||
      yes("weak_focal") ||
      yes("confusion") ||
      yes("seizure") ||
      yes("anticoag"),
    hepatobiliary:
      abdSites.has("右上腹") ||
      abdSites.has("上腹／心窩") ||
      yes("jaundice") ||
      findings[edKey.pe("abd_murphy")]?.sel === "abn",
    pregnancyNotExcluded:
      isFertilePatient(patient) &&
      findings[edKey.history("pregnancy_possible")]?.on !== false,
    female: patient.sex === "女 F",
    fertile: isFertilePatient(patient),
    older,
    midlife: age !== null && age >= 50,
    cardiacRisk: (age !== null && age >= 50) || hasCardiacHistory,
    vulnerable: ["cancer", "immuno", "ckd", "esrd", "cirrhosis", "dm"].some((id) =>
      pmh.has(id),
    ),
    yes,
    picks: (id) => pickedOptions(findings, id),
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
//
// 第一輪原則（使用者指定，依北榮急診 PGY 口袋書「抽血提醒」與各主訴章節）：
//   - 不預設開：血液培養（B/C）、各種培養、床邊超音波、血氣（VBG/ABG）、備血。
//     B/C、VBG、備血只有護理師抽，需要時打 IV 時再追加；這些項目仍在「其他常用檢查」可手動加入。
//   - 所有抽血的人：CBC/DC、Crea、Na、K、Glu、CRP；再依主訴加項（口袋書第 22 節）。
//   - 口袋書沒列的項目不隨便加；括號（±）項目只在情境成立時才出現。
// 性別年齡：驗孕只給 12–55 歲女性；「老人」條件用 ≥ 65 歲；未成年（< 18）的 CT 一律改為需討論。

const PROBLEM_RULES: Readonly<Record<string, readonly Rule[]>> = {
  fever: [
    ...basic("發燒：所有抽血的人"),
    r("alt", "core", "發燒：口袋書 3-5 類（ALT）"),
    r("cxr", "core", "發燒：口袋書 3-5 類（CXR）"),
    r("flu", "core", "發燒：口袋書 3-5 類（Flu Ag）"),
    r("covid_ag", "core", "發燒：COVID 快篩"),
    r(
      "ggt",
      "core",
      "沒有明顯病灶或高風險的發燒：口袋書加做 GGT／Tbil／U/R",
      (c) => c.noUriFocus || c.older || c.vulnerable,
    ),
    r(
      "tbil",
      "core",
      "沒有明顯病灶或高風險的發燒：口袋書加做 GGT／Tbil／U/R",
      (c) => c.noUriFocus || c.older || c.vulnerable,
    ),
    r(
      "urine_routine",
      "core",
      "沒有明顯病灶、高風險或有泌尿症狀的發燒：U/R",
      (c) =>
        c.noUriFocus ||
        c.older ||
        c.vulnerable ||
        c.yes("dysuria") ||
        c.yes("flank_pain") ||
        c.yes("frequency") ||
        c.yes("foley"),
    ),
    r("stool_routine", "plus", "發燒＋腹瀉：糞便常規", (c) => c.yes("diarrhea")),
  ],

  weakness: [
    ...basic("全身無力：所有抽血的人（年輕人多是低血鉀）"),
    r("alt", "plus", "全身無力：肝功能"),
    r(
      "ecg",
      "core",
      "年長或有心血管病史的無力：排除 AMI",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "core",
      "年長或有心血管病史的無力：排除 AMI",
      (c) => c.older || c.cardiacHistory,
    ),
    r("ck", "plus", "全身無力：橫紋肌／心肌", (c) => c.older || c.cardiacHistory),
    r("urine_routine", "plus", "年長無力：隱性泌尿道感染", (c) => c.older),
    r("cxr", "plus", "年長無力：隱性肺炎", (c) => c.older),
  ],

  bp_abnormal: [
    ...basic("血壓異常：所有抽血的人"),
    r("ecg", "core", "血壓異常：EKG"),
    r("trop", "plus", "血壓異常＋胸痛：排除心肌缺血", (c) => c.yes("chest_pain")),
    r(
      "cxr",
      "plus",
      "血壓偏高＋喘：肺水腫",
      (c) => c.sel("bp_type") === "偏高" && c.yes("dyspnea"),
    ),
  ],

  glucose: [
    r("glu", "core", "血糖異常"),
    r("na", "core", "血糖異常：電解質"),
    r("k", "core", "血糖異常：電解質"),
    r("crea", "core", "血糖異常：腎功能"),
    r("bun", "core", "血糖異常：腎功能"),
    r("ketone", "core", "高血糖：酮體", (c) => c.sel("glu_type") !== "偏低"),
    r(
      "urine_routine",
      "core",
      "高血糖：酮尿／感染",
      (c) => c.sel("glu_type") !== "偏低",
    ),
    r("cbc_dc", "plus", "血糖異常：找誘因"),
    r("crp", "plus", "血糖異常：找誘因"),
    r("ecg", "plus", "血糖異常：鉀離子影響"),
  ],

  lab_referral: [
    ...basic("檢驗異常／門診轉入：重新確認"),
    r("alt", "plus", "檢驗異常／門診轉入"),
  ],

  chest_pain: [
    ...basic("胸痛：所有抽血的人"),
    r("ck", "core", "胸痛：口袋書 3-5 類（CK）"),
    r("trop", "core", "胸痛：口袋書 3-5 類（TnI；年輕無共病改 hs-TnT）"),
    r("ecg", "core", "胸痛：10 分鐘內 EKG"),
    r("cxr", "core", "胸痛：口袋書 3-5 類（CXR）"),
    r(
      "ddimer",
      "plus",
      "胸痛＋肺栓塞危險因子（深呼吸痛、小腿痛／單側腫、久臥、咳血、喘）",
      (c) =>
        c.yes("pleuritic") ||
        c.yes("calf_pain") ||
        c.yes("immobil") ||
        c.yes("hemoptysis") ||
        c.yes("dyspnea"),
    ),
    r(
      "bnp",
      "plus",
      "胸痛＋喘／水腫／心衰",
      (c) => c.yes("dyspnea") || c.yes("leg_edema") || c.pmh.has("chf"),
    ),
    r(
      "ct_chest",
      "ask",
      "懷疑主動脈剝離／肺栓塞（背痛放射、血壓差、D-dimer 高）→ 與 VS 討論",
      (c) => c.yes("chest_radiate") || c.yes("pleuritic"),
    ),
  ],

  dyspnea: [
    ...basic("喘：所有抽血的人"),
    r("bnp", "core", "喘：口袋書 3-5 類（BNP）"),
    r("ck", "core", "喘：口袋書 3-5 類（CK）"),
    r("trop", "core", "喘：口袋書 3-5 類（TnI）"),
    r("ecg", "core", "喘：EKG"),
    r("cxr", "core", "喘：口袋書 3-5 類（CXR）"),
    r(
      "ddimer",
      "plus",
      "喘＋肺栓塞危險因子（Wells：小腿痛／單側腫、久臥、咳血、胸痛）",
      (c) =>
        c.yes("calf_pain") ||
        c.yes("immobil") ||
        c.yes("hemoptysis") ||
        c.yes("chest_pain"),
    ),
    r(
      "flu",
      "plus",
      "喘＋發燒或咳嗽：流感快篩",
      (c) => c.yes("fever") || c.yes("cough"),
    ),
    r(
      "covid_ag",
      "plus",
      "喘＋發燒或咳嗽：COVID 快篩",
      (c) => c.yes("fever") || c.yes("cough"),
    ),
    r("ct_chest", "ask", "喘：懷疑肺栓塞（Wells ≥ 4）或肺部病灶，需影像時與 VS 討論"),
  ],

  palpitation: [
    ...basic("心悸：所有抽血的人"),
    r("ecg", "core", "心悸：抓心律"),
    r("mg", "core", "心悸：鎂"),
    r(
      "trop",
      "plus",
      "心悸：年長或有心血管病史，排除缺血",
      (c) => c.older || c.cardiacHistory,
    ),
    r("tsh", "plus", "心悸：甲狀腺"),
    r("cxr", "plus", "心悸＋喘：胸部 X 光", (c) => c.yes("dyspnea")),
    r(
      "digoxin",
      "plus",
      "心悸＋心房顫動／心衰：藥物濃度",
      (c) => c.pmh.has("af") || c.pmh.has("chf"),
    ),
    r(
      "ddimer",
      "plus",
      "心悸＋喘或胸痛：肺栓塞",
      (c) => c.yes("dyspnea") || c.yes("chest_pain"),
    ),
  ],

  syncope: [
    ...basic("暈厥：所有抽血的人"),
    r("ecg", "core", "暈厥：EKG（有危險因子要留觀追 EKG／CK／TnI）"),
    r("ck", "core", "暈厥：口袋書（追 CK）"),
    r("trop", "core", "暈厥：口袋書（追 TnI）"),
    r(
      "ddimer",
      "plus",
      "暈厥＋喘／胸痛／水腫／久臥：肺栓塞",
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
    r(
      "cxr",
      "plus",
      "暈厥＋喘或胸痛：胸部 X 光",
      (c) => c.yes("dyspnea") || c.yes("chest_pain"),
    ),
    r("etoh", "plus", "暈厥＋飲酒", (c) => c.yes("alcohol")),
    r(
      "ct_brain",
      "plus",
      "暈厥＋抗凝血／頭部外傷／神經症狀：排除出血",
      (c) =>
        c.yes("anticoag") ||
        c.yes("head_strike") ||
        c.yes("weak_focal") ||
        c.yes("headache"),
    ),
    r(
      "ct_brain",
      "ask",
      "暈厥：無神經症狀時，是否做腦部 CT 由 VS 決定",
      (c) =>
        !(
          c.yes("anticoag") ||
          c.yes("head_strike") ||
          c.yes("weak_focal") ||
          c.yes("headache")
        ),
    ),
  ],

  cough_uri: [
    r("flu", "core", "咳嗽／上呼吸道感染：口袋書 3-5 類（Flu Ag）"),
    r("covid_ag", "core", "咳嗽／上呼吸道感染：COVID 快篩"),
    r("cxr", "core", "咳嗽／上呼吸道感染：口袋書 3-5 類（CXR）"),
    r(
      "cbc_dc",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r(
      "na",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r(
      "k",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r(
      "crea",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r(
      "glu",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r(
      "crp",
      "plus",
      "咳嗽＋發燒、年長或共病：所有抽血的人",
      (c) => c.yes("fever") || c.older || c.vulnerable,
    ),
    r("alt", "plus", "咳嗽＋發燒：口袋書 3-5 類（ALT）", (c) => c.yes("fever")),
    r(
      "ddimer",
      "plus",
      "咳嗽＋咳血或久臥：肺栓塞",
      (c) => c.yes("hemoptysis") || c.yes("immobil"),
    ),
  ],

  ent: [
    r("cbc_dc", "plus", "耳鼻喉＋發燒", (c) => c.yes("fever")),
    r("crp", "plus", "耳鼻喉＋發燒", (c) => c.yes("fever")),
    r("flu", "plus", "喉嚨痛：流感快篩", (c) => c.yes("sore_throat")),
    r("covid_ag", "plus", "喉嚨痛：COVID 快篩", (c) => c.yes("sore_throat")),
    r("cbc_dc", "plus", "流鼻血：血色素", (c) => c.yes("epistaxis")),
    r("pt", "plus", "流鼻血：凝血", (c) => c.yes("epistaxis")),
    r("aptt", "plus", "流鼻血：凝血", (c) => c.yes("epistaxis")),
    r(
      "neck_soft_xr",
      "plus",
      "吞嚥困難／異物感：頸部軟組織 X 光（口袋書：魚刺先照）",
      (c) => c.yes("dysphagia"),
    ),
    r(
      "ct_neck",
      "ask",
      "懷疑深頸部感染或深部異物：與 VS／ENT 討論",
      (c) => c.yes("dysphagia") || c.yes("fever"),
    ),
  ],

  eye: [],

  abd_pain: [
    ...basic("腹痛：所有抽血的人"),
    r("alt", "core", "腹痛：口袋書 3-5 類（ALT）"),
    r("ggt", "core", "腹痛：口袋書 3-5 類（GGT）"),
    r("tbil", "core", "腹痛：口袋書 3-5 類（Tbil）"),
    r("lipase", "core", "腹痛：口袋書 3-5 類（Lipase）"),
    r("urine_routine", "core", "腹痛：口袋書 3-5 類（U/R）"),
    r("cxr", "core", "腹痛：口袋書（CXR，單子註明站立，看橫膈下游離氣體）"),
    r("kub", "core", "腹痛：口袋書 3-5 類（KUB）"),
    r(
      "dbil",
      "core",
      "懷疑肝膽：右上腹／上腹痛、黃疸或 Murphy",
      (c) => c.hepatobiliary,
    ),
    r("alp", "core", "懷疑肝膽：右上腹／上腹痛、黃疸或 Murphy", (c) => c.hepatobiliary),
    r(
      "ck",
      "core",
      "老人／有心血管病史的上腹痛：口袋書（CK＋TnI）",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "core",
      "老人／有心血管病史的上腹痛：口袋書（CK＋TnI）",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "ecg",
      "plus",
      "老人／有心血管病史的上腹痛：排除心肌梗塞",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "pt",
      "plus",
      "腹痛＋抗凝血藥或肝硬化",
      (c) => c.yes("anticoag") || c.pmh.has("cirrhosis"),
    ),
    r(
      "aptt",
      "plus",
      "腹痛＋抗凝血藥或肝硬化",
      (c) => c.yes("anticoag") || c.pmh.has("cirrhosis"),
    ),
    r("ct_upper_abd", "ask", "腹痛：腹膜徵象、年長或懷疑穿孔／阻塞／缺血 → 與 VS 討論"),
    r("ct_pelvis", "ask", "腹痛：下腹痛／懷疑闌尾炎或卵巢病變 → 與 VS 討論"),
  ],

  nausea_vomiting: [
    ...basic("噁心嘔吐：所有抽血的人"),
    r("alt", "core", "噁心嘔吐：肝功能"),
    r("lipase", "core", "噁心嘔吐：胰臟"),
    r("urine_routine", "core", "噁心嘔吐：酮尿／泌尿道"),
    r("bun", "plus", "噁心嘔吐：脫水"),
    r("ketone", "plus", "噁心嘔吐＋糖尿病：酮體", (c) => c.pmh.has("dm")),
    r("kub", "core", "噁心嘔吐：肚子問題一律 KUB（腸阻塞）"),
    r("cxr", "plus", "噁心嘔吐＋腹痛：橫膈下游離氣體", (c) => c.yes("abd_pain")),
    r(
      "ecg",
      "plus",
      "噁心嘔吐：老人或有心血管病史，排除心肌梗塞",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "plus",
      "噁心嘔吐：老人或有心血管病史，排除心肌梗塞",
      (c) => c.older || c.cardiacHistory,
    ),
    r("etoh", "plus", "噁心嘔吐＋飲酒", (c) => c.yes("alcohol")),
    r(
      "ct_brain",
      "ask",
      "噁心嘔吐＋頭痛／神經症狀",
      (c) => c.yes("headache") || c.yes("weak_focal"),
    ),
  ],

  diarrhea: [
    ...basic("腹瀉：所有抽血的人"),
    r("stool_routine", "core", "腹瀉：糞便常規"),
    r("bun", "plus", "腹瀉：脫水"),
    r("stool_ob", "plus", "腹瀉＋血便：潛血", (c) => c.yes("hematochezia")),
    r("urine_routine", "plus", "腹瀉＋發燒：找其他感染源", (c) => c.yes("fever")),
    r("kub", "plus", "腹瀉：肚子問題一律 KUB（排除阻塞）"),
  ],

  constipation_bloating: [
    ...basic("便秘腹脹：所有抽血的人", "plus"),
    r("kub", "core", "便秘／腹脹：KUB"),
    r("alt", "plus", "便秘／腹脹"),
    r("lipase", "plus", "便秘／腹脹"),
    r("ca", "plus", "便秘：高血鈣"),
    r(
      "stool_ob",
      "plus",
      "便秘／腹脹：潛血",
      (c) => c.yes("melena") || c.yes("hematochezia"),
    ),
    r("cxr", "plus", "腹脹：橫膈下游離氣體", (c) => c.yes("abd_pain")),
    r("ct_upper_abd", "ask", "無排氣排便／懷疑阻塞 → 與 VS 討論", (c) =>
      c.yes("no_flatus"),
    ),
    r("ct_pelvis", "ask", "無排氣排便／懷疑阻塞 → 與 VS 討論", (c) =>
      c.yes("no_flatus"),
    ),
  ],

  gi_bleed: [
    ...basic("消化道出血：所有抽血的人"),
    r("pt", "core", "消化道出血：口袋書 3-5 類（PT/APTT）"),
    r("aptt", "core", "消化道出血：口袋書 3-5 類（PT/APTT）"),
    r("stool_ob", "core", "消化道出血：口袋書 3-5 類（S/OB）"),
    r("cxr", "core", "消化道出血：口袋書 3-5 類（CXR）"),
    r("kub", "core", "消化道出血：口袋書 3-5 類（KUB）"),
    r("alt", "core", "消化道出血：口袋書 3-5 類（±ALT）"),
    r("tbil", "core", "消化道出血：口袋書 3-5 類（±Tbil）"),
    r("bun", "core", "消化道出血：BUN/Cr 比"),
    r("gastric_ob", "plus", "吐血：胃液潛血", (c) => c.yes("hematemesis")),
    r(
      "ecg",
      "plus",
      "消化道出血：老人或有心血管病史（貧血相關缺血）",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "plus",
      "消化道出血：老人或有心血管病史（貧血相關缺血）",
      (c) => c.older || c.cardiacHistory,
    ),
    r("ct_upper_abd", "ask", "血流動力不穩或找不到出血點：CTA → 與 VS 討論"),
  ],

  jaundice: [
    ...basic("黃疸：所有抽血的人"),
    r("alt", "core", "黃疸：肝功能"),
    r("tbil", "core", "黃疸：膽紅素"),
    r("dbil", "core", "黃疸：直接膽紅素"),
    r("ggt", "core", "黃疸：膽道"),
    r("alp", "core", "黃疸：膽道"),
    r("pt", "core", "黃疸：凝血"),
    r("aptt", "core", "黃疸：凝血"),
    r("lipase", "core", "黃疸：胰臟"),
    r("urine_routine", "core", "黃疸：尿膽紅素"),
    r("ammonia", "plus", "黃疸＋意識混亂：肝腦病變", (c) => c.yes("confusion")),
    r("ct_upper_abd", "ask", "黃疸：影像確認膽道／腫瘤 → 與 VS 討論"),
  ],

  urinary: [
    r("urine_routine", "core", "泌尿症狀：U/R"),
    r(
      "cbc_dc",
      "core",
      "泌尿症狀（發燒／腰痛／血尿／年長）：所有抽血的人",
      (c) => c.yes("fever") || c.yes("flank_pain") || c.yes("hematuria") || c.older,
    ),
    r("crea", "core", "泌尿症狀：腎功能"),
    r("bun", "core", "泌尿症狀：腎功能"),
    r(
      "na",
      "plus",
      "泌尿症狀（發燒／腰痛／血尿／年長）：所有抽血的人",
      (c) => c.yes("fever") || c.yes("flank_pain") || c.yes("hematuria") || c.older,
    ),
    r(
      "k",
      "plus",
      "泌尿症狀（發燒／腰痛／血尿／年長）：所有抽血的人",
      (c) => c.yes("fever") || c.yes("flank_pain") || c.yes("hematuria") || c.older,
    ),
    r(
      "glu",
      "plus",
      "泌尿症狀（發燒／腰痛／血尿／年長）：所有抽血的人",
      (c) => c.yes("fever") || c.yes("flank_pain") || c.yes("hematuria") || c.older,
    ),
    r(
      "crp",
      "plus",
      "泌尿症狀（發燒／腰痛／血尿／年長）：所有抽血的人",
      (c) => c.yes("fever") || c.yes("flank_pain") || c.yes("hematuria") || c.older,
    ),
    r(
      "kub",
      "plus",
      "腰痛／血尿：泌尿道結石",
      (c) => c.yes("flank_pain") || c.yes("hematuria"),
    ),
    r("ct_upper_abd", "ask", "疑似結石／腎盂腎炎併發症 → 與 VS 討論", (c) =>
      c.yes("flank_pain"),
    ),
    r("ct_pelvis", "ask", "疑似結石 → 與 VS 討論", (c) => c.yes("flank_pain")),
  ],

  gyn: [
    r("bhcg", "core", "陰道出血／婦科下腹痛（育齡）：抽血 β-hCG", (c) => c.fertile),
    r("cbc_dc", "core", "陰道出血／婦科下腹痛：血色素"),
    r("urine_routine", "core", "陰道出血／婦科下腹痛：U/R"),
    r("pt", "plus", "陰道出血：凝血", (c) => c.yes("vag_bleed")),
    r("aptt", "plus", "陰道出血：凝血", (c) => c.yes("vag_bleed")),
    r("crea", "plus", "婦科下腹痛：腎功能"),
    r("crp", "plus", "婦科下腹痛＋發燒：發炎指標", (c) => c.yes("fever")),
  ],

  dizziness: [
    ...basic("頭暈：所有抽血的人"),
    r("alt", "core", "頭暈：口袋書 3-5 類（ALT）"),
    r("ca", "core", "頭暈：口袋書 3-5 類（Ca）"),
    r("ck", "core", "頭暈：口袋書 3-5 類（CK）"),
    r("ecg", "core", "頭暈：口袋書 3-5 類（EKG）"),
    r("cxr", "core", "頭暈：口袋書 3-5 類（CXR）"),
    r(
      "trop",
      "plus",
      "頭暈：口袋書 3-5 類（±TnI；年長或有心血管病史）",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "urine_routine",
      "plus",
      "頭暈：口袋書 3-5 類（±U/R）",
      (c) => c.older || c.yes("dysuria"),
    ),
    r(
      "digoxin",
      "plus",
      "頭暈＋心房顫動／心衰：藥物濃度（口袋書：心跳慢驗 digoxin）",
      (c) => c.pmh.has("af") || c.pmh.has("chf"),
    ),
    r(
      "ct_brain",
      "plus",
      "頭暈＋年長／血管風險／神經症狀：口袋書（有危險因子考慮 Brain CT）",
      (c) => c.dizzyRisk,
    ),
    r(
      "ct_brain",
      "ask",
      "頭暈：沒有危險因子時，口袋書建議觀察；需要時與 VS 討論",
      (c) => !c.dizzyRisk,
    ),
    r(
      "mri_brain",
      "ask",
      "頭暈：懷疑後循環中風、CT 陰性仍高度懷疑 → 與 VS／神經科討論",
    ),
  ],

  headache: [
    r(
      "ct_brain",
      "core",
      "頭痛紅旗（雷擊樣／頸僵硬／神經症狀／意識／抽搐／抗凝血／年長）：口袋書（Brain CT）",
      (c) => c.headacheRedFlag,
    ),
    r(
      "ct_brain",
      "ask",
      "頭痛：口袋書—先止痛，1 小時後沒改善或有腦膜徵象再做 Brain CT",
      (c) => !c.headacheRedFlag,
    ),
    r(
      "cbc_dc",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎（培養與 LP 與 VS 討論）",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r(
      "crp",
      "core",
      "頭痛＋發燒＋頸僵硬：腦膜炎",
      (c) => c.yes("fever") && c.yes("neck_stiff_h"),
    ),
    r("pt", "plus", "頭痛＋抗凝血藥", (c) => c.yes("anticoag")),
    r("aptt", "plus", "頭痛＋抗凝血藥", (c) => c.yes("anticoag")),
    r(
      "cta_head_neck",
      "ask",
      "雷擊樣頭痛／疑 SAH：CT 後加做 aneurysm protocol → 與 VS 討論",
      (c) => c.yes("headache_worst"),
    ),
  ],

  focal_neuro: [
    // 24 小時中風組套（科常用 → 急診醫學 → 急性腦中風組套）＋口袋書：one touch、NH3
    r("cbc_dc", "core", "疑似中風：24 小時中風組套"),
    r("crea", "core", "疑似中風：24 小時中風組套"),
    r("na", "core", "疑似中風：24 小時中風組套"),
    r("k", "core", "疑似中風：24 小時中風組套"),
    r("alt", "core", "疑似中風：24 小時中風組套"),
    r("tbil", "core", "疑似中風：24 小時中風組套"),
    r("ck", "core", "疑似中風：24 小時中風組套"),
    r("trop", "core", "疑似中風：24 小時中風組套"),
    r("crp", "core", "疑似中風：24 小時中風組套／口袋書"),
    r("glu", "core", "疑似中風：先排除低血糖"),
    r("pt", "core", "疑似中風：凝血（溶栓／抗凝前）"),
    r("aptt", "core", "疑似中風：凝血（溶栓／抗凝前）"),
    r("ddimer", "core", "疑似中風：24 小時中風組套"),
    r("ammonia", "core", "疑似中風：口袋書（NH3）"),
    r("ecg", "core", "疑似中風：心房顫動"),
    r("cxr", "core", "疑似中風：24 小時中風組套"),
    r("ct_brain", "core", "疑似中風：先排除出血（切 CT 前先問 VS）"),
    r("cta_head_neck", "plus", "疑似中風：24 小時中風組套（血管評估）"),
    r(
      "ct_perfusion",
      "ask",
      "疑似中風：發作 24 小時內，評估可挽救腦組織 → 與 VS／神經科討論",
    ),
    r("mri_brain", "ask", "CT 陰性仍高度懷疑中風（後循環）→ 與 VS／神經科討論"),
  ],

  ams: [
    // 口袋書 3-5 類 AMS（不含 VBG、B/C，第一輪不開）
    r("cbc_dc", "core", "意識改變：所有抽血的人"),
    r("na", "core", "意識改變：所有抽血的人"),
    r("k", "core", "意識改變：所有抽血的人"),
    r("crea", "core", "意識改變：所有抽血的人"),
    r("glu", "core", "意識改變：先排除低血糖"),
    r("crp", "core", "意識改變：所有抽血的人"),
    r("bun", "core", "意識改變：口袋書 3-5 類（BUN）"),
    r("alt", "core", "意識改變：口袋書 3-5 類（ALT）"),
    r("tbil", "core", "意識改變：口袋書 3-5 類（Tbil）"),
    r("ammonia", "core", "意識改變：口袋書 3-5 類（NH3）"),
    r("ca", "core", "意識改變：口袋書 3-5 類（Ca）"),
    r("mg", "core", "意識改變：口袋書 3-5 類（Mg）"),
    r("lactate", "core", "意識改變：口袋書 3-5 類（lactate）"),
    r("pt", "core", "意識改變：口袋書 3-5 類（PT/APTT）"),
    r("aptt", "core", "意識改變：口袋書 3-5 類（PT/APTT）"),
    r("cxr", "core", "意識改變：口袋書 3-5 類（CXR）"),
    r("kub", "core", "意識改變：口袋書 3-5 類（KUB）"),
    r("urine_routine", "core", "意識改變：口袋書 3-5 類（U/R）"),
    r("flu", "core", "意識改變：口袋書 3-5 類（COVID/Flu Ag）"),
    r("covid_ag", "core", "意識改變：口袋書 3-5 類（COVID/Flu Ag）"),
    r("ct_brain", "core", "意識改變：口袋書 3-5 類（Brain CT）"),
    r(
      "ecg",
      "plus",
      "意識改變：老人或有心血管病史，排除心律不整／缺血",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "plus",
      "意識改變：老人或有心血管病史",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "etoh",
      "plus",
      "意識改變：酒精（口袋書：原因不明考慮毒藥物）",
      (c) => c.yes("alcohol") || c.yes("substance"),
    ),
    r(
      "urine_drug",
      "plus",
      "意識改變：找不到原因，驗尿液毒藥物（口袋書）",
      (c) => c.yes("substance") || c.yes("self_harm") || c.yes("si"),
    ),
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
  ],

  seizure: [
    // 口袋書：第一次發作 CBC/DC、e-、NH3、Glu、Lactate、iCa、Brain CT、藥物濃度（VBG 第一輪不開）
    r("cbc_dc", "core", "抽搐：口袋書（CBC/DC）"),
    r("na", "core", "抽搐：口袋書（電解質）"),
    r("k", "core", "抽搐：口袋書（電解質）"),
    r("crea", "core", "抽搐：腎功能"),
    r("glu", "core", "抽搐：口袋書（Glu）"),
    r("ammonia", "core", "抽搐：口袋書（NH3）"),
    r("lactate", "core", "抽搐：口袋書（Lactate）"),
    r("ca_free", "core", "抽搐：口袋書（iCa）"),
    r("mg", "core", "抽搐：電解質"),
    r("ecg", "core", "抽搐：與暈厥鑑別"),
    r(
      "ct_brain",
      "core",
      "第一次抽搐：口袋書（Brain CT）",
      (c) => !c.pmh.has("epilepsy"),
    ),
    r("ct_brain", "plus", "抽搐：有癲癇病史仍要排除新病灶", (c) =>
      c.pmh.has("epilepsy"),
    ),
    r("phenytoin", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
    r("valproate", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
    r("carbamazepine", "plus", "癲癇病史：藥物濃度", (c) => c.pmh.has("epilepsy")),
    r("ck", "plus", "抽搐：橫紋肌溶解（發作時間長）"),
    r("etoh", "plus", "抽搐＋飲酒", (c) => c.yes("alcohol")),
    r("urine_drug", "plus", "抽搐＋物質濫用", (c) => c.yes("substance")),
  ],

  trauma: [
    r("cbc_dc", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("pt", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("aptt", "plus", "外傷＋年長／抗凝血", (c) => c.older || c.yes("anticoag")),
    r("crea", "plus", "外傷＋年長", (c) => c.older),
    r(
      "ecg",
      "core",
      "外傷前有暈厥：排除心因性",
      (c) => c.yes("syncope") || c.yes("presyncope"),
    ),
    r("ecg", "plus", "年長跌倒：排除心律不整", (c) => c.older),
    r("etoh", "plus", "車禍／被打：酒精濃度（口袋書：車禍驗 alcohol）", (c) =>
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
    r("cxr", "plus", "胸部外傷", (c) => /chest|rib|胸|肋/i.test(c.text("injury_site"))),
    r("ct_upper_abd", "ask", "腹部外傷：疑腹內出血 → 與 VS 討論", (c) =>
      /abd|belly|腹/i.test(c.text("injury_site")),
    ),
    r("pelvis_xr", "plus", "骨盆／髖部外傷", (c) =>
      /pelvi|hip|骨盆|髖/i.test(c.text("injury_site")),
    ),
    r("lspine_xr", "plus", "腰背外傷", (c) =>
      /lumbar|back|腰|背/i.test(c.text("injury_site")),
    ),
  ],

  back_pain: [
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
    r(
      "urine_routine",
      "plus",
      "腰痛＋泌尿症狀：結石或感染",
      (c) => c.yes("dysuria") || c.yes("hematuria") || c.yes("flank_pain"),
    ),
    r(
      "crea",
      "plus",
      "腰痛＋泌尿症狀：腎功能",
      (c) => c.yes("hematuria") || c.yes("flank_pain"),
    ),
    r(
      "ecg",
      "plus",
      "背痛＋年長或有心血管病史：排除心肌梗塞／主動脈疾病",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "trop",
      "plus",
      "背痛＋年長或有心血管病史：排除心肌梗塞",
      (c) => c.older || c.cardiacHistory,
    ),
    r(
      "lspine_xr",
      "plus",
      "腰痛：腰椎 X 光（外傷或年長）",
      (c) => c.yes("neck_back_pain") || c.older,
    ),
    r(
      "ct_lspine",
      "ask",
      "背痛＋神經缺損／大小便障礙（馬尾症候群）：CT → 會診 NS＋緊急 MRI（口袋書）",
      (c) => c.yes("weak_focal") || c.yes("numb") || c.yes("retention"),
    ),
  ],

  limb: [
    // 口袋書 3-5 類 Edema：albumin、BNP、Tbil、(D-dimer)、U/R、EKG、CXR
    r("alb", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) => c.yes("leg_edema")),
    r("bnp", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) => c.yes("leg_edema")),
    r("tbil", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) => c.yes("leg_edema")),
    r("urine_routine", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) =>
      c.yes("leg_edema"),
    ),
    r("ecg", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) => c.yes("leg_edema")),
    r("cxr", "core", "下肢水腫：口袋書 3-5 類（Edema）", (c) => c.yes("leg_edema")),
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
    r(
      "crea",
      "plus",
      "紅熱腫痛或發燒：腎功能",
      (c) => c.yes("redness") || c.yes("fever"),
    ),
    r(
      "glu",
      "plus",
      "肢體紅熱＋糖尿病：血糖控制",
      (c) => c.yes("redness") && c.pmh.has("dm"),
    ),
    r(
      "ddimer",
      "core",
      "懷疑 DVT／PE（單側腫、小腿痛、久臥）：口袋書（D-dimer）",
      (c) =>
        c.yes("calf_pain") ||
        c.yes("immobil") ||
        (c.yes("swelling") && !c.yes("leg_edema")),
    ),
    r("ck", "plus", "肢體疼痛＋可能橫紋肌溶解：CK", (c) => c.yes("immobil")),
    r(
      "doppler_limbs",
      "ask",
      "疑 DVT／急性肢體缺血：上班時間排 Doppler，下班打放射科值班 → 與 VS 討論",
      (c) => c.yes("calf_pain") || c.yes("swelling"),
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
    r("crea", "plus", "出血：腎功能", (c) => c.yes("anticoag") || c.older),
    r(
      "stool_ob",
      "plus",
      "出血：消化道出血",
      (c) => c.yes("melena") || c.yes("hematochezia"),
    ),
  ],

  psych: [
    // 口袋書 3-5 類 PSY：ALT、U/R、CXR、EKG（常客或最近才來過不一定要）
    ...basic("精神症狀：所有抽血的人（排除器質性原因）"),
    r("alt", "core", "精神症狀：口袋書 3-5 類（ALT）"),
    r("urine_routine", "core", "精神症狀：口袋書 3-5 類（U/R）"),
    r("cxr", "core", "精神症狀：口袋書 3-5 類（CXR）"),
    r("ecg", "core", "精神症狀：口袋書 3-5 類（EKG）"),
    r(
      "etoh",
      "plus",
      "精神症狀＋飲酒／物質：酒精濃度",
      (c) => c.yes("alcohol") || c.yes("substance"),
    ),
    r("urine_drug", "plus", "精神症狀＋物質濫用：毒藥物", (c) => c.yes("substance")),
    r("apap", "core", "自傷／過量：乙醯胺酚濃度", (c) => c.yes("self_harm")),
    r("salicylate", "core", "自傷／過量：水楊酸濃度", (c) => c.yes("self_harm")),
    r("apap", "plus", "自殺意念：乙醯胺酚濃度", (c) => c.yes("si")),
    r("salicylate", "plus", "自殺意念：水楊酸濃度", (c) => c.yes("si")),
  ],

  // ───────────── 第四輪新增的問題 ─────────────

  edema: [
    r("cbc_dc", "core", "水腫：貧血／感染"),
    r("crea", "core", "水腫：腎功能"),
    r("bun", "core", "水腫：腎功能"),
    r("na", "core", "水腫：電解質"),
    r("k", "core", "水腫：電解質"),
    r("alb", "core", "水腫：低白蛋白"),
    r("alt", "plus", "水腫：肝功能（肝硬化／心衰竭鬱血）"),
    r("urine_routine", "core", "水腫：蛋白尿（腎病症候群）"),
    r(
      "bnp",
      "core",
      "水腫＋喘／端坐呼吸／心衰竭病史或年長：心衰竭",
      (c) => c.yes("dyspnea") || c.yes("orthopnea") || c.pmh.has("chf") || c.older,
    ),
    r(
      "ecg",
      "plus",
      "水腫＋喘或心血管風險：心律與缺血",
      (c) => c.yes("dyspnea") || c.cardiacRisk,
    ),
    r(
      "cxr",
      "plus",
      "水腫＋喘：肺水腫／肋膜積水",
      (c) => c.yes("dyspnea") || c.yes("orthopnea"),
    ),
    r("ddimer", "plus", "單側腿腫或小腿痛：DVT", (c) => c.yes("calf_pain")),
    r("doppler_limbs", "ask", "單側腿腫或小腿痛：下肢血管超音波", (c) =>
      c.yes("calf_pain"),
    ),
  ],

  poor_intake: [
    r("cbc_dc", "core", "進食差：感染／貧血"),
    r("crea", "core", "進食差：脫水與腎功能"),
    r("bun", "core", "進食差：脫水"),
    r("na", "core", "進食差：電解質"),
    r("k", "core", "進食差：電解質"),
    r("glu", "core", "進食差：血糖"),
    r("crp", "core", "進食差：找感染"),
    r("urine_routine", "core", "進食差：尿路感染／酮體"),
    r("ca", "plus", "進食差：高血鈣也會吃不下"),
    r("alt", "plus", "進食差：肝功能"),
    r("ecg", "plus", "進食差：年長或電解質異常的心律", (c) => c.older),
  ],

  env_injury: [
    ...basic("環境傷害：所有抽血的人"),
    r("ck", "core", "環境傷害：橫紋肌溶解"),
    r("ecg", "core", "環境傷害：心律（低體溫 J wave、電擊、CO）"),
    r("tni", "plus", "環境傷害：心肌傷害（電擊、CO 中毒）"),
    r("alt", "plus", "中暑：肝功能"),
    r("ast", "plus", "中暑：肝功能"),
    r("bun", "plus", "環境傷害：腎功能"),
    r("urine_routine", "plus", "環境傷害：肌紅蛋白尿／腎損傷"),
    r("lactate", "plus", "環境傷害：組織灌流"),
    r("etoh", "plus", "低體溫或意識改變：是否合併酒精"),
    r("cxr", "plus", "溺水／煙霧吸入：肺炎、肺水腫", (c) =>
      c.picks("env_type").some((p) => p === "溺水" || p === "毒氣／煙霧"),
    ),
    r(
      "ct_brain",
      "ask",
      "意識改變：先排除頭部問題",
      (c) => c.yes("confusion") || c.yes("loc"),
    ),
  ],

  hemoptysis: [
    ...basic("咳血：所有抽血的人"),
    r("pt", "core", "咳血：凝血功能"),
    r("aptt", "core", "咳血：凝血功能"),
    r("cxr", "core", "咳血：胸部 X 光"),
    r(
      "ecg",
      "plus",
      "咳血＋胸痛或喘：排除心臟因素",
      (c) => c.yes("chest_pain") || c.yes("dyspnea"),
    ),
    r(
      "ddimer",
      "plus",
      "咳血＋久臥／小腿腫痛：肺栓塞",
      (c) => c.yes("immobil") || c.yes("calf_pain"),
    ),
    r("ct_chest", "ask", "咳血：胸部 CT（大量或 CXR 無法解釋時）"),
  ],

  wheeze: [
    r("cbc_dc", "core", "喘鳴：感染／嗜伊紅"),
    r("k", "core", "喘鳴：β 作用劑會降血鉀"),
    r("na", "core", "喘鳴：電解質"),
    r("crea", "core", "喘鳴：腎功能"),
    r("glu", "plus", "喘鳴：類固醇前後的血糖"),
    r(
      "crp",
      "plus",
      "喘鳴＋發燒或有痰：感染誘發",
      (c) => c.yes("fever") || c.yes("sputum"),
    ),
    r("cxr", "core", "喘鳴：氣胸、肺炎、肺水腫"),
    r("ecg", "core", "喘鳴：心因性喘（心律不整、缺血）", (c) => c.cardiacRisk),
    r("ecg", "plus", "喘鳴：心因性喘"),
    r(
      "bnp",
      "plus",
      "喘鳴＋水腫或心血管病史：分辨心因性",
      (c) => c.yes("leg_edema") || c.cardiacHistory || c.older,
    ),
    r("trop", "plus", "喘鳴＋心血管風險：心肌缺血", (c) => c.cardiacRisk),
    r(
      "ddimer",
      "plus",
      "喘鳴＋久臥／小腿腫痛：肺栓塞",
      (c) => c.yes("calf_pain") || c.yes("immobil"),
    ),
    r(
      "flu",
      "core",
      "喘鳴＋發燒或接觸史：Flu Ag",
      (c) => c.yes("fever") || c.yes("sick_contact"),
    ),
    r(
      "covid_ag",
      "core",
      "喘鳴＋發燒或接觸史：COVID 快篩",
      (c) => c.yes("fever") || c.yes("sick_contact"),
    ),
  ],

  reflux: [
    r("ecg", "core", "胃痛／火燒心：胸口不適要先排除心肌缺血"),
    r(
      "trop",
      "plus",
      "火燒心＋胸痛／冒汗或心血管風險：心肌缺血",
      (c) => c.yes("chest_pain") || c.yes("cold_sweat") || c.cardiacRisk,
    ),
    r("cbc_dc", "core", "胃痛：貧血（潛在出血）"),
    r("crea", "plus", "胃痛：腎功能"),
    r("alt", "plus", "胃痛：肝功能"),
    r(
      "lipase",
      "plus",
      "上腹痛：胰臟炎",
      (c) => c.yes("alcohol") || c.yes("food_trigger") || c.yes("vomiting"),
    ),
    r("crp", "plus", "胃痛：發炎指標"),
    r(
      "cxr",
      "plus",
      "胃痛＋胸痛或喘：肺／縱膈",
      (c) => c.yes("chest_pain") || c.yes("dyspnea"),
    ),
    r("stool_ob", "plus", "胃痛＋黑便：潛血", (c) => c.yes("melena")),
  ],

  anorectal: [
    r("cbc_dc", "core", "肛門問題：貧血或感染"),
    r("crp", "core", "肛門腫痛＋發燒：肛周膿瘍", (c) => c.yes("fever") || c.yes("pus")),
    r("crea", "plus", "肛門問題：術前腎功能"),
    r("glu", "plus", "肛周感染：糖尿病控制", (c) => c.pmh.has("dm") || c.yes("pus")),
    r(
      "pt",
      "plus",
      "肛門出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") || c.yes("hematochezia"),
    ),
    r(
      "aptt",
      "plus",
      "肛門出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") || c.yes("hematochezia"),
    ),
    r("stool_ob", "plus", "肛門出血：糞便潛血", (c) => c.yes("hematochezia")),
    r("ct_pelvis", "ask", "疑似深部肛周膿瘍／敗血症：骨盆腔 CT", (c) => c.yes("fever")),
  ],

  dental: [
    r("cbc_dc", "plus", "牙口問題＋發燒：感染"),
    r("crp", "plus", "牙口問題＋發燒：感染", (c) => c.yes("fever")),
    r("glu", "plus", "牙口感染：糖尿病控制", (c) => c.pmh.has("dm")),
    r(
      "pt",
      "plus",
      "拔牙後出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") || c.yes("gum_bleed"),
    ),
    r(
      "aptt",
      "plus",
      "拔牙後出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") || c.yes("gum_bleed"),
    ),
    r(
      "neck_soft_xr",
      "ask",
      "吞嚥困難／喘鳴：頸部軟組織側位",
      (c) => c.yes("dysphagia") || c.yes("stridor_h"),
    ),
    r(
      "ct_neck",
      "ask",
      "牙膿瘍擴散／深頸部感染：頸部 CT",
      (c) => c.yes("fever") && (c.yes("dysphagia") || c.yes("lip_swell")),
    ),
    r("ct_face", "ask", "牙膿瘍／顏面腫：顏面 CT", (c) => c.yes("fever")),
  ],

  scrotal: [
    r("urine_routine", "core", "陰囊痛：尿路感染／副睪炎"),
    r("cbc_dc", "core", "陰囊痛：感染"),
    r("crp", "core", "陰囊痛：感染"),
    r("crea", "plus", "陰囊痛：腎功能"),
    r("glu", "plus", "陰囊痛：糖尿病（壞死性筋膜炎風險）", (c) => c.pmh.has("dm")),
  ],

  preg_issue: [
    r("cbc_dc", "core", "孕期不適：貧血、血小板"),
    r("crea", "core", "孕期不適：腎功能（子癇前症）"),
    r("na", "plus", "孕期不適：電解質"),
    r("k", "plus", "孕期不適：電解質"),
    r("glu", "plus", "孕期不適：血糖"),
    r("alt", "core", "孕期不適：肝功能（HELLP）"),
    r("ast", "core", "孕期不適：肝功能（HELLP）"),
    r(
      "ldh",
      "plus",
      "孕期不適：溶血（HELLP）",
      (c) => c.yes("headache") || c.yes("vision") || c.yes("preg_htn"),
    ),
    r("urine_routine", "core", "孕期不適：蛋白尿／尿路感染"),
    r("pt", "plus", "孕期出血：凝血功能", (c) => c.yes("vag_bleed")),
    r("aptt", "plus", "孕期出血：凝血功能", (c) => c.yes("vag_bleed")),
    r("bhcg", "plus", "早期孕期出血：β-hCG 定量", (c) => c.yes("vag_bleed")),
    r("crp", "plus", "孕期發燒：感染", (c) => c.yes("fever")),
  ],

  intox: [
    r("cbc_dc", "core", "中毒：基本抽血"),
    r("crea", "core", "中毒：腎功能"),
    r("na", "core", "中毒：電解質"),
    r("k", "core", "中毒：電解質"),
    r("glu", "core", "中毒：血糖"),
    r("ecg", "core", "中毒：QT／心律（抗憂鬱藥、心臟藥）"),
    r("alt", "core", "中毒：肝功能（APAP）"),
    r("ast", "core", "中毒：肝功能（APAP）"),
    r(
      "apap",
      "core",
      "不明或自傷服藥：APAP 濃度",
      (c) =>
        c.sel("ingest_intent") !== "意外" ||
        c.picks("ingest_substance").some((p) => p === "止痛藥 APAP" || p === "不明"),
    ),
    r(
      "salicylate",
      "plus",
      "不明或自傷服藥：水楊酸濃度",
      (c) =>
        c.sel("ingest_intent") !== "意外" ||
        c.picks("ingest_substance").includes("NSAID"),
    ),
    r(
      "etoh",
      "core",
      "酒精或不明物質：酒精濃度",
      (c) =>
        c.picks("ingest_substance").some((p) => p === "酒精" || p === "不明") ||
        c.yes("alcohol"),
    ),
    r("urine_drug", "plus", "毒品或不明物質：尿液藥物篩檢", (c) =>
      c
        .picks("ingest_substance")
        .some((p) => p === "毒品" || p === "不明" || p === "安眠鎮靜藥"),
    ),
    r(
      "ck",
      "plus",
      "中毒＋意識喪失或抽搐：橫紋肌溶解",
      (c) => c.yes("loc") || c.yes("seizure"),
    ),
    r(
      "tni",
      "plus",
      "心臟藥或胸痛：心肌傷害",
      (c) =>
        c.yes("chest_pain") || c.picks("ingest_substance").includes("降血壓／心臟藥"),
    ),
    r(
      "ct_brain",
      "ask",
      "中毒＋外傷或神經缺損：頭部 CT",
      (c) => c.yes("head_strike") || c.yes("weak_focal"),
    ),
  ],

  head_injury: [
    r(
      "ct_brain",
      "core",
      "頭外傷紅旗（意識喪失、失憶、嘔吐、抗凝血、年長）：頭部 CT",
      (c) =>
        c.yes("loc") ||
        c.yes("amnesia") ||
        c.yes("vomiting") ||
        c.yes("anticoag") ||
        c.older ||
        c.yes("weak_focal"),
    ),
    r("ct_brain", "ask", "頭外傷：依 Canadian CT head rule 評估後再決定"),
    r("pt", "core", "頭外傷＋抗凝血：凝血功能", (c) => c.yes("anticoag")),
    r("aptt", "core", "頭外傷＋抗凝血：凝血功能", (c) => c.yes("anticoag")),
    r(
      "cbc_dc",
      "plus",
      "頭外傷＋抗凝血或出血：血紅素與血小板",
      (c) => c.yes("anticoag") || c.yes("wound_bleed"),
    ),
    r(
      "glu",
      "plus",
      "頭外傷＋意識改變：血糖",
      (c) => c.yes("confusion") || c.yes("loc"),
    ),
    r("etoh", "plus", "頭外傷＋飲酒：酒精濃度", (c) => c.yes("alcohol")),
    r("ct_cspine", "ask", "頭外傷＋頸痛：頸椎 CT", (c) => c.yes("neck_back_pain")),
    r("cspine_xr", "ask", "頭外傷＋頸痛：頸椎 X 光", (c) => c.yes("neck_back_pain")),
    r("ecg", "plus", "頭外傷＋暈厥：心因性暈厥導致跌倒", (c) => c.yes("syncope")),
  ],

  limb_injury: [
    r(
      "cbc_dc",
      "plus",
      "肢體外傷＋出血或抗凝血：血紅素",
      (c) => c.yes("wound_bleed") || c.yes("anticoag"),
    ),
    r("pt", "plus", "肢體外傷＋抗凝血：凝血功能", (c) => c.yes("anticoag")),
    r("aptt", "plus", "肢體外傷＋抗凝血：凝血功能", (c) => c.yes("anticoag")),
    r(
      "ck",
      "plus",
      "肢體壓砸傷：橫紋肌溶解",
      (c) => c.sel("mechanism") === "高處墜落" || c.yes("deformity"),
    ),
    r(
      "pelvis_xr",
      "ask",
      "髖／骨盆外傷：骨盆 X 光",
      (c) =>
        c.text("injury_site").toLowerCase().includes("hip") ||
        c.text("injury_site").includes("髖") ||
        c.text("injury_site").toLowerCase().includes("pelvi"),
    ),
  ],

  wound: [
    r(
      "pt",
      "plus",
      "傷口出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") && c.yes("wound_bleed"),
    ),
    r(
      "aptt",
      "plus",
      "傷口出血＋抗凝血：凝血功能",
      (c) => c.yes("anticoag") && c.yes("wound_bleed"),
    ),
    r(
      "cbc_dc",
      "plus",
      "大量出血：血紅素",
      (c) => c.yes("wound_bleed") && c.yes("anticoag"),
    ),
    r("glu", "plus", "糖尿病病人的傷口：血糖", (c) => c.pmh.has("dm")),
  ],

  burn: [
    r("cbc_dc", "plus", "燒燙傷：血紅素濃縮／感染"),
    r("crea", "plus", "燒燙傷：腎功能與水份"),
    r("na", "plus", "燒燙傷：電解質"),
    r("k", "plus", "燒燙傷：電解質"),
    r("ecg", "core", "電擊傷：心律", (c) => c.picks("burn_cause").includes("電擊")),
    r("ck", "core", "電擊或大面積燒傷：橫紋肌溶解", (c) =>
      c.picks("burn_cause").includes("電擊"),
    ),
    r("urine_routine", "plus", "電擊或大面積燒傷：肌紅蛋白尿", (c) =>
      c.picks("burn_cause").includes("電擊"),
    ),
    r(
      "cxr",
      "plus",
      "吸入性燒傷：肺部",
      (c) => c.yes("inhal_exposure") || c.yes("dyspnea") || c.yes("hoarse_h"),
    ),
  ],

  bite_sting: [
    r("cbc_dc", "core", "蛇咬：血小板與血紅素", (c) =>
      c.picks("bite_animal").includes("蛇"),
    ),
    r("pt", "core", "蛇咬：凝血功能", (c) => c.picks("bite_animal").includes("蛇")),
    r("aptt", "core", "蛇咬：凝血功能", (c) => c.picks("bite_animal").includes("蛇")),
    r("fibrinogen", "core", "蛇咬：纖維蛋白原", (c) =>
      c.picks("bite_animal").includes("蛇"),
    ),
    r("ck", "core", "蛇咬：橫紋肌溶解", (c) => c.picks("bite_animal").includes("蛇")),
    r("crea", "core", "蛇咬：腎功能", (c) => c.picks("bite_animal").includes("蛇")),
    r("na", "plus", "蛇咬：電解質", (c) => c.picks("bite_animal").includes("蛇")),
    r("k", "plus", "蛇咬：電解質", (c) => c.picks("bite_animal").includes("蛇")),
    r(
      "cbc_dc",
      "plus",
      "咬螫傷＋發燒或紅腫擴大：感染",
      (c) => c.yes("fever") || c.yes("redness"),
    ),
    r(
      "crp",
      "plus",
      "咬螫傷＋發燒或紅腫擴大：感染",
      (c) => c.yes("fever") || c.yes("redness"),
    ),
    r(
      "ecg",
      "plus",
      "過敏性休克或全身症狀：心律",
      (c) => c.yes("presyncope") || c.yes("dyspnea"),
    ),
  ],

  joint_pain: [
    r(
      "cbc_dc",
      "core",
      "關節紅熱或發燒：化膿性關節炎",
      (c) => c.yes("fever") || c.yes("joint_hot"),
    ),
    r(
      "crp",
      "core",
      "關節紅熱或發燒：化膿性關節炎",
      (c) => c.yes("fever") || c.yes("joint_hot"),
    ),
    r("crea", "plus", "關節痛：腎功能（痛風／止痛藥選擇）"),
    r("glu", "plus", "關節痛：糖尿病／類固醇前"),
    r("alt", "plus", "關節痛：肝功能（止痛藥選擇）"),
  ],

  cellulitis: [
    r("cbc_dc", "core", "蜂窩性組織炎：白血球"),
    r("crp", "core", "蜂窩性組織炎：發炎指標"),
    r("crea", "core", "蜂窩性組織炎：抗生素劑量"),
    r("na", "plus", "蜂窩性組織炎：電解質"),
    r("k", "plus", "蜂窩性組織炎：電解質"),
    r("glu", "core", "蜂窩性組織炎：糖尿病控制"),
    r(
      "lactate",
      "plus",
      "蜂窩性組織炎＋發燒且高風險：敗血症",
      (c) => c.yes("fever") && (c.older || c.vulnerable),
    ),
    r("ddimer", "plus", "單側腿紅腫痛：DVT 鑑別", (c) => c.yes("calf_pain")),
    r("doppler_limbs", "ask", "單側腿紅腫痛：下肢血管超音波", (c) =>
      c.yes("calf_pain"),
    ),
  ],

  foreign_body: [
    r("cxr", "core", "吞入或吸入異物：胸部 X 光", (c) =>
      c.picks("fb_site").some((p) => p === "喉嚨／食道" || p === "吸入氣管"),
    ),
    r("neck_soft_xr", "core", "喉嚨／食道異物：頸部軟組織側位", (c) =>
      c.picks("fb_site").includes("喉嚨／食道"),
    ),
    r(
      "kub",
      "plus",
      "吞入或肛門異物：腹部 X 光",
      (c) =>
        c.picks("fb_site").some((p) => p === "喉嚨／食道" || p === "肛門／直腸") ||
        c.yes("fb_ingest"),
    ),
    r(
      "cbc_dc",
      "plus",
      "異物＋發燒或嘔吐：感染／穿孔",
      (c) => c.yes("fever") || c.yes("vomiting"),
    ),
    r(
      "crp",
      "plus",
      "異物＋發燒或嘔吐：感染／穿孔",
      (c) => c.yes("fever") || c.yes("vomiting"),
    ),
    r("ct_neck", "ask", "食道異物卡住或疑似穿孔：頸部 CT"),
    r("ct_chest", "ask", "吸入異物或疑似縱膈炎：胸部 CT", (c) =>
      c.picks("fb_site").some((p) => p === "吸入氣管" || p === "喉嚨／食道"),
    ),
  ],

  device_prob: [
    r("cbc_dc", "core", "管路問題：感染"),
    r("crp", "core", "管路問題：發炎指標"),
    r("crea", "core", "管路問題：腎功能"),
    r("na", "plus", "管路問題：電解質"),
    r("k", "plus", "管路問題：電解質"),
    r("glu", "plus", "管路問題：血糖"),
    r(
      "urine_routine",
      "core",
      "尿管／腎造瘻問題：尿液分析",
      (c) =>
        c.picks("device_type").some((p) => p === "Foley" || p === "腎造瘻") ||
        c.yes("dysuria") ||
        c.yes("hematuria"),
    ),
    r("tbil", "core", "膽道引流管問題：膽紅素", (c) =>
      c.picks("device_type").includes("膽道引流"),
    ),
    r("dbil", "core", "膽道引流管問題：直接膽紅素", (c) =>
      c.picks("device_type").includes("膽道引流"),
    ),
    r("alp", "core", "膽道引流管問題：ALP", (c) =>
      c.picks("device_type").includes("膽道引流"),
    ),
    r("alt", "core", "膽道引流管問題：肝功能", (c) =>
      c.picks("device_type").includes("膽道引流"),
    ),
    r("cxr", "plus", "Port-A／氣切／胸管問題：胸部 X 光", (c) =>
      c
        .picks("device_type")
        .some((p) => p === "Port-A" || p === "氣切" || p === "胸管" || p === "PICC"),
    ),
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
  "head_injury",
  "limb_injury",
  "intox",
  "preg_issue",
  "env_injury",
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
    // 預設開 Troponin I；只有「確定是年輕人」（年齡有填、< 40 歲、沒有心血管病史）才換成 hs-cTnT。
    // 年齡空白一律當作無法確定，開 Troponin I。
    return ctx.age !== null && ctx.age < 40 && !ctx.cardiacHistory ? "hs_tnt" : "tni";
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
  const add = (rawId: string, rawTier: OrderTier, reason: string) => {
    let why = reason;
    const id = resolvePseudo(rawId, ctx);
    // 育齡女性未排除懷孕：輻射檢查一律先不勾（驗孕排除後再開），理由會寫在項目上。
    const holdForPregnancy = ctx.pregnancyNotExcluded && RADIATION_IDS.has(id);
    const tier: OrderTier =
      (ctx.child && /^ct/.test(id)) || holdForPregnancy ? "ask" : rawTier;
    if (holdForPregnancy) why = `${why}（育齡女性：先驗孕排除懷孕再開）`;
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
      ([id, entry]) =>
        RADIATION_IDS.has(id) && (entry.tier !== "ask" || ctx.pregnancyNotExcluded),
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
  if (has("scrotal"))
    notes.push(
      "陰囊／睪丸急性疼痛：睪丸扭轉要在發病 6 小時內處理最有機會保住，不要等檢驗；盡早會診泌尿科並安排陰囊都卜勒超音波。",
    );
  if (has("preg_issue"))
    notes.push(
      "孕期不適：胎心音與產科超音波請盡早會診婦產科；血壓高、頭痛、視力模糊要想到子癇前症。Rh 血型與備血到「輸血作業」。",
    );
  if (has("intox"))
    notes.push(
      "中毒：先確認服用的藥名、量與時間（請家屬帶藥盒）；必要時洽詢毒物諮詢中心或毒物科。活性碳、解毒劑依藥物與時間決定。",
    );
  if (has("head_injury"))
    notes.push(
      "頭外傷：服用抗凝血藥、年長、意識喪失、持續嘔吐要放寬 CT 門檻；留觀時以 GCS 與神經學檢查追蹤。",
    );
  if (has("bite_sting"))
    notes.push(
      "咬螫傷：蛇咬記下時間與蛇的外觀，定期追蹤凝血與 CK，抗蛇毒血清依醫院規定與毒物科會診。動物咬傷依傷口與疫苗史評估破傷風與狂犬病暴露。",
    );
  if (has("foreign_body"))
    notes.push(
      "異物：喘、喘鳴或流口水（氣道異物）要立刻處理氣道；電池、磁鐵、尖銳物吞入屬緊急，盡早會診。",
    );
  if (has("device_prob"))
    notes.push(
      "管路問題：疑似導管相關血流感染（Port-A、PICC）時，血液培養由護理師在建立 IV 時一併抽，不在第一輪開單；Foley 阻塞可先沖洗或更換。",
    );
  if (has("eye") || has("ent"))
    notes.push(
      "眼科／耳鼻喉專科檢查（眼壓、裂隙燈、鼻咽內視鏡等）不在此建議，請依需要另開或會診。",
    );
  if (has("skin_allergy"))
    notes.push("過敏：以藥物處置為主（例如 Dexa＋CTM），多半不需要檢查。");
  if (ctx.fertile && [...picked].some((id) => RADIATION_IDS.has(id)))
    notes.push("育齡女性做輻射檢查前須驗孕，病人拒絕要簽拒絕驗孕同意書。");
  notes.push(
    "第一輪不預設開：血液培養、各種培養、床邊超音波、血氣（VBG/ABG）、備血。需要時再加（B/C、VBG、備血只有護理師抽，打 IV 時一併抽，單子夾板夾、不要給病人）；可到「其他常用檢查」手動加入。",
  );
  if (ctx.child)
    notes.push(
      "未成年：CT 預設不勾，輻射檢查請與 VS／兒科討論；抽血量與血液培養規定也不同。",
    );
  if (ctx.fertile && ctx.yes("pregnancy_possible"))
    notes.push("可能懷孕：避免不必要的 CT／X 光，先確認驗孕結果並與 VS 討論。");
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
