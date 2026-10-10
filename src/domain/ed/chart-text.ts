import { FIELD_ORDER } from "./compose";
import type { EdChart } from "./compose";
import { orderMemo } from "./order-memo";
import { ED_ORDER_FREQ, type EdOrder } from "./orders";
import type { EdFieldKey, EdProblem } from "./types";

/**
 * Fast PE note → ERS 油猴腳本的交換格式（純文字，可直接複製貼上）。
 *
 *   #ERNOTE v1
 *   CC: abd pain, N/V for 2 days
 *   PI: ...
 *   ICD: R10.9 Unspecified abdominal pain; R11.2 Nausea with vomiting, unspecified
 *   ORDERS:
 *   9071715F|CBC,DC,|LAB0301|Blood|URGENT
 *   15002010|CHEST PA VIEW|0000000|Patient|URGENT|abd pain for 2 days|r/o free air under diaphragm
 *
 * ORDERS 一行一項：pfkey|ERS 醫囑名稱|檢體代碼|檢體|頻率[|診斷說明|檢查目的]。
 * 影像檢查會多帶兩段說明，給 ERS「請輸入說明」視窗的 [診斷說明]／[檢查目的]；
 * 舊版腳本只讀前五段，多出來的會被忽略。油猴腳本會在 ERS 檢查驗系統
 * 把這些項目加進「待送出」格子（不會按送出）。ORDERS 放在最後，舊版腳本會把它當成 ICD 的
 * 續行並因格式不符而忽略，不會出錯。
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

export function serializeChart(
  chart: EdChart,
  patient?: ChartPatient,
  orders: readonly EdOrder[] = [],
  problems: readonly EdProblem[] = [],
): string {
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
  if (orders.length > 0) {
    lines.push("ORDERS:");
    for (const order of orders) {
      const fields = [
        order.pfkey,
        order.name,
        order.spcnmCode,
        order.spcnm,
        ED_ORDER_FREQ,
      ];
      const memo = orderMemo(order, problems, chart.fields.CC);
      if (memo) fields.push(memo.dx, memo.purpose);
      lines.push(fields.join("|"));
    }
  }
  return lines.join("\n");
}

export interface ParsedOrderLine {
  pfkey: string;
  name: string;
  spcnmCode: string;
  spcnm: string;
  freq: string;
  /** 影像檢查「請輸入說明」的 [診斷說明]／[檢查目的]；沒有就是空字串。 */
  memoDx: string;
  memoPurpose: string;
}

export interface ParsedChartText {
  version: number;
  /** 年齡＋性別代碼（可能為空）。 */
  patient: string;
  fields: Partial<Record<EdFieldKey, string>>;
  icd: { code: string; desc: string }[];
  orders: ParsedOrderLine[];
}

const KEY_PATTERN = new RegExp(
  String.raw`^(${[...CHART_TEXT_KEYS, "ICD", "ORDERS", "PT"].join("|")})\s*[:：]\s?(.*)$`,
);

/** 與油猴腳本相同語意的解析器；這裡用於契約測試。 */
export function parseChartText(input: string): ParsedChartText {
  const fields: Partial<Record<EdFieldKey, string>> = {};
  let icdRaw = "";
  let ordersRaw = "";
  let version = 0;
  let patient = "";
  let current: EdFieldKey | "ICD" | "ORDERS" | "PT" | null = null;
  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const header = /^#ERNOTE\s+v(\d+)\s*$/i.exec(rawLine.trim());
    if (header) {
      version = Number(header[1]);
      continue;
    }
    const match = KEY_PATTERN.exec(rawLine);
    if (match) {
      current = match[1] as EdFieldKey | "ICD" | "ORDERS" | "PT";
      if (current === "PT") patient = (match[2] ?? "").trim().toUpperCase();
      else if (current === "ICD") icdRaw += `${match[2]}\n`;
      else if (current === "ORDERS") ordersRaw += `${match[2]}\n`;
      else fields[current] = match[2] ?? "";
    } else if (current && current !== "PT") {
      if (current === "ICD") icdRaw += `${rawLine}\n`;
      else if (current === "ORDERS") ordersRaw += `${rawLine}\n`;
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
  const orders: ParsedOrderLine[] = [];
  const seen = new Set<string>();
  for (const line of ordersRaw.split("\n")) {
    const [
      pfkey = "",
      name = "",
      spcnmCode = "",
      spcnm = "",
      freq = "",
      memoDx = "",
      memoPurpose = "",
    ] = line.trim().split("|");
    if (!/^[0-9A-Z]{8}$/.test(pfkey) || seen.has(pfkey)) continue;
    seen.add(pfkey);
    orders.push({
      pfkey,
      name: name.trim(),
      spcnmCode,
      spcnm,
      freq: freq || ED_ORDER_FREQ,
      memoDx: memoDx.trim(),
      memoPurpose: memoPurpose.trim(),
    });
  }
  return { version, patient, fields, icd, orders };
}
