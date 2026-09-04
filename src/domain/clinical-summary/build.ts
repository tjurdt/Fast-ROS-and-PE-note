import type { UserBundleTemplate } from "../bundle-templates";
import type { Patient } from "../patient";
import { specialtyLabel } from "../specialty";
import { buildBundleSummarySections } from "./bundles";
import { buildFindingSummarySections } from "./findings";
import {
  CLINICAL_SUMMARY_DISCLAIMER,
  type ClinicalSummaryDocument,
  type ClinicalSummaryMode,
} from "./model";
import {
  buildAdditionalNotesSection,
  buildAdmissionSummarySection,
  buildPmhSummarySection,
  buildTodoSummarySection,
} from "./workspace";

export interface BuildClinicalSummaryOptions {
  mode: ClinicalSummaryMode;
  now: Date;
}

function formatExportTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function demographics(patient: Patient): string {
  const values: string[] = [];
  if (patient.sex) values.push(patient.sex);
  if (patient.age) {
    values.push(`${patient.age}${/^\d+$/.test(patient.age) ? " 歲" : ""}`);
  }
  return values.join(" · ");
}

export function buildClinicalSummary(
  patient: Patient,
  userTemplates: readonly UserBundleTemplate[],
  options: BuildClinicalSummaryOptions,
): ClinicalSummaryDocument {
  const sections = buildBundleSummarySections(patient, userTemplates, options.now);
  sections.push(buildAdmissionSummarySection(patient));
  const pmh = buildPmhSummarySection(patient);
  if (pmh) sections.push(pmh);
  sections.push(...buildFindingSummarySections(patient, options.mode));
  sections.push(buildAdditionalNotesSection(patient));
  sections.push(buildTodoSummarySection(patient));

  return {
    title: "查房紀錄 ROS / PE Rounding Note",
    mode: options.mode,
    header: {
      patientCode: patient.code,
      demographics: demographics(patient),
      problem: patient.problem.trim(),
      specialty: specialtyLabel(patient.specialty),
      exportedAt: formatExportTime(options.now),
    },
    sections,
    disclaimer: CLINICAL_SUMMARY_DISCLAIMER,
  };
}
