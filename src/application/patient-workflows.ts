import {
  createPatient,
  updatePatientDetails,
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
