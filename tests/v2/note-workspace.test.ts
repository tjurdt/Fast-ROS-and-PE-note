import { describe, expect, it } from "vitest";

import {
  ADL_LEVELS,
  ADMISSION_HABITS,
  AdmissionSchema,
  admissionFindingCount,
  createPastMedicalHistoryEntry,
  createTodo,
  isAdlDependent,
  nextAdlLevel,
  PMH_COMMON,
  sortTodos,
  TodoSchema,
} from "../../src/domain/note-workspace";
import { createPatient, updatePatientWorkspace } from "../../src/domain/patient";

describe("note workspace domain", () => {
  it("uses frozen legacy options", () => {
    expect(ADL_LEVELS).toHaveLength(3);
    expect(ADMISSION_HABITS).toEqual(["菸 Smoking", "酒 Alcohol", "檳榔 Betel"]);
    expect(PMH_COMMON).toHaveLength(25);
    expect(PMH_COMMON).toContain("高血壓 Hypertension");
  });

  it("creates and sorts todos by legacy priority", () => {
    const created = createTodo({ createId: () => "todo-new", now: () => 30 });
    const normalized = TodoSchema.parse({
      id: "todo-old",
      text: "old",
      status: "pending",
      important: true,
      createdAt: 10,
      futureField: "kept",
    });
    const ordered = sortTodos([
      { ...created, id: "done", status: "done", createdAt: 1 },
      created,
      normalized,
    ]);

    expect(created.status).toBe("todo");
    expect(normalized.status).toBe("todo");
    expect(normalized.futureField).toBe("kept");
    expect(ordered.map((todo) => todo.id)).toEqual(["todo-old", "todo-new", "done"]);
  });

  it("matches admission count and ADL rules", () => {
    const admission = AdmissionSchema.parse({
      habits: ["菸 Smoking"],
      drugAllergy: true,
      tocc: { t: "日本" },
      familyHx: "HTN",
    });

    expect(admissionFindingCount(admission)).toBe(4);
    expect(isAdlDependent({ level: ADL_LEVELS[0] ?? "" })).toBe(false);
    const dependent = nextAdlLevel(ADL_LEVELS[0] ?? "");
    expect(dependent).toBe(ADL_LEVELS[1]);
    expect(isAdlDependent({ level: dependent })).toBe(true);
    expect(nextAdlLevel(ADL_LEVELS[2] ?? "")).toBe(ADL_LEVELS[0]);
  });

  it("updates workspace immutably", () => {
    const patient = createPatient(
      { code: "TEST", specialty: "general", sex: "", age: "", problem: "" },
      { createId: () => "patient-1", now: () => 100 },
    );
    const pmh = [
      createPastMedicalHistoryEntry("高血壓 Hypertension", {
        createId: () => "pmh-1",
      }),
    ];
    const updated = updatePatientWorkspace(patient, { globalNote: "觀察中", pmh }, 200);

    expect(updated.globalNote).toBe("觀察中");
    expect(updated.pmh[0]?.text).toBe("高血壓 Hypertension");
    expect(updated.updatedAt).toBe(200);
    expect(patient.globalNote).toBe("");
    expect(patient.pmh).toEqual([]);
  });
});
