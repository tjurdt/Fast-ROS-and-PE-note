import { z } from "zod";

const FollowUpSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("text"), label: z.string() }).strict(),
  z
    .object({
      id: z.string(),
      type: z.literal("select"),
      label: z.string(),
      opts: z.array(z.string()),
    })
    .strict(),
  z.object({ id: z.string(), type: z.literal("toggle"), label: z.string() }).strict(),
]);

const ItemCommonSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["ROS", "PE"]),
  system: z.string().min(1),
  label: z.string(),
  en: z.string(),
});

const ToggleItemSchema = ItemCommonSchema.extend({
  type: z.literal("toggle"),
  star: z.boolean(),
  fu: z.array(FollowUpSchema).nullable(),
}).passthrough();

const SelectItemSchema = ItemCommonSchema.extend({
  type: z.literal("select"),
  opts: z.array(z.string()).min(1),
  normal: z.string(),
  star: z.boolean(),
  fu: z.array(FollowUpSchema).nullable(),
  fuOn: z.string().nullable(),
}).passthrough();

const GroupFieldSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    opts: z.array(z.string()).min(1),
    normal: z.string(),
  })
  .strict();

const GroupItemSchema = ItemCommonSchema.extend({
  type: z.literal("group"),
  fields: z.array(GroupFieldSchema).min(1),
  star: z.boolean(),
  total: z.number().nullable(),
}).passthrough();

const TextItemSchema = ItemCommonSchema.extend({
  type: z.literal("text"),
}).passthrough();

const CustomItemSchema = ItemCommonSchema.extend({
  type: z.literal("custom"),
  custom: z.string(),
  star: z.boolean(),
}).passthrough();

export const ClinicalItemSchema = z.discriminatedUnion("type", [
  ToggleItemSchema,
  SelectItemSchema,
  GroupItemSchema,
  TextItemSchema,
  CustomItemSchema,
]);

export const ClinicalSectionSchema = z
  .object({
    key: z.string().min(1),
    kind: z.enum(["ROS", "PE"]),
    label: z.string(),
    gate: z.enum(["gyn", "obs"]).optional(),
    items: z.array(ClinicalItemSchema),
  })
  .strict();

export const ClinicalSpecialtySchema = z
  .object({
    key: z.string().min(1),
    label: z.string(),
    focus: z.array(z.string()),
  })
  .strict();

export const ClinicalCatalogSchema = z
  .object({
    sections: z.array(ClinicalSectionSchema),
    specialties: z.array(ClinicalSpecialtySchema),
  })
  .strict();

export type ClinicalItem = z.infer<typeof ClinicalItemSchema>;
export type ClinicalSection = z.infer<typeof ClinicalSectionSchema>;
export type ClinicalSpecialty = z.infer<typeof ClinicalSpecialtySchema>;
export type ClinicalCatalog = z.infer<typeof ClinicalCatalogSchema>;
export type FollowUp = z.infer<typeof FollowUpSchema>;
