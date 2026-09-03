import {
  createPatient,
  updatePatientBundles,
  updatePatientFinding,
  updatePatientDetails,
  updatePatientWorkspace,
  type FindingValue,
  type Patient,
  type PatientBundleFields,
  type PatientDraft,
  type PatientEditableFields,
  type PatientFactoryDependencies,
  type PatientWorkspaceFields,
} from "../domain/patient";
import { applyPmhAutoBundles } from "../domain/bundles";
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

export function updateWorkspaceInDatabase(
  database: PatientDatabase,
  patient: Patient,
  patch: Partial<PatientWorkspaceFields>,
  now: number,
): CreatePatientResult {
  let updated = updatePatientWorkspace(patient, patch, now);
  if (patch.pmh) {
    const automatic = applyPmhAutoBundles(
      updated.customSets,
      updated.autoTriggered,
      patch.pmh,
    );
    if (automatic.addedIds.length > 0) {
      updated = updatePatientBundles(
        updated,
        {
          customSets: automatic.instances,
          autoTriggered: automatic.triggered,
        },
        now,
      );
    }
  }
  return { database: replacePatient(database, updated), patient: updated };
}

export function updateBundlesInDatabase(
  database: PatientDatabase,
  patient: Patient,
  patch: Partial<PatientBundleFields>,
  now: number,
): CreatePatientResult {
  const updated = updatePatientBundles(patient, patch, now);
  return { database: replacePatient(database, updated), patient: updated };
}
