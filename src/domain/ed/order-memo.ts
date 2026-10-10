import type { EdOrder } from "./orders";
import type { EdProblem } from "./types";

/**
 * 影像檢查的「請輸入說明」：ERS 開 CXR、KUB、CT 等項目時會跳出視窗，要填
 * [診斷說明] 與 [檢查目的]。這裡產生兩段短文字，隨 ORDERS 帶給油猴腳本自動填入。
 *
 *   診斷說明 = 病歷的 CC（主訴＋時間），沒有 CC 時用已選問題的英文主訴。
 *   檢查目的 = 依「這個檢查 × 已選問題」挑 r/o 片語，多個問題合併去重。
 *
 * 只有 X 光與 CT／MRI／血管超音波會帶說明；抽血、尿液不會跳這個視窗。
 */
export interface OrderMemo {
  dx: string;
  purpose: string;
}

/** ERS 這兩個欄位的 maxlength 都是 300；留一點餘裕。 */
export const ORDER_MEMO_MAX = 280;

const MEMO_GROUPS: ReadonlySet<EdOrder["group"]> = new Set(["xray", "ct"]);

/** 檢查 → 問題 → 目的；`*` 是沒有對應問題時的預設。 */
const PURPOSES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  cxr_pa: {
    fever: "r/o pneumonia",
    cough_uri: "r/o pneumonia",
    dyspnea: "r/o pneumonia, pulmonary edema, pleural effusion, pneumothorax",
    chest_pain: "r/o pneumothorax, pneumonia, widened mediastinum",
    palpitation: "r/o cardiomegaly, pulmonary congestion",
    syncope: "r/o cardiomegaly, pulmonary congestion",
    weakness: "r/o pneumonia",
    ams: "r/o aspiration pneumonia",
    trauma: "r/o rib fracture, pneumothorax, hemothorax",
    abd_pain: "r/o free air under diaphragm, lower lobe pneumonia",
    "*": "r/o cardiopulmonary lesion",
  },
  kub: {
    abd_pain: "r/o ileus, free air, radiopaque stone",
    constipation_bloating: "r/o ileus, fecal impaction",
    nausea_vomiting: "r/o ileus",
    urinary: "r/o radiopaque urinary stone",
    "*": "r/o ileus",
  },
  pelvis_xr: { trauma: "r/o pelvic fracture", "*": "r/o pelvic fracture" },
  cspine_xr: { trauma: "r/o C-spine fracture", "*": "r/o C-spine lesion" },
  lspine_xr: {
    trauma: "r/o L-spine fracture",
    back_pain: "r/o compression fracture, spondylosis",
    "*": "r/o L-spine lesion",
  },
  skull_xr: { "*": "r/o skull fracture" },
  neck_soft_xr: {
    ent: "r/o retropharyngeal abscess, epiglottitis, foreign body",
    "*": "r/o soft tissue swelling, foreign body",
  },
  ct_brain: {
    trauma: "r/o ICH, skull fracture",
    headache: "r/o ICH, SAH, mass lesion",
    focal_neuro: "r/o ICH, acute infarction",
    "*": "r/o ICH, mass lesion",
  },
  cta_head_neck: { "*": "r/o large vessel occlusion, dissection" },
  ct_perfusion: { "*": "r/o acute ischemic penumbra" },
  ct_chest: { "*": "r/o PE, aortic dissection, lung lesion" },
  ct_upper_abd: { "*": "r/o hepatobiliary or pancreatic lesion" },
  ct_pelvis: { "*": "r/o pelvic lesion" },
  ct_cspine: { "*": "r/o C-spine fracture" },
  ct_lspine: { "*": "r/o L-spine fracture" },
  ct_face: { "*": "r/o facial bone fracture" },
  ct_neck: { "*": "r/o deep neck infection, mass" },
  mri_brain: { "*": "r/o acute infarction" },
  doppler_limbs: { "*": "r/o DVT" },
};

/** 交換文字一行一項、以 | 分隔：說明裡不能有 | 或換行。 */
function clean(value: string): string {
  return value
    .replace(/[|\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value: string): string {
  return value.length > ORDER_MEMO_MAX ? value.slice(0, ORDER_MEMO_MAX).trim() : value;
}

export function orderMemo(
  order: EdOrder,
  problems: readonly EdProblem[],
  cc: string,
): OrderMemo | null {
  if (!MEMO_GROUPS.has(order.group)) return null;
  const table = PURPOSES[order.id] ?? {};
  const phrases: string[] = [];
  for (const problem of problems) {
    const phrase = table[problem.id];
    if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
  }
  if (phrases.length === 0 && table["*"]) phrases.push(table["*"]);
  const dx = clean(cc) || clean(problems.map((problem) => problem.cc).join(", "));
  const purpose = clean(phrases.join("; "));
  if (!dx && !purpose) return null;
  return { dx: clip(dx), purpose: clip(purpose) };
}
