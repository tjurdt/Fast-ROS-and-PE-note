import { describe, expect, it } from "vitest";

import { createPatient } from "../../src/domain/patient";
import { addPatient, emptyPatientDatabase } from "../../src/domain/patient-database";
import {
  LocalPatientRepository,
  StorageDataError,
  V2_LOCAL_STORAGE_KEY,
} from "../../src/infrastructure/storage/local-patient-repository";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
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
});
