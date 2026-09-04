import type { PatientRepository } from "../../application/patient-repository";
import {
  emptyPatientDatabase,
  PatientDatabaseSchema,
  type PatientDatabase,
} from "../../domain/patient-database";

export const V2_LOCAL_STORAGE_KEY = "pe_note_v2";

function browserLocalStorage(): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}

export class StorageDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageDataError";
  }
}

export class LocalPatientRepository implements PatientRepository {
  readonly #storage: Pick<Storage, "getItem" | "setItem">;

  constructor(storage: Pick<Storage, "getItem" | "setItem"> = browserLocalStorage()) {
    this.#storage = storage;
  }

  async load(): Promise<PatientDatabase> {
    try {
      const serialized = this.#storage.getItem(V2_LOCAL_STORAGE_KEY);
      if (serialized === null) return emptyPatientDatabase();
      return PatientDatabaseSchema.parse(JSON.parse(serialized));
    } catch (error) {
      throw new StorageDataError("無法讀取 v2 本機資料；原始內容尚未被覆寫。", {
        cause: error,
      });
    }
  }

  async save(database: PatientDatabase): Promise<void> {
    const validated = PatientDatabaseSchema.parse(database);
    try {
      this.#storage.setItem(V2_LOCAL_STORAGE_KEY, JSON.stringify(validated));
    } catch (error) {
      throw new StorageDataError("瀏覽器無法儲存 v2 資料。", { cause: error });
    }
  }
}
