import { z } from "zod";

import { clinicalCatalog } from "./clinical/catalog";

export const ADL_LEVELS = clinicalCatalog.workspace.adlLevels;
export const PMH_COMMON = clinicalCatalog.workspace.pmhCommon;
export const ADMISSION_HABITS = clinicalCatalog.workspace.admissionHabits;

function firstOption(options: string[], name: string): string {
  const value = options[0];
  if (value === undefined) throw new Error(`${name} must not be empty.`);
  return value;
}

export const DEFAULT_ADL_LEVEL = firstOption(ADL_LEVELS, "ADL levels");

const TodoStatusSchema = z.preprocess(
  (value) => (value === "pending" ? "todo" : value),
  z.enum(["todo", "done"]),
);

export const TodoSchema = z
  .object({
    id: z.string().min(1),
    text: z.string(),
    status: TodoStatusSchema,
    important: z.boolean(),
    createdAt: z.number().int().nonnegative(),
  })
  .passthrough();

export const PastMedicalHistoryEntrySchema = z
  .object({
    id: z.string().min(1),
    text: z.string(),
  })
  .passthrough();

const ToccSchema = z
  .object({
    t: z.string().default(""),
    o: z.string().default(""),
    c: z.string().default(""),
    cl: z.string().default(""),
  })
  .passthrough();

export const AdmissionSchema = z
  .object({
    habits: z.array(z.string()).default([]),
    foodAllergy: z.boolean().default(false),
    foodAllergyNote: z.string().default(""),
    drugAllergy: z.boolean().default(false),
    drugAllergyNote: z.string().default(""),
    tocc: ToccSchema.default({ t: "", o: "", c: "", cl: "" }),
    recentAdm: z.boolean().default(false),
    recentAdmNote: z.string().default(""),
    familyHx: z.string().default(""),
  })
  .passthrough();

export const AdlSchema = z
  .object({
    level: z.string().default(DEFAULT_ADL_LEVEL),
    foreign: z.boolean().default(false),
    domestic: z.boolean().default(false),
    institution: z.boolean().default(false),
    family: z.boolean().default(false),
    instName: z.string().default(""),
    famName: z.string().default(""),
    note: z.string().default(""),
  })
  .passthrough();

export const AdmissionFieldSchema = z.preprocess(
  (value) => value ?? {},
  AdmissionSchema,
);
export const AdlFieldSchema = z.preprocess((value) => value ?? {}, AdlSchema);

export type Todo = z.infer<typeof TodoSchema>;
export type PastMedicalHistoryEntry = z.infer<typeof PastMedicalHistoryEntrySchema>;
export type Admission = z.infer<typeof AdmissionSchema>;
export type Adl = z.infer<typeof AdlSchema>;

export interface EntryFactoryDependencies {
  createId: () => string;
  now: () => number;
}

export function createTodo(dependencies: EntryFactoryDependencies): Todo {
  return TodoSchema.parse({
    id: dependencies.createId(),
    text: "",
    status: "todo",
    important: false,
    createdAt: dependencies.now(),
  });
}

export function createPastMedicalHistoryEntry(
  text: string,
  dependencies: Pick<EntryFactoryDependencies, "createId">,
): PastMedicalHistoryEntry {
  return PastMedicalHistoryEntrySchema.parse({
    id: dependencies.createId(),
    text,
  });
}

export function sortTodos(todos: readonly Todo[]): Todo[] {
  const tier = (todo: Todo) => (todo.status === "done" ? 2 : todo.important ? 0 : 1);
  return [...todos].sort(
    (left, right) => tier(left) - tier(right) || left.createdAt - right.createdAt,
  );
}

export function admissionFindingCount(admission: Admission): number {
  let count = 0;
  if (admission.habits.length > 0) count += 1;
  if (admission.foodAllergy) count += 1;
  if (admission.drugAllergy) count += 1;
  if (
    [admission.tocc.t, admission.tocc.o, admission.tocc.c, admission.tocc.cl].some(
      (value) => value.trim().length > 0,
    )
  ) {
    count += 1;
  }
  if (admission.recentAdm) count += 1;
  if (admission.familyHx.trim().length > 0) count += 1;
  return count;
}

export function isAdlDependent(adl: Pick<Adl, "level">): boolean {
  return adl.level.length > 0 && adl.level !== DEFAULT_ADL_LEVEL;
}

export function nextAdlLevel(current: string): string {
  const index = ADL_LEVELS.indexOf(current);
  return ADL_LEVELS[(index + 1) % ADL_LEVELS.length] ?? DEFAULT_ADL_LEVEL;
}
