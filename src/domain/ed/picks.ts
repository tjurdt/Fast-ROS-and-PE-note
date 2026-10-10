import type { FindingValue } from "../clinical/finding";
import { historyItem } from "./history-library";
import { edKey, type HistoryPick } from "./types";

/**
 * 單選／複選題的已選選項。
 *
 * 複選題（`multi: true`，例如腹痛部位九宮格）存在 `fu`：{ 選項標籤: "1" }；
 * 單選題存在 `sel`。舊資料可能是單選格式，兩邊都讀，選取順序依題目的選項順序。
 */
type Findings = Readonly<Record<string, FindingValue | undefined>>;

export function pickedOptions(findings: Findings, itemId: string): string[] {
  const item = historyItem(itemId);
  const finding = findings[edKey.history(itemId)];
  if (!item || item.type !== "pick" || !finding) return [];
  const chosen = new Set<string>();
  if (finding.sel) chosen.add(finding.sel);
  for (const [label, on] of Object.entries(finding.fu ?? {})) {
    if (on === "1") chosen.add(label);
    else chosen.delete(label);
  }
  return item.options
    .map((option) => option.label)
    .filter((label) => chosen.has(label));
}

export function isPicked(findings: Findings, itemId: string, option: string): boolean {
  return pickedOptions(findings, itemId).includes(option);
}

/** 點一下選項後的新值：複選題切換該選項；單選題換成該選項（再點一次取消）。 */
export function togglePick(
  item: HistoryPick,
  finding: FindingValue,
  option: string,
): FindingValue {
  if (!item.multi) return finding.sel === option ? {} : { sel: option };
  const current = new Set<string>();
  if (finding.sel) current.add(finding.sel);
  for (const [label, on] of Object.entries(finding.fu ?? {})) {
    if (on === "1") current.add(label);
  }
  if (current.has(option)) current.delete(option);
  else current.add(option);
  if (current.size === 0) return {};
  return { fu: Object.fromEntries([...current].map((label) => [label, "1"])) };
}

/** 把某個選項加進去（不會取消已選的）；給主訴分拆按鈕用。 */
export function addPick(
  item: HistoryPick,
  finding: FindingValue,
  option: string,
): FindingValue {
  if (!item.multi) return { sel: option };
  const fu: Record<string, string> = {};
  if (finding.sel) fu[finding.sel] = "1";
  for (const [label, on] of Object.entries(finding.fu ?? {}))
    if (on === "1") fu[label] = "1";
  fu[option] = "1";
  return { fu };
}

/** 把某個選項拿掉；全部拿掉就清空。 */
export function removePick(
  item: HistoryPick,
  finding: FindingValue,
  option: string,
): FindingValue {
  if (!item.multi) return finding.sel === option ? {} : finding;
  const fu: Record<string, string> = {};
  if (finding.sel && finding.sel !== option) fu[finding.sel] = "1";
  for (const [label, on] of Object.entries(finding.fu ?? {})) {
    if (on === "1" && label !== option) fu[label] = "1";
  }
  return Object.keys(fu).length > 0 ? { fu } : {};
}
