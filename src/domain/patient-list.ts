import type { Patient } from "./patient";
import { specialtyLabel } from "./specialty";

export type PatientSortMode = "updated-desc" | "updated-asc" | "code-asc";

export interface PatientListQuery {
  search: string;
  sort: PatientSortMode;
}

const codeCollator = new Intl.Collator("zh-Hant", {
  numeric: true,
  sensitivity: "base",
});

function compareUpdated(left: Patient, right: Patient, direction: 1 | -1): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt < right.updatedAt ? -direction : direction;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -direction : direction;
  }
  return codeCollator.compare(left.id, right.id);
}

function searchablePatientText(patient: Patient): string {
  return [
    patient.code || "未命名",
    patient.problem,
    specialtyLabel(patient.specialty),
    patient.sex,
    patient.age,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function queryPatients(
  patients: readonly Patient[],
  query: PatientListQuery,
): Patient[] {
  const terms = query.search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const filtered = patients.filter((patient) => {
    if (terms.length === 0) return true;
    const searchable = searchablePatientText(patient);
    return terms.every((term) => searchable.includes(term));
  });

  return filtered.sort((left, right) => {
    if (query.sort === "updated-asc") return compareUpdated(left, right, 1);
    if (query.sort === "code-asc") {
      const codeOrder = codeCollator.compare(left.code, right.code);
      return codeOrder || compareUpdated(left, right, -1);
    }
    return compareUpdated(left, right, -1);
  });
}
