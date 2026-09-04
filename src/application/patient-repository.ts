import type { PatientDatabase } from "../domain/patient-database";

export interface PatientRepository {
  load(): Promise<PatientDatabase>;
  save(database: PatientDatabase): Promise<void>;
}
