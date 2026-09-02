import { describe, expect, it } from "vitest";

import { createPatient, updatePatientDetails } from "../../src/domain/patient";

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
      blockNotes: {},
      todos: [],
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
});
