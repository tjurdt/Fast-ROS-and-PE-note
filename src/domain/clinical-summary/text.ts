import type { ClinicalSummaryDocument } from "./model";

export function renderClinicalSummaryText(summary: ClinicalSummaryDocument): string {
  const { header } = summary;
  const lines = [summary.title, `病人代號：${header.patientCode}`];
  if (header.demographics) lines.push(`基本資料：${header.demographics}`);
  if (header.problem) lines.push(`主要問題：${header.problem}`);
  lines.push(`科別：${header.specialty}`);
  lines.push(`匯出時間：${header.exportedAt}`);
  lines.push(
    summary.mode === "limited"
      ? "（限縮版：重點＋陽性/異常＋備註）"
      : "（完整版：全部項目）",
  );
  lines.push("=".repeat(40));

  for (const section of summary.sections) {
    lines.push("", `【${section.title}】`);
    if (section.note) lines.push(`  § 區塊備註：${section.note}`);
    for (const line of section.lines) {
      const note = line.note ? `　※${line.note}` : "";
      lines.push(
        line.label
          ? `  ${line.positive ? "●" : "○"} ${line.label}：${line.value}${note}`
          : `  ${line.value}${note}`,
      );
    }
  }

  lines.push("", "=".repeat(40), summary.disclaimer);
  return lines.join("\n");
}

export function clinicalSummaryFilename(summary: ClinicalSummaryDocument): string {
  const safeCode =
    summary.header.patientCode.trim().replace(/[^\p{L}\p{N}._-]+/gu, "_") || "patient";
  const stamp = summary.header.exportedAt.replace(/[^0-9]/g, "").slice(0, 12);
  const mode = summary.mode === "limited" ? "limited" : "full";
  return `ROS_PE_${safeCode}_${stamp}_${mode}.txt`;
}
