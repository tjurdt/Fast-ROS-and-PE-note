import { z } from "zod";

import { clinicalCatalog } from "./clinical/catalog";
import type { BundleField, BundleTemplate } from "./clinical/catalog-schema";

export const LQQ_QUALITIES = clinicalCatalog.bundles.lqq.qualities;
export const LQQ_ONSETS = clinicalCatalog.bundles.lqq.onsets;
export const DNR_OPTIONS = clinicalCatalog.bundles.dnrOptions;
export const DIALYSIS_DAYS = clinicalCatalog.bundles.dialysisDays;
export const BUILTIN_BUNDLE_TEMPLATES = clinicalCatalog.bundles.builtinSets;

export const DIALYSIS_BUNDLE_ID = "sys_dialysis" as const;
export const DNR_BUNDLE_ID = "sys_orders" as const;
export const DNR_MASTER_FIELD_ID = "f_sys_orders_0" as const;
export const DNR_STATES_FIELD_ID = "f_sys_orders_1" as const;

export const LqqEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().default(""),
    L: z.string().default(""),
    quality: z.array(z.string()).default([]),
    qnote: z.string().default(""),
    sev: z.number().int().min(0).max(10).nullable().default(null),
    onset: z.string().default(""),
    onsetText: z.string().default(""),
    P: z.string().default(""),
    E: z.string().default(""),
    R: z.string().default(""),
    A: z.string().default(""),
  })
  .passthrough();

export const BundleInstanceSchema = z
  .object({
    __notes: z.record(z.string(), z.string()).default({}),
    __setNote: z.string().default(""),
  })
  .passthrough();

export const LqqEntriesFieldSchema = z
  .preprocess((value) => value ?? [], z.array(LqqEntrySchema))
  .default([]);
export const CustomBundleInstancesFieldSchema = z
  .preprocess(
    (value) => value ?? {},
    z.record(
      z.string(),
      z.preprocess((value) => value ?? {}, BundleInstanceSchema),
    ),
  )
  .default({});
export const AutoTriggeredBundlesFieldSchema = z
  .preprocess((value) => value ?? {}, z.record(z.string(), z.boolean()))
  .default({});

export type LqqEntry = z.infer<typeof LqqEntrySchema>;
export type BundleInstance = z.infer<typeof BundleInstanceSchema>;
export type CustomBundleInstances = z.infer<typeof CustomBundleInstancesFieldSchema>;
export type AutoTriggeredBundles = z.infer<typeof AutoTriggeredBundlesFieldSchema>;
export type DnrState = "" | "agree" | "disagree";

export type RenderableBundleField = BundleField & { archived?: boolean };

export interface RenderableBundleTemplate {
  id: string;
  name: string;
  fields: readonly RenderableBundleField[];
  builtin?: true;
  archived?: boolean;
}

export interface LqqFactoryDependencies {
  createId: () => string;
}

export function createLqqEntry(dependencies: LqqFactoryDependencies): LqqEntry {
  return LqqEntrySchema.parse({ id: dependencies.createId() });
}

export function findBuiltinBundleTemplate(
  templateId: string,
): BundleTemplate | undefined {
  return BUILTIN_BUNDLE_TEMPLATES.find((template) => template.id === templateId);
}

export function activateBundle(
  instances: CustomBundleInstances,
  templateId: string,
): CustomBundleInstances {
  return activateTemplateBundle(instances, BUILTIN_BUNDLE_TEMPLATES, templateId);
}

export function activateTemplateBundle(
  instances: CustomBundleInstances,
  templates: readonly RenderableBundleTemplate[],
  templateId: string,
): CustomBundleInstances {
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template || template.archived) {
    throw new Error(`Cannot activate unavailable bundle ${templateId}.`);
  }
  if (instances[templateId]) return instances;
  return CustomBundleInstancesFieldSchema.parse({
    ...instances,
    [templateId]: {},
  });
}

export function removeBundle(
  instances: CustomBundleInstances,
  templateId: string,
): CustomBundleInstances {
  const remaining = { ...instances };
  delete remaining[templateId];
  return CustomBundleInstancesFieldSchema.parse(remaining);
}

export function updateBundleInstance(
  instances: CustomBundleInstances,
  templateId: string,
  update: (instance: BundleInstance) => BundleInstance,
): CustomBundleInstances {
  const current = instances[templateId];
  if (!current) throw new Error(`Cannot update inactive bundle ${templateId}.`);
  return CustomBundleInstancesFieldSchema.parse({
    ...instances,
    [templateId]: update(current),
  });
}

export function setBundleField(
  instance: BundleInstance,
  fieldId: string,
  value: unknown,
): BundleInstance {
  return BundleInstanceSchema.parse({ ...instance, [fieldId]: value });
}

export function setBundleFieldNote(
  instance: BundleInstance,
  fieldId: string,
  note: string,
): BundleInstance {
  return BundleInstanceSchema.parse({
    ...instance,
    __notes: { ...instance.__notes, [fieldId]: note },
  });
}

export function toggleBundleArrayValue(
  instance: BundleInstance,
  fieldId: string,
  value: string,
  order?: readonly string[],
): BundleInstance {
  const current = instance[fieldId];
  const values = Array.isArray(current)
    ? current.filter((item): item is string => typeof item === "string")
    : [];
  const next = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
  if (order) {
    next.sort((left, right) => order.indexOf(left) - order.indexOf(right));
  }
  return setBundleField(instance, fieldId, next);
}

function normalizeLegacyDnrSelections(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (option): option is string =>
        typeof option === "string" && DNR_OPTIONS.includes(option),
    );
  }
  if (value === "DNR / DNI") return DNR_OPTIONS.slice(0, 2);
  if (value === "DNR") return DNR_OPTIONS.slice(0, 1);
  if (value === "DNI") return DNR_OPTIONS.slice(1, 2);
  return [];
}

export function dnrStateMap(
  value: unknown,
  masterOn: boolean,
): Record<string, DnrState> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      DNR_OPTIONS.map((option) => {
        const state = record[option];
        return [option, state === "agree" || state === "disagree" ? state : ""];
      }),
    );
  }
  const selected = normalizeLegacyDnrSelections(value);
  return Object.fromEntries(
    DNR_OPTIONS.map((option) => [
      option,
      selected.includes(option) ? "agree" : masterOn ? "" : "",
    ]),
  );
}

export function setDnrMaster(
  instance: BundleInstance,
  enabled: boolean,
): BundleInstance {
  const rawStates = instance[DNR_STATES_FIELD_ID];
  const states = dnrStateMap(rawStates, enabled);
  const hasExisting = Object.values(states).some(
    (state) => state === "agree" || state === "disagree",
  );
  if (enabled && !hasExisting) {
    for (const option of DNR_OPTIONS) states[option] = "agree";
  }
  return BundleInstanceSchema.parse({
    ...instance,
    [DNR_MASTER_FIELD_ID]: enabled,
    [DNR_STATES_FIELD_ID]: states,
  });
}

export function cycleDnrState(
  instance: BundleInstance,
  option: string,
): BundleInstance {
  if (!DNR_OPTIONS.includes(option)) throw new Error(`Unknown DNR option ${option}.`);
  const states = dnrStateMap(
    instance[DNR_STATES_FIELD_ID],
    instance[DNR_MASTER_FIELD_ID] === true,
  );
  const current = states[option] ?? "";
  states[option] =
    current === "agree" ? "disagree" : current === "disagree" ? "" : "agree";
  return setBundleField(instance, DNR_STATES_FIELD_ID, states);
}

export interface AutoBundleResult {
  instances: CustomBundleInstances;
  triggered: AutoTriggeredBundles;
  addedIds: string[];
}

export function applyPmhAutoBundles(
  instances: CustomBundleInstances,
  triggered: AutoTriggeredBundles,
  pmhEntries: readonly { text: string }[],
): AutoBundleResult {
  const pmhText = pmhEntries
    .map((entry) => entry.text)
    .join(" ")
    .toLowerCase();
  if (!pmhText.trim()) return { instances, triggered, addedIds: [] };

  let nextInstances = instances;
  let nextTriggered = triggered;
  const addedIds: string[] = [];
  for (const template of BUILTIN_BUNDLE_TEMPLATES) {
    if (!template.auto) continue;
    if (nextInstances[template.id] || nextTriggered[template.id]) continue;
    if (
      template.auto.pmh.some((keyword) => pmhText.includes(keyword.toLocaleLowerCase()))
    ) {
      nextInstances = activateBundle(nextInstances, template.id);
      nextTriggered = { ...nextTriggered, [template.id]: true };
      addedIds.push(template.id);
    }
  }
  return { instances: nextInstances, triggered: nextTriggered, addedIds };
}
