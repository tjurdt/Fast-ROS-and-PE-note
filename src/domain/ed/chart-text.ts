import { FIELD_ORDER } from "./compose";
import type { EdChart } from "./compose";
import type { EdFieldKey } from "./types";

/**
 * Fast PE note → ERS 油猴腳本的交換格式（純文字，可直接複製貼上）。
 *
 *   #ERNOTE v1
 *   CC: abd pain, N/V for 2 days
 *   PI: ...
 *   ICD: R10.9 Unspecified abdominal pain; R11.2 Nausea with vomiting, unspecified
 *
 * 一個欄位一行 `KEY: 值`；值可以跨行（下一行不是已知 KEY 開頭就接在後面）。
 * 沒有內容的欄位不輸出；油猴腳本不會動到沒有出現的欄位。
 */
export const CHART_TEXT_HEADER = "#ERNOTE v1";

export const CHART_TEXT_KEYS: readonly EdFieldKey[] = FIELD_ORDER;

export interface ChartPatient {
  /** "男 M" / "女 F" / ""。 */
  sex: string;
  age: string;
}

/** 年齡＋性別代碼，例如 "72M"。給油猴腳本核對「貼到的是不是這位病人」。 */
export function patientTag(patient: ChartPatient): string {
  const age = patient.age.trim().replace(/\D/g, "");
  const sex = patient.sex.includes("M") ? "M" : patient.sex.includes("F") ? "F" : "";
  return `${age}${sex}`;
}

export function serializeChart(chart: EdChart, patient?: ChartPatient): string {
  const lines: string[] = [CHART_TEXT_HEADER];
  const tag = patient ? patientTag(patient) : "";
  if (tag) lines.push(`PT: ${tag}`);
  for (const key of CHART_TEXT_KEYS) {
    const value = chart.fields[key].trim();
    if (value) lines.push(`${key}: ${value}`);
  }
  if (chart.icd.length > 0) {
    lines.push(
      `ICD: ${chart.icd.map((line) => (line.desc ? `${line.code} ${line.desc}` : line.code)).join("; ")}`,
    );
  }
  return lines.join("\n");
}

export interface ParsedChartText {
  version: number;
  /** 年齡＋性別代碼（可能為空）。 */
  patient: string;
  fields: Partial<Record<EdFieldKey, string>>;
  icd: { code: string; desc: string }[];
}

const KEY_PATTERN = new RegExp(
  String.raw`^(${[...CHART_TEXT_KEYS, "ICD", "PT"].join("|")})\s*[:：]\s?(.*)$`,
);

/** 與油猴腳本相同語意的解析器；這裡用於契約測試。 */
export function parseChartText(input: string): ParsedChartText {
  const fields: Partial<Record<EdFieldKey, string>> = {};
  let icdRaw = "";
  let version = 0;
  let patient = "";
  let current: EdFieldKey | "ICD" | "PT" | null = null;
  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const header = /^#ERNOTE\s+v(\d+)\s*$/i.exec(rawLine.trim());
    if (header) {
      version = Number(header[1]);
      continue;
    }
    const match = KEY_PATTERN.exec(rawLine);
    if (match) {
      current = match[1] as EdFieldKey | "ICD" | "PT";
      if (current === "PT") patient = (match[2] ?? "").trim().toUpperCase();
      else if (current === "ICD") icdRaw += `${match[2]}\n`;
      else fields[current] = match[2] ?? "";
    } else if (current && current !== "PT") {
      if (current === "ICD") icdRaw += `${rawLine}\n`;
      else fields[current] = `${fields[current] ?? ""}\n${rawLine}`;
    }
  }
  for (const key of Object.keys(fields) as EdFieldKey[]) {
    fields[key] = (fields[key] ?? "").trim();
  }
  const icd = icdRaw
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [code = "", ...rest] = entry.split(/\s+/);
      return { code: code.toUpperCase(), desc: rest.join(" ") };
    })
    .filter((entry) => /^[A-Z]\d[0-9A-Z]{1,2}(\.[0-9A-Z]{1,4})?$/.test(entry.code));
  return { version, patient, fields, icd };
}
