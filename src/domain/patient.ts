import { z } from "zod";

import { FindingValueSchema } from "./clinical/finding";
import type { FindingValue } from "./clinical/finding";
import {
  AdlFieldSchema,
  AdmissionFieldSchema,
  PastMedicalHistoryEntrySchema,
  TodoSchema,
  type Adl,
  type Admission,
  type PastMedicalHistoryEntry,
  type Todo,
} from "./note-workspace";

export { FindingValueSchema } from "./clinical/finding";
export type { FindingValue } from "./clinical/finding";

export const GenderSchema = z.enum(["", "男 M", "女 F", "其他 Other"]);

export { TodoSchema } from "./note-workspace";
export type { Adl, Admission, PastMedicalHistoryEntry, Todo } from "./note-workspace";

export const PatientSchema = z
  .object({
    id: z.string().min(1),
    code: z.string(),
    specialty: z.string().min(1),
    sex: GenderSchema,
    age: z.string(),
    problem: z.string(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    findings: z.record(z.string(), FindingValueSchema),
    globalNote: z.string().default(""),
    blockNotes: z.record(z.string(), z.string()).default({}),
    todos: z.array(TodoSchema).default([]),
    pmh: z.array(PastMedicalHistoryEntrySchema).default([]),
    admission: AdmissionFieldSchema,
    adl: AdlFieldSchema,
  })
  .strict();

export type Gender = z.infer<typeof GenderSchema>;
export type Patient = z.infer<typeof PatientSchema>;

export interface PatientDraft {
  code: string;
  specialty: string;
  sex: Gender;
  age: string;
  problem: string;
}

export interface PatientFactoryDependencies {
  createId: () => string;
  now: () => number;
}

export function createPatient(
  draft: PatientDraft,
  dependencies: PatientFactoryDependencies,
): Patient {
  const timestamp = dependencies.now();
  return PatientSchema.parse({
    id: dependencies.createId(),
    code: draft.code.trim() || "（未命名）",
    specialty: draft.specialty.trim() || "general",
    sex: draft.sex,
    age: draft.age.trim(),
    problem: draft.problem.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    findings: {},
    globalNote: "",
    blockNotes: {},
    todos: [],
    pmh: [],
    admission: {},
    adl: {},
  });
}

export type PatientEditableFields = Pick<
  Patient,
  "code" | "specialty" | "sex" | "age" | "problem"
>;

export interface PatientWorkspaceFields {
  globalNote: string;
  blockNotes: Record<string, string>;
  todos: Todo[];
  pmh: PastMedicalHistoryEntry[];
  admission: Admission;
  adl: Adl;
}

export function updatePatientDetails(
  patient: Patient,
  patch: Partial<PatientEditableFields>,
  now: number,
): Patient {
  return PatientSchema.parse({
    ...patient,
    ...patch,
    updatedAt: now,
  });
}

export function updatePatientFinding(
  patient: Patient,
  itemId: string,
  finding: FindingValue,
  now: number,
): Patient {
  return PatientSchema.parse({
    ...patient,
    findings: {
      ...patient.findings,
      [itemId]: FindingValueSchema.parse(finding),
    },
    updatedAt: now,
  });
}

export function updatePatientWorkspace(
  patient: Patient,
  patch: Partial<PatientWorkspaceFields>,
  now: number,
): Patient {
  return PatientSchema.parse({
    ...patient,
    ...patch,
    updatedAt: now,
  });
}
