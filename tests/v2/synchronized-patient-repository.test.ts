import { describe, expect, it } from "vitest";

import {
  RemoteStorageError,
  SynchronizedPatientRepository,
  type RemotePatientSnapshot,
  type RemotePatientStore,
  type SyncCacheStore,
} from "../../src/application/synchronized-patient-repository";
import {
  makeDatabaseSyncBase,
  SyncCacheRecordSchema,
  type SyncCacheRecord,
} from "../../src/domain/database-sync";
import {
  createPatient,
  updatePatientDetails,
  type Patient,
} from "../../src/domain/patient";
import {
  addPatient,
  emptyPatientDatabase,
  replacePatient,
  type PatientDatabase,
} from "../../src/domain/patient-database";

function patient(id: string, problem = ""): Patient {
  return createPatient(
    { code: id, specialty: "general", sex: "", age: "", problem },
    { createId: () => id, now: () => 10 },
  );
}

function database(...patients: Patient[]): PatientDatabase {
  return patients.reduce(addPatient, emptyPatientDatabase());
}

function cacheRecord(
  current: PatientDatabase,
  baseDatabase: PatientDatabase | null = current,
  dirty = false,
): SyncCacheRecord {
  return SyncCacheRecordSchema.parse({
    formatVersion: 1,
    database: current,
    base: baseDatabase ? makeDatabaseSyncBase(baseDatabase) : null,
    remoteRevision: baseDatabase ? "r1" : null,
    dirty,
    localRevision: dirty ? 1 : 0,
    savedAt: 10,
    lastSyncedAt: dirty ? null : 10,
  });
}

class MemorySyncCache implements SyncCacheStore {
  record: SyncCacheRecord | null;

  constructor(record: SyncCacheRecord | null = null) {
    this.record = record ? structuredClone(record) : null;
  }

  async load(): Promise<SyncCacheRecord | null> {
    return this.record ? structuredClone(this.record) : null;
  }

  async save(record: SyncCacheRecord): Promise<void> {
    this.record = structuredClone(record);
  }
}

class FakeRemoteStore implements RemotePatientStore {
  snapshot: RemotePatientSnapshot | null;
  actions: string[] = [];
  readError: Error | null = null;
  writeError: Error | null = null;
  backupError: Error | null = null;
  readHook: (() => Promise<void>) | null = null;

  constructor(database: PatientDatabase | null, revision = "r1") {
    this.snapshot = database ? { database: structuredClone(database), revision } : null;
  }

  async read(): Promise<RemotePatientSnapshot | null> {
    this.actions.push("read");
    if (this.readHook) await this.readHook();
    if (this.readError) throw this.readError;
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }

  async write(
    current: PatientDatabase,
    expectedRevision: string | null,
  ): Promise<RemotePatientSnapshot> {
    this.actions.push(`write:${expectedRevision ?? "new"}`);
    if (this.writeError) {
      const error = this.writeError;
      this.writeError = null;
      throw error;
    }
    this.snapshot = {
      database: structuredClone(current),
      revision: `r${Number(this.snapshot?.revision.slice(1) ?? 0) + 1}`,
    };
    return structuredClone(this.snapshot);
  }

  async backup(): Promise<void> {
    this.actions.push("backup");
    if (this.backupError) throw this.backupError;
  }
}

describe("SynchronizedPatientRepository", () => {
  it("opens a valid cached Google database without requiring a network", async () => {
    const cached = database(patient("cached-patient"));
    const repository = new SynchronizedPatientRepository(
      new MemorySyncCache(cacheRecord(cached)),
      new FakeRemoteStore(null),
      () => 20,
    );

    expect(await repository.load()).toEqual(cached);
    expect(repository.getSyncState()).toMatchObject({
      status: "cached",
      dirty: false,
      lastSyncedAt: 10,
    });
  });

  it("keeps dirty cached data intact when the network is offline", async () => {
    const local = database(patient("local-patient", "local edit"));
    const cache = new MemorySyncCache(cacheRecord(local, emptyPatientDatabase(), true));
    const remote = new FakeRemoteStore(null);
    remote.readError = new RemoteStorageError("offline", "offline");
    const repository = new SynchronizedPatientRepository(cache, remote, () => 20);

    await repository.load();
    await expect(repository.sync()).rejects.toMatchObject({ code: "offline" });

    expect(cache.record?.database).toEqual(local);
    expect(cache.record?.dirty).toBe(true);
    expect(repository.getSyncState()).toMatchObject({
      status: "offline",
      dirty: true,
    });
  });

  it("adopts the remote database on first sync when no device cache exists", async () => {
    const remoteDatabase = database(patient("remote-patient"));
    const cache = new MemorySyncCache();
    const repository = new SynchronizedPatientRepository(
      cache,
      new FakeRemoteStore(remoteDatabase, "r7"),
      () => 20,
    );

    expect(await repository.load()).toEqual(emptyPatientDatabase());
    expect(await repository.sync()).toEqual(remoteDatabase);
    expect(cache.record).toMatchObject({
      database: remoteDatabase,
      dirty: false,
      remoteRevision: "r7",
      lastSyncedAt: 20,
    });
  });

  it("merges non-conflicting device edits and writes with the observed revision", async () => {
    const first = patient("patient-1");
    const second = patient("patient-2");
    const baseDatabase = database(first, second);
    const local = replacePatient(
      baseDatabase,
      updatePatientDetails(first, { problem: "local" }, 20),
    );
    const remoteDatabase = replacePatient(
      baseDatabase,
      updatePatientDetails(second, { problem: "remote" }, 30),
    );
    const cache = new MemorySyncCache(cacheRecord(local, baseDatabase, true));
    const remote = new FakeRemoteStore(remoteDatabase);
    const repository = new SynchronizedPatientRepository(cache, remote, () => 40);

    const merged = await repository.sync();

    expect(remote.actions).toEqual(["read", "write:r1"]);
    expect(merged.patients.map((item) => item.problem)).toEqual(["local", "remote"]);
    expect(cache.record?.dirty).toBe(false);
    expect(repository.getSyncState().status).toBe("synced");
  });

  it("backs up the remote version before local-active conflict resolution", async () => {
    const original = patient("patient-1");
    const baseDatabase = database(original);
    const local = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "local" }, 20),
    );
    const remoteDatabase = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "remote" }, 30),
    );
    const remote = new FakeRemoteStore(remoteDatabase);
    const repository = new SynchronizedPatientRepository(
      new MemorySyncCache(cacheRecord(local, baseDatabase, true)),
      remote,
      () => 40,
    );

    const result = await repository.sync();

    expect(remote.actions).toEqual(["read", "backup", "write:r1"]);
    expect(result.patients[0]?.problem).toBe("local");
    expect(repository.getSyncState()).toMatchObject({
      status: "conflict",
      conflictCount: 1,
      dirty: false,
    });
  });

  it("does not overwrite a conflicting remote version when its backup fails", async () => {
    const original = patient("patient-1");
    const baseDatabase = database(original);
    const local = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "local" }, 20),
    );
    const remoteDatabase = replacePatient(
      baseDatabase,
      updatePatientDetails(original, { problem: "remote" }, 30),
    );
    const cache = new MemorySyncCache(cacheRecord(local, baseDatabase, true));
    const remote = new FakeRemoteStore(remoteDatabase);
    remote.backupError = new Error("backup failed");
    const repository = new SynchronizedPatientRepository(cache, remote, () => 40);

    await expect(repository.sync()).rejects.toThrow("backup failed");

    expect(remote.actions).toEqual(["read", "backup"]);
    expect(remote.snapshot?.database).toEqual(remoteDatabase);
    expect(cache.record?.database).toEqual(local);
    expect(cache.record?.dirty).toBe(true);
    expect(repository.getSyncState().status).toBe("error");
  });

  it("surfaces expired authorization while retaining local work", async () => {
    const local = database(patient("local-patient"));
    const cache = new MemorySyncCache(cacheRecord(local, emptyPatientDatabase(), true));
    const remote = new FakeRemoteStore(null);
    remote.readError = new RemoteStorageError("auth-required", "expired");
    const repository = new SynchronizedPatientRepository(cache, remote, () => 20);

    await expect(repository.sync()).rejects.toMatchObject({ code: "auth-required" });
    expect(repository.getSyncState()).toMatchObject({
      status: "auth-required",
      dirty: true,
    });
    expect(cache.record?.database).toEqual(local);
  });

  it("recovers from a remote revision race on the next sync", async () => {
    const original = emptyPatientDatabase();
    const local = database(patient("local-patient"));
    const cache = new MemorySyncCache(cacheRecord(local, original, true));
    const remote = new FakeRemoteStore(original);
    remote.writeError = new RemoteStorageError("revision-conflict", "changed remotely");
    const repository = new SynchronizedPatientRepository(cache, remote, () => 20);

    await expect(repository.sync()).rejects.toMatchObject({
      code: "revision-conflict",
    });
    expect(repository.getSyncState().status).toBe("pending");
    expect(cache.record?.dirty).toBe(true);

    const recovered = await repository.sync();
    expect(recovered.patients[0]?.id).toBe("local-patient");
    expect(cache.record?.dirty).toBe(false);
    expect(repository.getSyncState().status).toBe("synced");
  });

  it("rebases edits made while a sync request is in flight", async () => {
    const originalPatient = patient("patient-1");
    const original = database(originalPatient);
    const remoteDatabase = database(originalPatient, patient("remote-patient"));
    const cache = new MemorySyncCache(cacheRecord(original));
    const remote = new FakeRemoteStore(remoteDatabase);
    let releaseRead: () => void = () => undefined;
    remote.readHook = () =>
      new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
    const repository = new SynchronizedPatientRepository(cache, remote, () => 40);

    const syncing = repository.sync();
    await Promise.resolve();
    await repository.save(
      replacePatient(
        original,
        updatePatientDetails(originalPatient, { problem: "typed during sync" }, 30),
      ),
    );
    releaseRead();
    const rebased = await syncing;

    expect(rebased.patients.find((item) => item.id === "patient-1")?.problem).toBe(
      "typed during sync",
    );
    expect(rebased.patients.some((item) => item.id === "remote-patient")).toBe(true);
    expect(cache.record?.dirty).toBe(true);
    expect(repository.getSyncState()).toMatchObject({
      status: "pending",
      detail: "已保留同步期間的新輸入，請再同步一次",
    });
  });
});
