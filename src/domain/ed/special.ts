/**
 * 特別情境：題庫沒涵蓋、但會影響評估或病歷的狀況（懷孕、化療、抗凝血、酒醉、溝通困難…）。
 * 勾選後寫進病歷，可附細節；另有完全自由輸入的補充欄。
 *
 * - target = PI：與這次來院有關的情境，寫在 PI（現病史）。
 * - target = PH：長期背景，寫在 PH（過去病史）的「Situation」。
 */
export interface SpecialItem {
  id: string;
  label: string;
  /** 寫進病歷的英文片語。 */
  text: string;
  target: "PI" | "PH";
  /** 細節輸入框的提示；有值才會出現輸入框。 */
  detail?: string;
}

export const SPECIAL_ITEMS: readonly SpecialItem[] = [
  { id: "ems", label: "救護車送達", text: "arrived by EMS", target: "PI" },
  {
    id: "intoxicated",
    label: "酒醉／疑似物質影響",
    text: "intoxicated",
    target: "PI",
    detail: "例 alcohol, 氣味(+)",
  },
  {
    id: "comm_barrier",
    label: "溝通困難（失智／語言／聽力）",
    text: "history limited by communication barrier",
    target: "PI",
    detail: "例 dementia / 外籍 / 聾",
  },
  { id: "unaccompanied", label: "無家屬陪同", text: "unaccompanied", target: "PI" },
  {
    id: "ohca",
    label: "到院前心跳停止（OHCA）",
    text: "OHCA with ROSC",
    target: "PI",
    detail: "例 ROSC 後 / 無 ROSC",
  },
  {
    id: "pregnant",
    label: "懷孕中",
    text: "pregnant",
    target: "PH",
    detail: "例 GA 20w、G2P1",
  },
  { id: "breastfeeding", label: "哺乳中", text: "breastfeeding", target: "PH" },
  {
    id: "chemo",
    label: "化療／標靶治療中",
    text: "on chemotherapy",
    target: "PH",
    detail: "例 最後一次 10/1、藥名",
  },
  {
    id: "immunocompromised",
    label: "免疫低下／器官移植",
    text: "immunocompromised",
    target: "PH",
    detail: "例 s/p LT、tacrolimus",
  },
  {
    id: "anticoag",
    label: "抗凝血／抗血小板藥",
    text: "on anticoagulant/antiplatelet",
    target: "PH",
    detail: "例 warfarin、NOAC、aspirin",
  },
  {
    id: "device",
    label: "體內管路",
    text: "indwelling device",
    target: "PH",
    detail: "例 Foley、NG、PICC、Port-A、PCN",
  },
  {
    id: "bedridden",
    label: "長期臥床",
    text: "bedridden",
    target: "PH",
  },
  {
    id: "institution",
    label: "安養／長照機構",
    text: "from nursing home",
    target: "PH",
  },
  {
    id: "recent_admission",
    label: "近期手術／住院",
    text: "recent surgery/admission",
    target: "PH",
    detail: "例 2 週前 cholecystectomy",
  },
  {
    id: "dnr",
    label: "DNR／預立醫療決定",
    text: "DNR",
    target: "PH",
  },
];

export function specialItem(id: string): SpecialItem | undefined {
  return SPECIAL_ITEMS.find((item) => item.id === id);
}

/** 病歷用的片語：片語＋（細節）。 */
export function specialPhrase(item: SpecialItem, detail: string): string {
  const trimmed = detail.trim();
  return trimmed ? `${item.text} (${trimmed})` : item.text;
}
