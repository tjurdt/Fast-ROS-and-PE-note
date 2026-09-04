import { z } from "zod";

import { BUILTIN_BUNDLE_TEMPLATES } from "./bundles";

export const USER_BUNDLE_FIELD_TYPES = [
  { value: "toggle", label: "是非（陽性／陰性）", needsOptions: false },
  { value: "select", label: "單選", needsOptions: true },
  { value: "multi", label: "多選", needsOptions: true },
  { value: "chips", label: "單列複選（勾選框）", needsOptions: true },
  { value: "days", label: "每週複選（W1–W7）", needsOptions: false },
  { value: "text", label: "文字", needsOptions: false },
  { value: "date", label: "日期", needsOptions: false },
] as const;

export const UserBundleFieldTypeSchema = z.enum([
  "toggle",
  "select",
  "multi",
  "chips",
  "days",
  "text",
  "date",
]);

const StringArrayFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(z.string()),
);

export const UserBundleFieldSchema = z
  .object({
    id: z.string().min(1),
    type: UserBundleFieldTypeSchema,
    label: z.string().default(""),
    options: StringArrayFieldSchema,
    archived: z.boolean().default(false),
  })
  .passthrough();

export const UserBundleTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().default(""),
    fields: z.array(UserBundleFieldSchema).default([]),
    archived: z.boolean().default(false),
  })
  .passthrough();

export const UserBundleTemplatesFieldSchema = z.preprocess(
  (value) => value ?? [],
  z.array(UserBundleTemplateSchema),
);

export type UserBundleFieldType = z.infer<typeof UserBundleFieldTypeSchema>;
export type UserBundleField = z.infer<typeof UserBundleFieldSchema>;
export type UserBundleTemplate = z.infer<typeof UserBundleTemplateSchema>;

export interface UserBundleFactoryDependencies {
  createId: () => string;
}

export class UserBundleTemplateValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("；"));
    this.name = "UserBundleTemplateValidationError";
    this.issues = issues;
  }
}

const RESERVED_TEMPLATE_IDS = new Set(
  BUILTIN_BUNDLE_TEMPLATES.map((template) => template.id),
);

export function userBundleFieldNeedsOptions(type: UserBundleFieldType): boolean {
  return (
    USER_BUNDLE_FIELD_TYPES.find((candidate) => candidate.value === type)
      ?.needsOptions ?? false
  );
}

export function parseUserBundleOptions(value: string): string[] {
  return value.split(/\r?\n/);
}

export function createUserBundleTemplate(
  dependencies: UserBundleFactoryDependencies,
): UserBundleTemplate {
  return UserBundleTemplateSchema.parse({ id: dependencies.createId() });
}

export function createUserBundleField(
  dependencies: UserBundleFactoryDependencies,
): UserBundleField {
  return UserBundleFieldSchema.parse({
    id: dependencies.createId(),
    type: "toggle",
  });
}

export function normalizeUserBundleTemplate(
  template: UserBundleTemplate,
): UserBundleTemplate {
  return UserBundleTemplateSchema.parse({
    ...template,
    id: template.id.trim(),
    name: template.name.trim(),
    fields: template.fields.map((field) => ({
      ...field,
      id: field.id.trim(),
      label: field.label.trim(),
      options: userBundleFieldNeedsOptions(field.type)
        ? [...new Set(field.options.map((option) => option.trim()).filter(Boolean))]
        : [],
    })),
  });
}

export function userBundleTemplateIssues(template: UserBundleTemplate): string[] {
  const issues: string[] = [];
  if (!template.name.trim()) issues.push("請輸入組套名稱");
  if (RESERVED_TEMPLATE_IDS.has(template.id)) {
    issues.push("組套識別碼與內建組套重複");
  }

  const ids = new Set<string>();
  template.fields.forEach((field, index) => {
    if (ids.has(field.id)) issues.push(`欄位 ${index + 1} 的識別碼重複`);
    ids.add(field.id);
    if (field.archived) return;
    if (!field.label.trim()) issues.push(`請輸入欄位 ${index + 1} 的名稱`);
    if (
      userBundleFieldNeedsOptions(field.type) &&
      !field.options.some((option) => option.trim())
    ) {
      issues.push(`欄位 ${index + 1} 至少需要一個選項`);
    }
  });
  return issues;
}

export function saveUserBundleTemplate(
  templates: readonly UserBundleTemplate[],
  draft: UserBundleTemplate,
): UserBundleTemplate[] {
  const issues = userBundleTemplateIssues(draft);
  if (issues.length > 0) throw new UserBundleTemplateValidationError(issues);
  const normalized = normalizeUserBundleTemplate(draft);
  const matches = templates.filter((template) => template.id === normalized.id);
  if (matches.length > 1) {
    throw new UserBundleTemplateValidationError(["既有組套識別碼不唯一"]);
  }
  return UserBundleTemplatesFieldSchema.parse(
    matches.length === 1
      ? templates.map((template) =>
          template.id === normalized.id ? normalized : template,
        )
      : [...templates, normalized],
  );
}

export function setUserBundleTemplateArchived(
  templates: readonly UserBundleTemplate[],
  templateId: string,
  archived: boolean,
): UserBundleTemplate[] {
  if (!templates.some((template) => template.id === templateId)) {
    throw new Error(`Cannot archive missing user bundle template ${templateId}.`);
  }
  return UserBundleTemplatesFieldSchema.parse(
    templates.map((template) =>
      template.id === templateId ? { ...template, archived } : template,
    ),
  );
}

export function updateUserBundleField(
  template: UserBundleTemplate,
  fieldId: string,
  patch: Partial<Pick<UserBundleField, "label" | "type" | "options">>,
): UserBundleTemplate {
  if (!template.fields.some((field) => field.id === fieldId)) {
    throw new Error(`Cannot update missing user bundle field ${fieldId}.`);
  }
  return UserBundleTemplateSchema.parse({
    ...template,
    fields: template.fields.map((field) =>
      field.id === fieldId ? { ...field, ...patch } : field,
    ),
  });
}

export function setUserBundleFieldArchived(
  template: UserBundleTemplate,
  fieldId: string,
  archived: boolean,
): UserBundleTemplate {
  if (!template.fields.some((field) => field.id === fieldId)) {
    throw new Error(`Cannot archive missing user bundle field ${fieldId}.`);
  }
  return UserBundleTemplateSchema.parse({
    ...template,
    fields: template.fields.map((field) =>
      field.id === fieldId ? { ...field, archived } : field,
    ),
  });
}

export function moveUserBundleField(
  template: UserBundleTemplate,
  fieldId: string,
  direction: -1 | 1,
): UserBundleTemplate {
  const activeIndexes = template.fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !field.archived)
    .map(({ index }) => index);
  const currentActiveIndex = activeIndexes.findIndex(
    (index) => template.fields[index]?.id === fieldId,
  );
  const targetIndex = activeIndexes[currentActiveIndex + direction];
  const currentIndex = activeIndexes[currentActiveIndex];
  if (currentIndex === undefined || targetIndex === undefined) return template;

  const fields = template.fields.slice();
  const current = fields[currentIndex];
  const target = fields[targetIndex];
  if (!current || !target) return template;
  fields[currentIndex] = target;
  fields[targetIndex] = current;
  return UserBundleTemplateSchema.parse({ ...template, fields });
}
