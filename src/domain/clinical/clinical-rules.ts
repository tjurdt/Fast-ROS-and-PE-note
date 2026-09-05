import type { FindingValue, Patient } from "../patient";
import { clinicalCatalog, clinicalItemIndex, clinicalSpecialtyIndex } from "./catalog";
import type { ClinicalItem, ClinicalSection } from "./catalog-schema";

export interface ClinicalViewSection {
  key: string;
  kind: "ROS" | "PE";
  label: string;
  focus: boolean;
  items: ClinicalItem[];
}

export function isSectionVisible(
  section: ClinicalSection,
  patient: Pick<Patient, "sex" | "specialty">,
): boolean {
  if (section.gate === undefined) return true;
  const isFemale = patient.sex === "女 F";
  if (section.gate === "gyn") {
    return isFemale || patient.specialty === "gyn" || patient.specialty === "obs";
  }
  return patient.specialty === "obs";
}

export function effectiveFocusIds(patient: Pick<Patient, "specialty">): string[] {
  const focus = clinicalSpecialtyIndex.get(patient.specialty)?.focus ?? [];
  return focus.filter(
    (itemId) => itemId !== "pe_sensory" || patient.specialty === "neuro",
  );
}

export function buildClinicalView(
  patient: Pick<Patient, "sex" | "specialty">,
): ClinicalViewSection[] {
  const focusIds = effectiveFocusIds(patient);
  const focusSet = new Set(focusIds);
  const visibleItem = (item: ClinicalItem) => {
    const section = clinicalItemIndex.get(item.id)?.section;
    return section ? isSectionVisible(section, patient) : true;
  };
  const sections: ClinicalViewSection[] = [];

  for (const kind of ["ROS", "PE"] as const) {
    const items = focusIds
      .map((itemId) => clinicalItemIndex.get(itemId)?.item)
      .filter((item): item is ClinicalItem => item !== undefined)
      .filter((item) => item.kind === kind && visibleItem(item));
    if (items.length > 0) {
      sections.push({
        key: `focus_${kind.toLowerCase()}`,
        kind,
        label: `★ Focus ${kind}（重點${kind === "ROS" ? "問診" : "理學檢查"}）`,
        focus: true,
        items,
      });
    }
  }

  for (const section of clinicalCatalog.sections) {
    if (!isSectionVisible(section, patient)) continue;
    sections.push({
      key: section.key,
      kind: section.kind,
      label: section.label,
      focus: false,
      items: section.items.filter((item) => !focusSet.has(item.id)),
    });
  }

  return sections;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function objectValues(value: unknown): unknown[] {
  return value !== null && typeof value === "object"
    ? Object.values(value as Record<string, unknown>)
    : [];
}

export function hasFinding(item: ClinicalItem, finding: FindingValue = {}): boolean {
  if (item.type === "toggle" && finding.on) return true;
  if (item.type === "select" && nonEmpty(finding.sel) && finding.sel !== item.normal) {
    return true;
  }
  if (
    item.type === "group" &&
    item.fields.some((field) => {
      const value = finding.grp?.[field.id];
      return nonEmpty(value) && value !== field.normal;
    })
  ) {
    return true;
  }
  if (item.type === "text" && nonEmpty(finding.text)) return true;
  if (
    item.type === "custom" &&
    item.custom === "dtr" &&
    Object.values(finding.dtr ?? {}).some((value) => nonEmpty(value) && value !== "2+")
  ) {
    return true;
  }
  if (
    item.type === "custom" &&
    item.custom === "plantar" &&
    ["L", "R"].some((side) => {
      const value = finding.plantar?.[side];
      return nonEmpty(value) && value !== "屈曲↓ (正常)";
    })
  ) {
    return true;
  }
  if (
    item.type === "custom" &&
    item.custom === "sensory" &&
    finding.sensory?.status === "異常 Abnormal"
  ) {
    return true;
  }

  if (
    objectValues(finding.cn).some((cranialNerve) => {
      if (cranialNerve === null || typeof cranialNerve !== "object") return false;
      const state = cranialNerve as Record<string, unknown>;
      return Boolean(state.abn) || nonEmpty(state.note);
    })
  ) {
    return true;
  }

  return nonEmpty(finding.note);
}

export function countFindings(patient: Patient): number {
  const seen = new Set<string>();
  let count = 0;
  for (const section of buildClinicalView(patient)) {
    for (const item of section.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (hasFinding(item, patient.findings[item.id])) count += 1;
    }
  }
  return count;
}

/** Same as countFindings, scoped to just the ROS or just the PE sections --
 * used for the per-kind badge on the patient note's top-level ROS/PE tabs. */
export function countFindingsByKind(patient: Patient, kind: "ROS" | "PE"): number {
  const seen = new Set<string>();
  let count = 0;
  for (const section of buildClinicalView(patient)) {
    if (section.kind !== kind) continue;
    for (const item of section.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (hasFinding(item, patient.findings[item.id])) count += 1;
    }
  }
  return count;
}
