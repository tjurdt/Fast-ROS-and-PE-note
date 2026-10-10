/**
 * 特別情境：題庫沒涵蓋、但會影響評估或病歷的長期背景（懷孕、化療、抗凝血、管路…）。
 * 畫面上是自由輸入框（`ed.ctx.situation`，寫進 PH 的「Situation」），下方的下拉選單
 * 只負責把這些常用片語插入輸入框。舊版是逐項勾選（`ed.sp.*`），舊資料仍會照樣輸出。
 *
 * 「本次相關情境」（救護車、酒醉、溝通困難…）已依使用者要求移除。
 */
export interface SpecialItem {
  id: string;
  label: string;
  /** 寫進病歷的英文片語。 */
  text: string;
  target: "PH";
  /** 細節輸入框的提示；有值才會出現輸入框。 */
  detail?: string;
}

export const SPECIAL_ITEMS: readonly SpecialItem[] = [
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

/** 插入到自由輸入框：接在原有文字後面，以逗號分隔；已存在就不重複。 */
export function appendSituation(current: string, phrase: string): string {
  const trimmed = current.trim().replace(/[,，]\s*$/, "");
  if (!trimmed) return phrase;
  if (trimmed.split(/[,，]\s*/).includes(phrase)) return trimmed;
  return `${trimmed}, ${phrase}`;
}

/** 病歷用的片語：片語＋（細節）。 */
export function specialPhrase(item: SpecialItem, detail: string): string {
  const trimmed = detail.trim();
  return trimmed ? `${item.text} (${trimmed})` : item.text;
}
