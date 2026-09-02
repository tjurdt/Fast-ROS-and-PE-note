import type { PatientRepository } from "../../application/patient-repository";
import {
  emptyPatientDatabase,
  PatientDatabaseSchema,
  type PatientDatabase,
} from "../../domain/patient-database";

export const V2_LOCAL_STORAGE_KEY = "pe_note_v2";

export class StorageDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageDataError";
  }
}

export class LocalPatientRepository implements PatientRepository {
  readonly #storage: Pick<Storage, "getItem" | "setItem">;

  constructor(storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage) {
    this.#storage = storage;
  }

  async load(): Promise<PatientDatabase> {
    const serialized = this.#storage.getItem(V2_LOCAL_STORAGE_KEY);
    if (serialized === null) return emptyPatientDatabase();

    try {
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
