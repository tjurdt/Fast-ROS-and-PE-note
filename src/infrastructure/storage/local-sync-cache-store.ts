import type { SyncCacheStore } from "../../application/synchronized-patient-repository";
import {
  SyncCacheRecordSchema,
  type SyncCacheRecord,
} from "../../domain/database-sync";

export const V2_GOOGLE_CACHE_PREFIX = "pe_note_v2_google_cache:";

export class SyncCacheDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SyncCacheDataError";
  }
}

export class LocalSyncCacheStore implements SyncCacheStore {
  readonly #storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  readonly #key: string;

  constructor(
    accountKey: string,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = window.localStorage,
  ) {
    const normalized = accountKey.trim();
    if (!normalized) throw new Error("Google sync cache requires an account key.");
    this.#storage = storage;
    this.#key = `${V2_GOOGLE_CACHE_PREFIX}${encodeURIComponent(normalized)}`;
  }

  async load(): Promise<SyncCacheRecord | null> {
    const serialized = this.#storage.getItem(this.#key);
    if (serialized === null) return null;
    try {
      return SyncCacheRecordSchema.parse(JSON.parse(serialized));
    } catch (error) {
      throw new SyncCacheDataError(
        "無法讀取此 Google 帳號的裝置快取；原始內容尚未被覆寫。",
        { cause: error },
      );
    }
  }

  has(): boolean {
    return this.#storage.getItem(this.#key) !== null;
  }

  async save(record: SyncCacheRecord): Promise<void> {
    const validated = SyncCacheRecordSchema.parse(record);
    try {
      this.#storage.setItem(this.#key, JSON.stringify(validated));
    } catch (error) {
      throw new SyncCacheDataError("瀏覽器無法儲存 Google 同步快取。", {
        cause: error,
      });
    }
  }

  clear(): void {
    try {
      this.#storage.removeItem(this.#key);
    } catch (error) {
      throw new SyncCacheDataError("無法清除此 Google 帳號的裝置快取。", {
        cause: error,
      });
    }
  }
}
