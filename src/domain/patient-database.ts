import { z } from "zod";

import {
  UserBundleTemplatesFieldSchema,
  saveUserBundleTemplate,
  setUserBundleTemplateArchived,
  type UserBundleTemplate,
} from "./bundle-templates";
import { PatientSchema, type Patient } from "./patient";

export const V2_SCHEMA_VERSION = 2 as const;

export const PatientDatabaseSchema = z
  .object({
    schemaVersion: z.literal(V2_SCHEMA_VERSION),
    patients: z.array(PatientSchema),
    antibioticOptions: z.array(z.string()).default([]),
    customBundleTemplates: UserBundleTemplatesFieldSchema,
  })
  .strict();

export type PatientDatabase = z.infer<typeof PatientDatabaseSchema>;

export function emptyPatientDatabase(): PatientDatabase {
  return {
    schemaVersion: V2_SCHEMA_VERSION,
    patients: [],
    antibioticOptions: [],
    customBundleTemplates: [],
  };
}

export function upsertCustomBundleTemplate(
  database: PatientDatabase,
  template: UserBundleTemplate,
): PatientDatabase {
  return PatientDatabaseSchema.parse({
    ...database,
    customBundleTemplates: saveUserBundleTemplate(
      database.customBundleTemplates,
      template,
    ),
  });
}

export function archiveCustomBundleTemplate(
  database: PatientDatabase,
  templateId: string,
  archived: boolean,
): PatientDatabase {
  return PatientDatabaseSchema.parse({
    ...database,
    customBundleTemplates: setUserBundleTemplateArchived(
      database.customBundleTemplates,
      templateId,
      archived,
    ),
  });
}

export function addAntibioticOption(
  database: PatientDatabase,
  option: string,
): PatientDatabase {
  const normalized = option.trim();
  if (!normalized || database.antibioticOptions.includes(normalized)) return database;
  return PatientDatabaseSchema.parse({
    ...database,
    antibioticOptions: [...database.antibioticOptions, normalized],
  });
}

export function addPatient(
  database: PatientDatabase,
  patient: Patient,
): PatientDatabase {
  return PatientDatabaseSchema.parse({
    ...database,
    patients: [...database.patients, patient],
  });
}

export function replacePatient(
  database: PatientDatabase,
  patient: Patient,
): PatientDatabase {
  const index = database.patients.findIndex((candidate) => candidate.id === patient.id);
  if (index < 0) throw new Error(`Cannot update missing patient ${patient.id}.`);

  const patients = database.patients.slice();
  patients[index] = patient;
  return PatientDatabaseSchema.parse({ ...database, patients });
}
