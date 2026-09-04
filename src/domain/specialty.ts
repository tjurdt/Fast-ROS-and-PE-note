import { clinicalCatalog } from "./clinical/catalog";

export const SPECIALTIES = clinicalCatalog.specialties;

export function specialtyLabel(key: string): string {
  return SPECIALTIES.find((specialty) => specialty.key === key)?.label ?? key;
}
