import { describe, expect, it } from "vitest";

import { deletePatientInDatabase } from "../../src/application/patient-workflows";
import { createPatient, type Patient } from "../../src/domain/patient";
import { queryPatients } from "../../src/domain/patient-list";
import {
  addPatient,
  emptyPatientDatabase,
  type PatientDatabase,
} from "../../src/domain/patient-database";

function patient(id: string, code: string, updatedAt: number, problem = ""): Patient {
  return createPatient(
    {
      code,
      specialty: id === "patient-2" ? "neuro" : "general",
      sex: "",
      age: "",
      problem,
    },
    { createId: () => id, now: () => updatedAt },
  );
}

function database(...patients: Patient[]): PatientDatabase {
  return patients.reduce(addPatient, emptyPatientDatabase());
}

describe("patient list rules", () => {
  it("defaults to recently updated patients without mutating the source array", () => {
    const source = [
      patient("patient-1", "Bed 10", 100),
      patient("patient-2", "Bed 2", 300),
      patient("patient-3", "Ward A", 200),
    ];

    const result = queryPatients(source, { search: "", sort: "updated-desc" });

    expect(result.map((item) => item.id)).toEqual([
      "patient-2",
      "patient-3",
      "patient-1",
    ]);
    expect(source.map((item) => item.id)).toEqual([
      "patient-1",
      "patient-2",
      "patient-3",
    ]);
  });

  it("supports oldest and natural patient-code ordering", () => {
    const source = [
      patient("patient-1", "Bed 10", 100),
      patient("patient-2", "bed 2", 300),
      patient("patient-3", "Ward A", 200),
    ];

    expect(
      queryPatients(source, { search: "", sort: "updated-asc" }).map((item) => item.id),
    ).toEqual(["patient-1", "patient-3", "patient-2"]);
    expect(
      queryPatients(source, { search: "", sort: "code-asc" }).map((item) => item.id),
    ).toEqual(["patient-2", "patient-1", "patient-3"]);
  });

  it("matches every normalized term across code, problem, and specialty", () => {
    const source = [
      patient("patient-1", "Bed 10", 100, "Pneumonia"),
      patient("patient-2", "Bed 2", 300, "Stroke follow-up"),
    ];

    expect(
      queryPatients(source, { search: "  BED   stroke ", sort: "updated-desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["patient-2"]);
    expect(
      queryPatients(source, { search: "神經", sort: "updated-desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["patient-2"]);
  });

  it("deletes only the selected patient and preserves database-wide settings", () => {
    const original = {
      ...database(
        patient("patient-1", "Bed 1", 100),
        patient("patient-2", "Bed 2", 200),
      ),
      antibioticOptions: ["Custom antibiotic"],
    };

    const deleted = deletePatientInDatabase(original, "patient-1");

    expect(deleted.patients.map((item) => item.id)).toEqual(["patient-2"]);
    expect(deleted.antibioticOptions).toEqual(["Custom antibiotic"]);
    expect(original.patients).toHaveLength(2);
    expect(deletePatientInDatabase(deleted, "missing-patient")).toBe(deleted);
  });
});
