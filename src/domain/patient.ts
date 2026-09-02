import { z } from "zod";

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
    sensory: z.record(z.string(), z.unknown()).optional(),
    cn: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const GenderSchema = z.enum(["", "男 M", "女 F", "其他 Other"]);

export const TodoSchema = z
  .object({
    id: z.string().min(1),
    text: z.string(),
    status: z.enum(["pending", "done"]),
    important: z.boolean(),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

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
    blockNotes: z.record(z.string(), z.string()),
    todos: z.array(TodoSchema),
  })
  .strict();

export type Gender = z.infer<typeof GenderSchema>;
export type FindingValue = z.infer<typeof FindingValueSchema>;
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
    blockNotes: {},
    todos: [],
  });
}

export type PatientEditableFields = Pick<
  Patient,
  "code" | "specialty" | "sex" | "age" | "problem"
>;

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
