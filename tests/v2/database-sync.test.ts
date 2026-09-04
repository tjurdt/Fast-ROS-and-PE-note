import { describe, expect, it } from "vitest";

import {
  makeDatabaseSyncBase,
  mergePatientDatabases,
  patientDatabasesEqual,
} from "../../src/domain/database-sync";
import {
  createPatient,
  updatePatientDetails,
  type Patient,
} from "../../src/domain/patient";
import {
  addPatient,
  emptyPatientDatabase,
  replacePatient,
  type PatientDatabase,
} from "../../src/domain/patient-database";

function patient(id: string, problem = ""): Patient {
  return createPatient(
    { code: id.toUpperCase(), specialty: "general", sex: "", age: "", problem },
    { createId: () => id, now: () => 100 },
  );
}

function database(...patients: Patient[]): PatientDatabase {
  return patients.reduce(addPatient, emptyPatientDatabase());
}

describe("database three-way synchronization", () => {
  it("merges independent patient changes from both devices", () => {
    const first = patient("patient-1");
    const second = patient("patient-2");
    const baseDatabase = database(first, second);
    const local = replacePatient(
      baseDatabase,
      updatePatientDetails(first, { problem: "local edit" }, 200),
    );
    const remote = replacePatient(
      baseDatabase,
      updatePatientDetails(second, { problem: "remote edit" }, 300),
    );

    const result = mergePatientDatabases(
      local,
      remote,
      makeDatabaseSyncBase(baseDatabase),
    );

    expect(result.conflicts).toEqual([]);
    expect(result.database.patients.find((item) => item.id === first.id)?.problem).toBe(
      "local edit",
    );
    expect(
      result.database.patients.find((item) => item.id === second.id)?.problem,
    ).toBe("remote edit");
  });

  it("uses the active local patient on a true conflict and reports backup metadata", () => {
    const original = patient("patient-1");
    const baseDatabase = database(original);
    const local = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "local" }, 200),
    );
    const remote = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "remote" }, 300),
    );

    const result = mergePatientDatabases(
      local,
      remote,
      makeDatabaseSyncBase(baseDatabase),
    );

    expect(result.database.patients[0]?.problem).toBe("local");
    expect(result.conflicts).toEqual([
      {
        type: "patient",
        id: "patient-1",
        localPresent: true,
        remotePresent: true,
      },
    ]);
  });

  it("preserves intentional deletion when the opposite side stayed at the base", () => {
    const original = patient("patient-1");
    const baseDatabase = database(original);

    const localDeletion = mergePatientDatabases(
      emptyPatientDatabase(),
      baseDatabase,
      makeDatabaseSyncBase(baseDatabase),
    );
    const remoteDeletion = mergePatientDatabases(
      baseDatabase,
      emptyPatientDatabase(),
      makeDatabaseSyncBase(baseDatabase),
    );

    expect(localDeletion.database.patients).toEqual([]);
    expect(remoteDeletion.database.patients).toEqual([]);
    expect(localDeletion.conflicts).toEqual([]);
    expect(remoteDeletion.conflicts).toEqual([]);
  });

  it("uses an additive first merge when no common base exists", () => {
    const local = {
      ...database(patient("local-patient")),
      antibioticOptions: ["Local-X"],
    };
    const remote = {
      ...database(patient("remote-patient")),
      antibioticOptions: ["Remote-X"],
    };

    const result = mergePatientDatabases(local, remote, null);

    expect(result.database.patients.map((item) => item.id)).toEqual([
      "local-patient",
      "remote-patient",
    ]);
    expect(result.database.antibioticOptions).toEqual(["Local-X", "Remote-X"]);
    expect(result.conflicts).toEqual([]);
  });

  it("detects global conflicts while allowing a one-sided global update", () => {
    const baseDatabase = emptyPatientDatabase();
    const local = { ...baseDatabase, antibioticOptions: ["Local-X"] };
    const remote = { ...baseDatabase, antibioticOptions: ["Remote-X"] };

    const conflict = mergePatientDatabases(
      local,
      remote,
      makeDatabaseSyncBase(baseDatabase),
    );
    const remoteOnly = mergePatientDatabases(
      baseDatabase,
      remote,
      makeDatabaseSyncBase(baseDatabase),
    );

    expect(conflict.database.antibioticOptions).toEqual(["Local-X"]);
    expect(conflict.conflicts).toEqual([{ type: "globals" }]);
    expect(remoteOnly.database.antibioticOptions).toEqual(["Remote-X"]);
    expect(patientDatabasesEqual(remoteOnly.database, remote)).toBe(true);
  });
});
