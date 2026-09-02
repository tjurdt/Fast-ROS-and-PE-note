import {
  createPatient,
  updatePatientFinding,
  updatePatientDetails,
  type FindingValue,
  type Patient,
  type PatientDraft,
  type PatientEditableFields,
  type PatientFactoryDependencies,
} from "../domain/patient";
import {
  addPatient,
  replacePatient,
  type PatientDatabase,
} from "../domain/patient-database";

export interface CreatePatientResult {
  database: PatientDatabase;
  patient: Patient;
}

export function createPatientInDatabase(
  database: PatientDatabase,
  draft: PatientDraft,
  dependencies: PatientFactoryDependencies,
): CreatePatientResult {
  const patient = createPatient(draft, dependencies);
  return { database: addPatient(database, patient), patient };
}

export function updatePatientInDatabase(
  database: PatientDatabase,
  patient: Patient,
  patch: Partial<PatientEditableFields>,
  now: number,
): CreatePatientResult {
  const updated = updatePatientDetails(patient, patch, now);
  return { database: replacePatient(database, updated), patient: updated };
}

export function updateFindingInDatabase(
  database: PatientDatabase,
  patient: Patient,
  itemId: string,
  finding: FindingValue,
  now: number,
): CreatePatientResult {
  const updated = updatePatientFinding(patient, itemId, finding, now);
  return { database: replacePatient(database, updated), patient: updated };
}
