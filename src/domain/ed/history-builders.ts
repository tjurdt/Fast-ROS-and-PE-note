import type { EdSystemKey, HistoryPick, HistoryText, HistoryYesNo } from "./types";

export function yn(
  id: string,
  system: EdSystemKey,
  label: string,
  pos: string,
  extra: Partial<Omit<HistoryYesNo, "id" | "system" | "label" | "pos" | "type">> = {},
): HistoryYesNo {
  return { type: "yn", id, system, label, pos, ...extra };
}

export function pick(
  id: string,
  system: EdSystemKey,
  label: string,
  options: HistoryPick["options"],
  extra: Partial<Pick<HistoryPick, "multi" | "joinTemplate" | "layout">> = {},
): HistoryPick {
  return { type: "pick", id, system, label, options, ...extra };
}

export function text(
  id: string,
  system: EdSystemKey,
  label: string,
  template: string,
  extra: Partial<Pick<HistoryText, "placeholder" | "gate">> = {},
): HistoryText {
  return { type: "text", id, system, label, template, ...extra };
}

/** 單一選項：中文按鈕與英文片語相同時的簡寫。 */
export const opt = (label: string, textValue: string, cc?: string) =>
  cc === undefined ? { label, text: textValue } : { label, text: textValue, cc };
