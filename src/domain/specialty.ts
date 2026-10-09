import { clinicalCatalog } from "./clinical/catalog";

/**
 * 急診不是 legacy catalog 的科別：它用「問題導向」的專屬題庫（src/domain/ed），
 * 所以在這裡補在清單最前面，不改動從 legacy 產生的 catalog。
 */
export const ED_SPECIALTY_KEY = "ed";

const ED_SPECIALTY = {
  key: ED_SPECIALTY_KEY,
  label: "ED 急診（問題導向）",
  focus: [] as string[],
};

export const SPECIALTIES = [ED_SPECIALTY, ...clinicalCatalog.specialties];

export function specialtyLabel(key: string): string {
  return SPECIALTIES.find((specialty) => specialty.key === key)?.label ?? key;
}

export function isEdPatient(patient: { specialty: string }): boolean {
  return patient.specialty === ED_SPECIALTY_KEY;
}
