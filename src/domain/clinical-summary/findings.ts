import { DTR_SITES, PLANTAR_OPTIONS, type FindingValue } from "../clinical/finding";
import { buildClinicalView, hasFinding } from "../clinical/clinical-rules";
import type { ClinicalItem, FollowUp } from "../clinical/catalog-schema";
import type { Patient } from "../patient";
import {
  summaryLine,
  type ClinicalSummaryLine,
  type ClinicalSummaryMode,
  type ClinicalSummarySection,
} from "./model";

function itemLabel(item: ClinicalItem): string {
  return item.en ? `${item.en}（${item.label}）` : item.label;
}

function followUpParts(
  definitions: readonly FollowUp[] | null,
  finding: FindingValue,
): string[] {
  if (!definitions) return [];
  return definitions.flatMap((definition) => {
    const value = finding.fu?.[definition.id] ?? "";
    if (definition.type === "toggle") {
      return value === "1" ? [`${definition.label}(+)`] : [];
    }
    return value.trim() ? [`${definition.label}: ${value.trim()}`] : [];
  });
}

function cranialNerveParts(
  item: Extract<ClinicalItem, { type: "select" }>,
  finding: FindingValue,
): string[] {
  if (!item.cnPanel) return [];
  return item.cnPanel.flatMap((definition) => {
    const state = finding.cn?.[definition.id];
    if (!state?.abn) return [];
    const segments: string[] = [];
    for (const side of definition.sides) {
      const selectedSides = [
        state.grid?.[`${side.k}_L`] ? "L" : "",
        state.grid?.[`${side.k}_R`] ? "R" : "",
      ].filter(Boolean);
      if (selectedSides.length > 0) {
        segments.push(`${side.l}(${selectedSides.join("/")})`);
      }
    }
    segments.push(...(state.mono ?? []));
    if (state.note?.trim()) segments.push(state.note.trim());
    return [
      `${definition.label}${segments.length > 0 ? `：${segments.join("、")}` : "：異常"}`,
    ];
  });
}

function dtrValue(finding: FindingValue): { value: string; positive: boolean } {
  const values = finding.dtr ?? {};
  const parts: string[] = [];
  let positive = false;
  for (const site of DTR_SITES) {
    const left = values[`${site.key}_L`] ?? "";
    const right = values[`${site.key}_R`] ?? "";
    if (!left && !right) continue;
    parts.push(`${site.label.split(" ")[0]} L${left || "–"}/R${right || "–"}`);
    if ((left && left !== "2+") || (right && right !== "2+")) positive = true;
  }
  return { value: parts.join("；") || "未評估", positive };
}

function sensoryValue(finding: FindingValue): { value: string; positive: boolean } {
  const sensory = finding.sensory;
  const status = sensory?.status ?? "";
  const positive = status === "異常 Abnormal";
  if (!positive || !sensory || sensory.findings.length === 0) {
    return { value: status || "未評估", positive };
  }
  const entries = sensory.findings.map((entry, index) => {
    const parts = [
      entry.side,
      entry.change,
      entry.modalities.join("/"),
      entry.pattern,
      entry.location,
    ].filter(Boolean);
    if (entry.note.trim()) parts.push(`註：${entry.note.trim()}`);
    return `#${index + 1} ${parts.join("｜") || "未描述"}`;
  });
  return { value: `${status}｜${entries.join("；")}`, positive };
}

export function clinicalItemSummaryLine(
  item: ClinicalItem,
  finding: FindingValue = {},
): ClinicalSummaryLine {
  let value = "";
  let positive = false;

  if (item.type === "toggle") {
    positive = finding.on === true;
    value = positive ? "(+) 陽性" : "(−) 陰性";
    if (positive) {
      const parts = followUpParts(item.fu, finding);
      if (parts.length > 0) value += `｜${parts.join("；")}`;
    }
  } else if (item.type === "select") {
    value = finding.sel || "未評估";
    positive = Boolean(finding.sel && finding.sel !== item.normal);
    if (finding.sel === item.fuOn) {
      const parts = followUpParts(item.fu, finding);
      if (parts.length > 0) value += `｜${parts.join("；")}`;
    }
    const cranialNerves = cranialNerveParts(item, finding);
    if (cranialNerves.length > 0) {
      value += `｜異常 → ${cranialNerves.join("；")}`;
      positive = true;
    }
  } else if (item.type === "group") {
    const values = finding.grp ?? {};
    value = item.fields
      .map((field) => `${field.label}${values[field.id] || "–"}`)
      .join("");
    if (item.total && item.fields.every((field) => values[field.id])) {
      const total = item.fields.reduce(
        (sum, field) => sum + Number.parseInt(values[field.id] ?? "0", 10),
        0,
      );
      value += ` (${total})`;
    }
    positive = item.fields.some(
      (field) => values[field.id] && values[field.id] !== field.normal,
    );
  } else if (item.type === "text") {
    value = finding.text?.trim() || "—";
    positive = Boolean(finding.text?.trim());
  } else if (item.custom === "dtr") {
    ({ value, positive } = dtrValue(finding));
  } else if (item.custom === "plantar") {
    const left = finding.plantar?.L || "未評估";
    const right = finding.plantar?.R || "未評估";
    value = `左 ${left} / 右 ${right}`;
    positive = ["L", "R"].some((side) => {
      const selected = finding.plantar?.[side];
      return Boolean(selected && selected !== PLANTAR_OPTIONS[0]);
    });
  } else if (item.custom === "sensory") {
    ({ value, positive } = sensoryValue(finding));
  } else {
    value = "未評估";
  }

  return summaryLine(itemLabel(item), value, positive, finding.note ?? "");
}

function sectionTitle(label: string, kind: "ROS" | "PE"): string {
  const match = label.match(/^(.+?)\s+([A-Za-z].*)$/);
  if (!match) return `${label} · ${kind}`;
  return `${match[2]}（${match[1]}） · ${kind}`;
}

export function buildFindingSummarySections(
  patient: Patient,
  mode: ClinicalSummaryMode,
): ClinicalSummarySection[] {
  const alwaysInclude = new Set(["ros_const", "pe_general"]);
  const sections: ClinicalSummarySection[] = [];

  for (const section of buildClinicalView(patient)) {
    const note = patient.blockNotes[section.key]?.trim() ?? "";
    let items = section.items;
    if (mode === "limited" && !section.focus && !alwaysInclude.has(section.key)) {
      items = items.filter((item) => hasFinding(item, patient.findings[item.id]));
    }
    if (items.length === 0 && !note) continue;
    sections.push({
      id: `clinical-${section.key}`,
      title: section.focus ? section.label : sectionTitle(section.label, section.kind),
      note,
      lines: items.map((item) =>
        clinicalItemSummaryLine(item, patient.findings[item.id]),
      ),
    });
  }
  return sections;
}
