import { z } from "zod";

import { clinicalCatalog } from "./catalog";

export const DTR_SITES = clinicalCatalog.widgets.dtr.sites;
export const DTR_GRADES = clinicalCatalog.widgets.dtr.grades;
export const PLANTAR_OPTIONS = clinicalCatalog.widgets.plantar.options;
export const SENSORY_STATUS_OPTIONS = clinicalCatalog.widgets.sensory.statuses;
export const SENSORY_SIDE_OPTIONS = clinicalCatalog.widgets.sensory.sides;
export const SENSORY_CHANGE_OPTIONS = clinicalCatalog.widgets.sensory.changes;
export const SENSORY_PATTERN_OPTIONS = clinicalCatalog.widgets.sensory.patterns;
export const SENSORY_MODALITY_OPTIONS = clinicalCatalog.widgets.sensory.modalities;

export const SensoryFindingSchema = z
  .object({
    id: z.string().default(""),
    side: z.string().default(""),
    change: z.string().default(""),
    pattern: z.string().default(""),
    modalities: z.array(z.string()).default([]),
    location: z.string().default(""),
    note: z.string().default(""),
  })
  .passthrough();

export const SensoryStateSchema = z
  .object({
    status: z.string().default(""),
    findings: z.array(SensoryFindingSchema).default([]),
  })
  .passthrough();

export const CranialNerveStateSchema = z
  .object({
    abn: z.boolean().optional(),
    grid: z.record(z.string(), z.boolean()).optional(),
    mono: z.array(z.string()).optional(),
    note: z.string().optional(),
  })
  .passthrough();

export const FindingValueSchema = z
  .object({
    on: z.boolean().optional(),
    sel: z.string().optional(),
    text: z.string().optional(),
    grp: z.record(z.string(), z.string()).optional(),
    fu: z.record(z.string(), z.string()).optional(),
    note: z.string().optional(),
    dtr: z.record(z.string(), z.string()).optional(),
    plantar: z.record(z.string(), z.string()).optional(),
    sensory: SensoryStateSchema.optional(),
    cn: z.record(z.string(), CranialNerveStateSchema).optional(),
  })
  .passthrough();

export type FindingValue = z.infer<typeof FindingValueSchema>;
export type SensoryFinding = z.infer<typeof SensoryFindingSchema>;
export type SensoryState = z.infer<typeof SensoryStateSchema>;
export type CranialNerveState = z.infer<typeof CranialNerveStateSchema>;

export function nextCycleValue(
  values: readonly string[],
  current: string | undefined,
): string {
  const index = values.indexOf(current ?? "");
  return values[(index + 1) % values.length] ?? values[0] ?? "";
}
