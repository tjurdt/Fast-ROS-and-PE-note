import { z } from "zod";

import { clinicalCatalog } from "./clinical/catalog";

export const POSTOP_CYCLES = clinicalCatalog.bundles.postop.cycles;
export const POSTOP_MULTI = clinicalCatalog.bundles.postop.multi;

const StringFieldSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : (value ?? "")),
  z.string(),
);
const StringArrayFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);

export const PostopDrainSchema = z
  .object({
    id: z.string().min(1),
    site: StringFieldSchema,
    amount: StringFieldSchema,
    period: StringFieldSchema,
    patency: StringFieldSchema,
    characterFindings: StringArrayFieldSchema,
    surroundFindings: StringArrayFieldSchema,
    note: StringFieldSchema,
  })
  .passthrough();

export const PostoperativeCareSchema = z
  .object({
    notes: z.record(z.string(), z.string()).default({}),
    drains: z.array(PostopDrainSchema).default([]),
    surgery: StringFieldSchema,
    surgeryDate: StringFieldSchema,
    pain: StringFieldSchema,
    vitals: StringFieldSchema,
    fever: StringFieldSchema,
    oralDiet: StringFieldSchema,
    nutritionSupport: StringArrayFieldSchema,
    nauseaSymptoms: StringArrayFieldSchema,
    activity: StringFieldSchema,
    flatus: StringFieldSchema,
    voidingMethod: StringFieldSchema,
    urinaryConcerns: StringArrayFieldSchema,
    respiratorySupport: StringFieldSchema,
    respiratoryConcerns: StringArrayFieldSchema,
    woundFindings: StringArrayFieldSchema,
    vteMeasures: StringArrayFieldSchema,
    redFlags: StringArrayFieldSchema,
    plan: StringFieldSchema,
    _multiV37: z.literal(true).default(true),
  })
  .passthrough();

export const PostoperativeCareFieldSchema = z.preprocess(
  (value) => value ?? null,
  PostoperativeCareSchema.nullable(),
);

export type PostopDrain = z.infer<typeof PostopDrainSchema>;
export type PostoperativeCare = z.infer<typeof PostoperativeCareSchema>;
export type PostopStringField =
  | "surgery"
  | "surgeryDate"
  | "pain"
  | "vitals"
  | "fever"
  | "oralDiet"
  | "activity"
  | "flatus"
  | "voidingMethod"
  | "respiratorySupport"
  | "plan";
export type PostopMultiField =
  | "nutritionSupport"
  | "nauseaSymptoms"
  | "urinaryConcerns"
  | "respiratoryConcerns"
  | "woundFindings"
  | "vteMeasures"
  | "redFlags";

export interface PostopFactoryDependencies {
  createId: () => string;
}

export function createPostoperativeCare(): PostoperativeCare {
  return PostoperativeCareSchema.parse({});
}

export function createPostopDrain(
  dependencies: PostopFactoryDependencies,
): PostopDrain {
  return PostopDrainSchema.parse({ id: dependencies.createId() });
}

export function cyclePostopValue(current: string, cycleKey: string): string {
  const options = POSTOP_CYCLES[cycleKey];
  if (!options) throw new Error(`Unknown postoperative cycle ${cycleKey}.`);
  const index = options.findIndex((option) => option.value === current);
  if (index < 0) return options[0]?.value ?? "";
  return index === options.length - 1 ? "" : (options[index + 1]?.value ?? "");
}

export function togglePostopMultiValue(
  current: readonly string[],
  value: string,
  multiKey: string,
): string[] {
  const definition = POSTOP_MULTI[multiKey];
  if (!definition) throw new Error(`Unknown postoperative multi field ${multiKey}.`);
  if (!definition.options.some((option) => option.value === value)) {
    throw new Error(`Unknown ${multiKey} option ${value}.`);
  }
  const values = [...new Set(current.filter(Boolean))];
  if (definition.normal && value === definition.normal) {
    return values.includes(value) ? [] : [value];
  }
  const withoutNormal = definition.normal
    ? values.filter((item) => item !== definition.normal)
    : values;
  return withoutNormal.includes(value)
    ? withoutNormal.filter((item) => item !== value)
    : [...withoutNormal, value];
}

export function postoperativeOptionTone(
  definitionKey: string,
  value: string,
  type: "cycle" | "multi",
): "" | "norm" | "warn" | "danger" {
  const options =
    type === "cycle"
      ? POSTOP_CYCLES[definitionKey]
      : POSTOP_MULTI[definitionKey]?.options;
  return options?.find((option) => option.value === value)?.tone ?? "";
}
