import { describe, expect, it } from "vitest";

import {
  makeDatabaseSyncBase,
  SyncCacheRecordSchema,
} from "../../src/domain/database-sync";
import { emptyPatientDatabase } from "../../src/domain/patient-database";
import {
  LocalSyncCacheStore,
  SyncCacheDataError,
  V2_GOOGLE_CACHE_PREFIX,
} from "../../src/infrastructure/storage/local-sync-cache-store";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();
  writeError: Error | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.writeError) throw this.writeError;
    this.values.set(key, value);
  }
}

describe("LocalSyncCacheStore", () => {
  it("isolates and round-trips a validated cache by opaque account key", async () => {
    const storage = new MemoryStorage();
    const database = emptyPatientDatabase();
    const record = SyncCacheRecordSchema.parse({
      formatVersion: 1,
      database,
      base: makeDatabaseSyncBase(database),
      remoteRevision: "etag:revision-1",
      dirty: false,
      localRevision: 3,
      savedAt: 100,
      lastSyncedAt: 100,
    });
    const first = new LocalSyncCacheStore("account/one", storage);
    const second = new LocalSyncCacheStore("account-two", storage);

    await first.save(record);

    expect(await first.load()).toEqual(record);
    expect(await second.load()).toBeNull();
    expect(storage.values.has(`${V2_GOOGLE_CACHE_PREFIX}account%2Fone`)).toBe(true);
  });

  it("does not overwrite a malformed cache while reporting a data error", async () => {
    const storage = new MemoryStorage();
    const key = `${V2_GOOGLE_CACHE_PREFIX}account-one`;
    storage.setItem(key, "{malformed");
    const cache = new LocalSyncCacheStore("account-one", storage);

    await expect(cache.load()).rejects.toBeInstanceOf(SyncCacheDataError);
    expect(storage.getItem(key)).toBe("{malformed");
  });

  it("reports browser quota failures without mutating the prior cache", async () => {
    const storage = new MemoryStorage();
    const key = `${V2_GOOGLE_CACHE_PREFIX}account-one`;
    storage.setItem(key, "previous");
    storage.writeError = new Error("quota exceeded");
    const cache = new LocalSyncCacheStore("account-one", storage);
    const database = emptyPatientDatabase();
    const record = SyncCacheRecordSchema.parse({
      formatVersion: 1,
      database,
      base: null,
      remoteRevision: null,
      dirty: true,
      localRevision: 1,
      savedAt: 100,
      lastSyncedAt: null,
    });

    await expect(cache.save(record)).rejects.toBeInstanceOf(SyncCacheDataError);
    expect(storage.getItem(key)).toBe("previous");
  });
});
