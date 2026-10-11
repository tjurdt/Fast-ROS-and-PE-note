import type { FindingValue } from "../clinical/finding";
import type { PeItem, PeMatrixRow } from "./types";

/** 矩陣型 PE 所見的存檔鍵與輸出（見 types.ts 的 PeMatrix）。 */
export const matrixKey = {
  row: (row: PeMatrixRow) => `m:${row.label}`,
  variant: (row: PeMatrixRow, variant: string) => `v:${row.label}@${variant}`,
  site: (row: PeMatrixRow, site: string) => `s:${row.label}@${site}`,
};

const on = (finding: FindingValue, key: string) => finding.fu?.[key] === "1";

export function rowSelected(finding: FindingValue, row: PeMatrixRow): boolean {
  return on(finding, matrixKey.row(row));
}

/** 切換一個欄位（類型、變化型或部位）；取消類型時一併清掉它的變化型與部位。 */
export function toggleMatrixKey(
  finding: FindingValue,
  key: string,
  row?: PeMatrixRow,
): FindingValue {
  const fu = { ...(finding.fu ?? {}) };
  const turningOff = fu[key] === "1";
  fu[key] = turningOff ? "0" : "1";
  if (turningOff && row && key === matrixKey.row(row)) {
    const prefixes = [`v:${row.label}@`, `s:${row.label}@`];
    for (const existing of Object.keys(fu)) {
      if (prefixes.some((prefix) => existing.startsWith(prefix))) fu[existing] = "0";
    }
  }
  return { ...finding, fu };
}

/** 一個類型的輸出，例如 "fine rales (RLL, LLL)"；沒選就回傳空字串。 */
function rowPhrase(finding: FindingValue, row: PeMatrixRow, sites: string[]): string {
  if (!rowSelected(finding, row)) return "";
  const variants = (row.variants ?? []).filter((v) =>
    on(finding, matrixKey.variant(row, v)),
  );
  const chosenSites = row.noSites
    ? []
    : sites.filter((site) => on(finding, matrixKey.site(row, site)));
  const name = row.variantAfter
    ? [row.text, ...variants].join(" ")
    : [...variants, row.text].join(" ");
  return chosenSites.length > 0 ? `${name} (${chosenSites.join(", ")})` : name;
}

export function matrixPhrases(item: PeItem, finding: FindingValue): string[] {
  const matrix = item.matrix;
  if (!matrix) return [];
  return matrix.rows
    .map((row) => rowPhrase(finding, row, matrix.sites))
    .filter((phrase) => phrase !== "");
}
