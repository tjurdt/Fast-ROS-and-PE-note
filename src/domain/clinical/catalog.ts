import rawCatalog from "./catalog.generated.json";
import {
  ClinicalCatalogSchema,
  type ClinicalItem,
  type ClinicalSection,
  type ClinicalSpecialty,
} from "./catalog-schema";

export const clinicalCatalog = ClinicalCatalogSchema.parse(rawCatalog);

export const clinicalItemIndex = new Map<
  string,
  { item: ClinicalItem; section: ClinicalSection }
>();
for (const section of clinicalCatalog.sections) {
  for (const item of section.items) {
    clinicalItemIndex.set(item.id, { item, section });
  }
}

export const clinicalSpecialtyIndex = new Map<string, ClinicalSpecialty>(
  clinicalCatalog.specialties.map((specialty) => [specialty.key, specialty]),
);
