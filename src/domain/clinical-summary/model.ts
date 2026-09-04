export type ClinicalSummaryMode = "limited" | "full";

export interface ClinicalSummaryLine {
  label: string;
  value: string;
  positive: boolean;
  note: string;
}

export interface ClinicalSummarySection {
  id: string;
  title: string;
  note: string;
  lines: ClinicalSummaryLine[];
}

export interface ClinicalSummaryHeader {
  patientCode: string;
  demographics: string;
  problem: string;
  specialty: string;
  exportedAt: string;
}

export interface ClinicalSummaryDocument {
  title: string;
  mode: ClinicalSummaryMode;
  header: ClinicalSummaryHeader;
  sections: ClinicalSummarySection[];
  disclaimer: string;
}

export const CLINICAL_SUMMARY_DISCLAIMER =
  "※ 本紀錄為臨床輔助草稿，請自行核對後再正式記載。";

export function summaryLine(
  label: string,
  value: unknown,
  positive = false,
  note = "",
): ClinicalSummaryLine {
  return {
    label,
    value: String(value ?? "").trim() || "—",
    positive,
    note: note.trim(),
  };
}
