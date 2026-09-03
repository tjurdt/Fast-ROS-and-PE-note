import { describe, expect, it } from "vitest";

import {
  createPatient,
  PatientSchema,
  updatePatientDetails,
} from "../../src/domain/patient";
import { DEFAULT_ADL_LEVEL } from "../../src/domain/note-workspace";

describe("patient domain", () => {
  it("creates a normalized patient with deterministic dependencies", () => {
    const patient = createPatient(
      {
        code: "  ",
        specialty: "general",
        sex: "女 F",
        age: " 72 ",
        problem: " CHF ",
      },
      { createId: () => "patient-1", now: () => 1234 },
    );

    expect(patient).toEqual({
      id: "patient-1",
      code: "（未命名）",
      specialty: "general",
      sex: "女 F",
      age: "72",
      problem: "CHF",
      createdAt: 1234,
      updatedAt: 1234,
      findings: {},
      globalNote: "",
      blockNotes: {},
      todos: [],
      pmh: [],
      admission: {
        habits: [],
        foodAllergy: false,
        foodAllergyNote: "",
        drugAllergy: false,
        drugAllergyNote: "",
        tocc: { t: "", o: "", c: "", cl: "" },
        recentAdm: false,
        recentAdmNote: "",
        familyHx: "",
      },
      adl: {
        level: DEFAULT_ADL_LEVEL,
        foreign: false,
        domestic: false,
        institution: false,
        family: false,
        instName: "",
        famName: "",
        note: "",
      },
    });
  });

  it("updates only editable details and advances updatedAt", () => {
    const original = createPatient(
      {
        code: "A-01",
        specialty: "general",
        sex: "",
        age: "",
        problem: "",
      },
      { createId: () => "patient-1", now: () => 100 },
    );

    const updated = updatePatientDetails(original, { problem: "Fever" }, 200);

    expect(updated.problem).toBe("Fever");
    expect(updated.createdAt).toBe(100);
    expect(updated.updatedAt).toBe(200);
    expect(original.problem).toBe("");
  });

  it("loads earlier v2 patients with safe workspace defaults", () => {
    const patient = PatientSchema.parse({
      id: "patient-legacy-v2",
      code: "OLD-V2",
      specialty: "general",
      sex: "",
      age: "",
      problem: "",
      createdAt: 1,
      updatedAt: 1,
      findings: {},
      blockNotes: {},
      todos: [
        {
          id: "todo-1",
          text: "舊狀態",
          status: "pending",
          important: false,
          createdAt: 1,
        },
      ],
    });

    expect(patient.globalNote).toBe("");
    expect(patient.pmh).toEqual([]);
    expect(patient.admission.habits).toEqual([]);
    expect(patient.adl.level).toBe(DEFAULT_ADL_LEVEL);
    expect(patient.todos[0]?.status).toBe("todo");
  });
});
