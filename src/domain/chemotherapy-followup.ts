import { z } from "zod";

import { calculateElapsedDay, type CalendarDayResult } from "./calendar-day";
import { clinicalCatalog } from "./clinical/catalog";

export const CHEMO_CYCLES = clinicalCatalog.bundles.chemo.cycles;
export const CHEMO_MULTI = clinicalCatalog.bundles.chemo.multi;
export const CHEMO_FLAGS = clinicalCatalog.bundles.chemo.flags;
export const NEUROPATHY_SITES = clinicalCatalog.bundles.chemo.neuropathySites;
export const NEUROPATHY_ROWS = clinicalCatalog.bundles.chemo.neuropathyRows;

export const NeuropathyStatusSchema = z.enum(["", "無明顯異常 None", "有異常 Present"]);

const StringFieldSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : (value ?? "")),
  z.string(),
);
const StringArrayFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);
const NeuropathyMatrixSchema = z.preprocess(
  (value) => value ?? {},
  z.record(z.string(), z.array(z.string())),
);

export const ChemotherapyFollowupSchema = z
  .object({
    notes: z.record(z.string(), z.string()).default({}),
    flags: StringArrayFieldSchema,
    regimen: StringFieldSchema,
    chemoDate: StringFieldSchema,
    temperature: StringFieldSchema,
    nauseaSymptoms: StringArrayFieldSchema,
    giImpact: StringFieldSchema,
    intakeImpact: StringFieldSchema,
    oralSymptoms: StringArrayFieldSchema,
    bowelSymptoms: StringArrayFieldSchema,
    fatigue: StringFieldSchema,
    neuropathyStatus: NeuropathyStatusSchema.default(""),
    neuropathyMatrix: NeuropathyMatrixSchema,
    skinFindings: StringArrayFieldSchema,
    infectionSigns: StringArrayFieldSchema,
    bleedingSigns: StringArrayFieldSchema,
    labs: StringFieldSchema,
    plan: StringFieldSchema,
    _multiV37: z.literal(true).default(true),
    _neuroMatrixV38: z.literal(true).default(true),
  })
  .passthrough();

export const ChemotherapyFollowupFieldSchema = z.preprocess(
  (value) => value ?? null,
  ChemotherapyFollowupSchema.nullable(),
);

export type NeuropathyStatus = z.infer<typeof NeuropathyStatusSchema>;
export type ChemotherapyFollowup = z.infer<typeof ChemotherapyFollowupSchema>;
export type ChemoCycleField = "giImpact" | "intakeImpact" | "fatigue";
export type ChemoMultiField =
  | "nauseaSymptoms"
  | "oralSymptoms"
  | "bowelSymptoms"
  | "skinFindings"
  | "infectionSigns"
  | "bleedingSigns"
  | "flags";

export function createChemotherapyFollowup(): ChemotherapyFollowup {
  return ChemotherapyFollowupSchema.parse({
    neuropathyMatrix: Object.fromEntries(NEUROPATHY_ROWS.map((row) => [row.key, []])),
  });
}

export function calculateChemotherapyDay(date: string, now: Date): CalendarDayResult {
  const elapsed = calculateElapsedDay(date, now);
  if (elapsed.status === "empty") return { ...elapsed, text: "Day —" };
  if (elapsed.days === undefined) return elapsed;
  const text = `D+${elapsed.days}`;
  return { ...elapsed, text, value: text };
}

export function chemotherapyTemperatureState(value: string): {
  tone: "empty" | "norm" | "danger";
  label: string;
} {
  if (value === "" || Number.isNaN(Number(value))) {
    return { tone: "empty", label: "未評估" };
  }
  return Number(value) >= 38
    ? { tone: "danger", label: "≥38°C 警訊" }
    : { tone: "norm", label: "已測量" };
}

export function cycleChemotherapyValue(
  current: string,
  field: ChemoCycleField,
): string {
  const options = CHEMO_CYCLES[field];
  if (!options) throw new Error(`Unknown chemotherapy cycle ${field}.`);
  const index = options.findIndex((option) => option.value === current);
  if (index < 0) return options[0]?.value ?? "";
  return index === options.length - 1 ? "" : (options[index + 1]?.value ?? "");
}

export function chemotherapyOptionTone(
  field: ChemoCycleField,
  value: string,
): "" | "norm" | "warn" | "danger" {
  return CHEMO_CYCLES[field]?.find((option) => option.value === value)?.tone ?? "";
}

export function toggleChemotherapyMultiValue(
  current: readonly string[],
  value: string,
  field: ChemoMultiField,
): string[] {
  const definition = field === "flags" ? null : CHEMO_MULTI[field];
  const normal = definition?.normal ?? null;
  const options =
    field === "flags" ? CHEMO_FLAGS : definition?.options.map((item) => item.value);
  if (!options?.includes(value)) {
    throw new Error(`Unknown chemotherapy ${field} option ${value}.`);
  }
  const values = [...new Set(current.filter(Boolean))];
  if (normal && value === normal) return values.includes(value) ? [] : [value];
  const withoutNormal = normal ? values.filter((item) => item !== normal) : values;
  return withoutNormal.includes(value)
    ? withoutNormal.filter((item) => item !== value)
    : [...withoutNormal, value];
}

function normalizedNeuropathyMatrix(
  matrix: Record<string, string[]>,
): Record<string, string[]> {
  const result = { ...matrix };
  const validSites = new Set(NEUROPATHY_SITES.map((site) => site.key));
  for (const row of NEUROPATHY_ROWS) {
    const allowedSites = row.sites ? new Set(row.sites) : validSites;
    result[row.key] = [
      ...new Set(
        (matrix[row.key] ?? []).filter(
          (site) => validSites.has(site) && allowedSites.has(site),
        ),
      ),
    ];
  }
  return result;
}

export function cycleNeuropathyStatus(
  followup: ChemotherapyFollowup,
): ChemotherapyFollowup {
  const statuses: NeuropathyStatus[] = ["", "無明顯異常 None", "有異常 Present"];
  const index = statuses.indexOf(followup.neuropathyStatus);
  const status = statuses[(index + 1) % statuses.length] ?? "";
  let neuropathyMatrix = normalizedNeuropathyMatrix(followup.neuropathyMatrix);
  if (status !== "有異常 Present") {
    neuropathyMatrix = {
      ...neuropathyMatrix,
      ...Object.fromEntries(NEUROPATHY_ROWS.map((row) => [row.key, []])),
    };
  }
  return ChemotherapyFollowupSchema.parse({
    ...followup,
    neuropathyStatus: status,
    neuropathyMatrix,
  });
}

export function toggleNeuropathyCell(
  followup: ChemotherapyFollowup,
  rowKey: string,
  siteKey: string,
): ChemotherapyFollowup {
  const row = NEUROPATHY_ROWS.find((candidate) => candidate.key === rowKey);
  if (!row) throw new Error(`Unknown neuropathy row ${rowKey}.`);
  if (!NEUROPATHY_SITES.some((site) => site.key === siteKey)) {
    throw new Error(`Unknown neuropathy site ${siteKey}.`);
  }
  if (row.sites && !row.sites.includes(siteKey)) {
    throw new Error(`Neuropathy row ${rowKey} does not support site ${siteKey}.`);
  }
  const matrix = normalizedNeuropathyMatrix(followup.neuropathyMatrix);
  const current = matrix[rowKey] ?? [];
  matrix[rowKey] = current.includes(siteKey)
    ? current.filter((site) => site !== siteKey)
    : [...current, siteKey];
  return ChemotherapyFollowupSchema.parse({
    ...followup,
    neuropathyStatus: "有異常 Present",
    neuropathyMatrix: matrix,
  });
}

export function chemotherapyHasNeuropathy(followup: ChemotherapyFollowup): boolean {
  const matrix = normalizedNeuropathyMatrix(followup.neuropathyMatrix);
  return NEUROPATHY_ROWS.some((row) => (matrix[row.key] ?? []).length > 0);
}
