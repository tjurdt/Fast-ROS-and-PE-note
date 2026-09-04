import { z } from "zod";

import {
  PatientDatabaseSchema,
  V2_SCHEMA_VERSION,
  type PatientDatabase,
} from "./patient-database";

export const DatabaseSyncBaseSchema = z
  .object({
    patientHashes: z.record(z.string(), z.string()),
    globalsHash: z.string(),
  })
  .strict();

export const SyncCacheRecordSchema = z
  .object({
    formatVersion: z.literal(1),
    database: PatientDatabaseSchema,
    base: DatabaseSyncBaseSchema.nullable(),
    remoteRevision: z.string().nullable(),
    dirty: z.boolean(),
    localRevision: z.number().int().nonnegative(),
    savedAt: z.number().int().nonnegative(),
    lastSyncedAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type DatabaseSyncBase = z.infer<typeof DatabaseSyncBaseSchema>;
export type SyncCacheRecord = z.infer<typeof SyncCacheRecordSchema>;

export type DatabaseSyncConflict =
  | {
      type: "patient";
      id: string;
      localPresent: boolean;
      remotePresent: boolean;
    }
  | { type: "globals" };

export interface DatabaseMergeResult {
  database: PatientDatabase;
  conflicts: DatabaseSyncConflict[];
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function databaseGlobals(database: PatientDatabase) {
  return {
    schemaVersion: database.schemaVersion,
    antibioticOptions: database.antibioticOptions,
    customBundleTemplates: database.customBundleTemplates,
  };
}

function patientHashes(database: PatientDatabase): Record<string, string> {
  return Object.fromEntries(
    database.patients.map((patient) => [patient.id, stableSerialize(patient)]),
  );
}

export function makeDatabaseSyncBase(database: PatientDatabase): DatabaseSyncBase {
  return {
    patientHashes: patientHashes(database),
    globalsHash: stableSerialize(databaseGlobals(database)),
  };
}

export function patientDatabasesEqual(
  left: PatientDatabase,
  right: PatientDatabase,
): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function mergeWithoutBase(
  local: PatientDatabase,
  remote: PatientDatabase,
): DatabaseMergeResult {
  const conflicts: DatabaseSyncConflict[] = [];
  const remotePatients = new Map(
    remote.patients.map((patient) => [patient.id, patient]),
  );
  const localPatients = new Map(local.patients.map((patient) => [patient.id, patient]));
  const patientIds = [
    ...new Set([
      ...local.patients.map((patient) => patient.id),
      ...remote.patients.map((patient) => patient.id),
    ]),
  ];
  const patients = patientIds.flatMap((id) => {
    const localPatient = localPatients.get(id);
    const remotePatient = remotePatients.get(id);
    if (
      localPatient &&
      remotePatient &&
      stableSerialize(localPatient) !== stableSerialize(remotePatient)
    ) {
      conflicts.push({
        type: "patient",
        id,
        localPresent: true,
        remotePresent: true,
      });
    }
    return localPatient ?? remotePatient ?? [];
  });

  const antibioticOptions = [
    ...new Set([...local.antibioticOptions, ...remote.antibioticOptions]),
  ];
  const remoteTemplates = new Map(
    remote.customBundleTemplates.map((template) => [template.id, template]),
  );
  const localTemplates = new Map(
    local.customBundleTemplates.map((template) => [template.id, template]),
  );
  const templateIds = [
    ...new Set([
      ...local.customBundleTemplates.map((template) => template.id),
      ...remote.customBundleTemplates.map((template) => template.id),
    ]),
  ];
  const customBundleTemplates = templateIds.flatMap((id) => {
    const localTemplate = localTemplates.get(id);
    const remoteTemplate = remoteTemplates.get(id);
    if (
      localTemplate &&
      remoteTemplate &&
      stableSerialize(localTemplate) !== stableSerialize(remoteTemplate)
    ) {
      if (!conflicts.some((conflict) => conflict.type === "globals")) {
        conflicts.push({ type: "globals" });
      }
    }
    return localTemplate ?? remoteTemplate ?? [];
  });

  return {
    database: PatientDatabaseSchema.parse({
      schemaVersion: V2_SCHEMA_VERSION,
      patients,
      antibioticOptions,
      customBundleTemplates,
    }),
    conflicts,
  };
}

export function mergePatientDatabases(
  local: PatientDatabase,
  remote: PatientDatabase,
  base: DatabaseSyncBase | null,
): DatabaseMergeResult {
  if (!base) return mergeWithoutBase(local, remote);

  const conflicts: DatabaseSyncConflict[] = [];
  const localPatients = new Map(local.patients.map((patient) => [patient.id, patient]));
  const remotePatients = new Map(
    remote.patients.map((patient) => [patient.id, patient]),
  );
  const patientIds = [
    ...new Set([
      ...local.patients.map((patient) => patient.id),
      ...remote.patients.map((patient) => patient.id),
      ...Object.keys(base.patientHashes),
    ]),
  ];
  const patients = patientIds.flatMap((id) => {
    const localPatient = localPatients.get(id);
    const remotePatient = remotePatients.get(id);
    const localHash = localPatient ? stableSerialize(localPatient) : null;
    const remoteHash = remotePatient ? stableSerialize(remotePatient) : null;
    const baseHash = base.patientHashes[id] ?? null;
    const localChanged = localHash !== baseHash;
    const remoteChanged = remoteHash !== baseHash;

    if (localChanged && remoteChanged && localHash !== remoteHash) {
      conflicts.push({
        type: "patient",
        id,
        localPresent: Boolean(localPatient),
        remotePresent: Boolean(remotePatient),
      });
      return localPatient ?? [];
    }
    if (localChanged) return localPatient ?? [];
    if (remoteChanged) return remotePatient ?? [];
    return localPatient ?? remotePatient ?? [];
  });

  const localGlobals = databaseGlobals(local);
  const remoteGlobals = databaseGlobals(remote);
  const localGlobalsHash = stableSerialize(localGlobals);
  const remoteGlobalsHash = stableSerialize(remoteGlobals);
  const localGlobalsChanged = localGlobalsHash !== base.globalsHash;
  const remoteGlobalsChanged = remoteGlobalsHash !== base.globalsHash;
  let globals = localGlobals;
  if (
    localGlobalsChanged &&
    remoteGlobalsChanged &&
    localGlobalsHash !== remoteGlobalsHash
  ) {
    conflicts.push({ type: "globals" });
  } else if (remoteGlobalsChanged && !localGlobalsChanged) {
    globals = remoteGlobals;
  }

  return {
    database: PatientDatabaseSchema.parse({ ...globals, patients }),
    conflicts,
  };
}
