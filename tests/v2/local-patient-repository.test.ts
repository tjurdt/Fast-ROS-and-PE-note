import { describe, expect, it } from "vitest";

import { createPatient } from "../../src/domain/patient";
import {
  addAntibioticOption,
  addPatient,
  emptyPatientDatabase,
} from "../../src/domain/patient-database";
import {
  LocalPatientRepository,
  StorageDataError,
  V2_LOCAL_STORAGE_KEY,
} from "../../src/infrastructure/storage/local-patient-repository";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();
  readError: Error | null = null;
  writeError: Error | null = null;

  getItem(key: string): string | null {
    if (this.readError) throw this.readError;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.writeError) throw this.writeError;
    this.values.set(key, value);
  }
}

describe("LocalPatientRepository", () => {
  it("round-trips a validated v2 database", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalPatientRepository(storage);
    const patient = createPatient(
      {
        code: "TEST-01",
        specialty: "general",
        sex: "",
        age: "",
        problem: "",
      },
      { createId: () => "patient-1", now: () => 100 },
    );
    const database = addPatient(emptyPatientDatabase(), patient);

    await repository.save(database);

    expect(await repository.load()).toEqual(database);
    expect(storage.values.has(V2_LOCAL_STORAGE_KEY)).toBe(true);
  });

  it("does not overwrite malformed stored data", async () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_LOCAL_STORAGE_KEY, "{not-json");
    const repository = new LocalPatientRepository(storage);

    await expect(repository.load()).rejects.toBeInstanceOf(StorageDataError);
    expect(storage.getItem(V2_LOCAL_STORAGE_KEY)).toBe("{not-json");
  });

  it("maps blocked browser reads and writes without losing prior data", async () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_LOCAL_STORAGE_KEY, JSON.stringify(emptyPatientDatabase()));
    const repository = new LocalPatientRepository(storage);

    storage.readError = new DOMException("blocked", "SecurityError");
    await expect(repository.load()).rejects.toBeInstanceOf(StorageDataError);

    storage.readError = null;
    storage.writeError = new DOMException("quota", "QuotaExceededError");
    await expect(repository.save(emptyPatientDatabase())).rejects.toBeInstanceOf(
      StorageDataError,
    );
    storage.writeError = null;
    expect(storage.getItem(V2_LOCAL_STORAGE_KEY)).toBe(
      JSON.stringify(emptyPatientDatabase()),
    );
  });

  it("loads earlier v2 patients with workspace defaults without rewriting source", async () => {
    const storage = new MemoryStorage();
    const serialized = JSON.stringify({
      schemaVersion: 2,
      patients: [
        {
          id: "patient-old-v2",
          code: "OLD-V2",
          specialty: "general",
          sex: "",
          age: "",
          problem: "",
          createdAt: 1,
          updatedAt: 1,
          findings: {},
          blockNotes: {},
          todos: [],
        },
      ],
    });
    storage.setItem(V2_LOCAL_STORAGE_KEY, serialized);
    const repository = new LocalPatientRepository(storage);

    const loaded = await repository.load();

    expect(loaded.patients[0]?.globalNote).toBe("");
    expect(loaded.patients[0]?.pmh).toEqual([]);
    expect(loaded.patients[0]?.admission.habits).toEqual([]);
    expect(loaded.patients[0]?.lqq).toEqual([]);
    expect(loaded.patients[0]?.customSets).toEqual({});
    expect(loaded.patients[0]?.postop).toBeNull();
    expect(loaded.patients[0]?.infections).toEqual([]);
    expect(loaded.patients[0]?.chemo).toBeNull();
    expect(loaded.antibioticOptions).toEqual([]);
    expect(loaded.customBundleTemplates).toEqual([]);
    expect(storage.getItem(V2_LOCAL_STORAGE_KEY)).toBe(serialized);
  });

  it("stores trimmed custom antibiotic options once", () => {
    const database = emptyPatientDatabase();
    const added = addAntibioticOption(database, "  Custom-X  ");
    const duplicate = addAntibioticOption(added, "Custom-X");

    expect(added.antibioticOptions).toEqual(["Custom-X"]);
    expect(duplicate).toBe(added);
  });
});
