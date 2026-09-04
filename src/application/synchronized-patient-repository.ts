import {
  makeDatabaseSyncBase,
  mergePatientDatabases,
  patientDatabasesEqual,
  SyncCacheRecordSchema,
  type SyncCacheRecord,
} from "../domain/database-sync";
import {
  emptyPatientDatabase,
  PatientDatabaseSchema,
  type PatientDatabase,
} from "../domain/patient-database";
import type { PatientRepository } from "./patient-repository";

export type RemoteStorageErrorCode =
  "offline" | "auth-required" | "revision-conflict" | "invalid-data" | "remote-error";

export class RemoteStorageError extends Error {
  readonly code: RemoteStorageErrorCode;

  constructor(code: RemoteStorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RemoteStorageError";
    this.code = code;
  }
}

export interface RemotePatientSnapshot {
  database: PatientDatabase;
  revision: string;
}

export interface RemotePatientStore {
  read(): Promise<RemotePatientSnapshot | null>;
  write(
    database: PatientDatabase,
    expectedRevision: string | null,
  ): Promise<RemotePatientSnapshot>;
  backup(database: PatientDatabase, reason: string): Promise<void>;
}

export interface SyncCacheStore {
  load(): Promise<SyncCacheRecord | null>;
  save(record: SyncCacheRecord): Promise<void>;
}

export type PatientSyncStatus =
  | "idle"
  | "cached"
  | "pending"
  | "syncing"
  | "synced"
  | "offline"
  | "auth-required"
  | "conflict"
  | "error";

export interface PatientSyncState {
  status: PatientSyncStatus;
  detail: string;
  dirty: boolean;
  lastSyncedAt: number | null;
  conflictCount: number;
}

export interface SyncCapablePatientRepository extends PatientRepository {
  getSyncState(): PatientSyncState;
  subscribe(listener: (state: PatientSyncState) => void): () => void;
  sync(): Promise<PatientDatabase>;
}

export function isSyncCapablePatientRepository(
  repository: PatientRepository,
): repository is SyncCapablePatientRepository {
  const candidate = repository as Partial<SyncCapablePatientRepository>;
  return (
    typeof candidate.getSyncState === "function" &&
    typeof candidate.subscribe === "function" &&
    typeof candidate.sync === "function"
  );
}

function syncErrorState(error: unknown): Pick<PatientSyncState, "status" | "detail"> {
  if (error instanceof RemoteStorageError) {
    if (error.code === "offline") {
      return { status: "offline", detail: "網路中斷；資料已安全保留在此裝置" };
    }
    if (error.code === "auth-required") {
      return { status: "auth-required", detail: "Google Drive 需要重新連線" };
    }
    if (error.code === "revision-conflict") {
      return { status: "pending", detail: "遠端版本剛更新；請再同步一次" };
    }
  }
  return {
    status: "error",
    detail: error instanceof Error ? error.message : "同步失敗",
  };
}

export class SynchronizedPatientRepository implements SyncCapablePatientRepository {
  readonly #cache: SyncCacheStore;
  readonly #remote: RemotePatientStore;
  readonly #now: () => number;
  readonly #listeners = new Set<(state: PatientSyncState) => void>();
  #syncPromise: Promise<PatientDatabase> | null = null;
  #state: PatientSyncState = {
    status: "idle",
    detail: "尚未載入同步快取",
    dirty: false,
    lastSyncedAt: null,
    conflictCount: 0,
  };

  constructor(
    cache: SyncCacheStore,
    remote: RemotePatientStore,
    now: () => number = () => Date.now(),
  ) {
    this.#cache = cache;
    this.#remote = remote;
    this.#now = now;
  }

  getSyncState(): PatientSyncState {
    return { ...this.#state };
  }

  subscribe(listener: (state: PatientSyncState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.getSyncState());
    return () => this.#listeners.delete(listener);
  }

  #setState(patch: Partial<PatientSyncState>): void {
    this.#state = { ...this.#state, ...patch };
    const state = this.getSyncState();
    this.#listeners.forEach((listener) => listener(state));
  }

  async load(): Promise<PatientDatabase> {
    const cache = await this.#cache.load();
    if (!cache) {
      this.#setState({
        status: "idle",
        detail: "尚無此帳號的裝置快取",
        dirty: false,
        lastSyncedAt: null,
        conflictCount: 0,
      });
      return emptyPatientDatabase();
    }
    this.#setState({
      status: cache.dirty ? "pending" : "cached",
      detail: cache.dirty ? "已載入裝置快取，尚有變更待同步" : "已載入裝置快取",
      dirty: cache.dirty,
      lastSyncedAt: cache.lastSyncedAt,
      conflictCount: 0,
    });
    return PatientDatabaseSchema.parse(cache.database);
  }

  async save(database: PatientDatabase): Promise<void> {
    const validated = PatientDatabaseSchema.parse(database);
    const current = await this.#cache.load();
    const savedAt = this.#now();
    await this.#cache.save(
      SyncCacheRecordSchema.parse({
        formatVersion: 1,
        database: validated,
        base: current?.base ?? null,
        remoteRevision: current?.remoteRevision ?? null,
        dirty: true,
        localRevision: (current?.localRevision ?? 0) + 1,
        savedAt,
        lastSyncedAt: current?.lastSyncedAt ?? null,
      }),
    );
    this.#setState({
      status: "pending",
      detail: "本機已儲存，等待同步",
      dirty: true,
    });
  }

  sync(): Promise<PatientDatabase> {
    if (this.#syncPromise) return this.#syncPromise;
    const promise = this.#performSync().finally(() => {
      if (this.#syncPromise === promise) this.#syncPromise = null;
    });
    this.#syncPromise = promise;
    return promise;
  }

  async #backupConflicts(
    database: PatientDatabase,
    conflictCount: number,
    reason: string,
  ): Promise<void> {
    if (conflictCount === 0) return;
    await this.#remote.backup(database, reason);
  }

  async #performSync(): Promise<PatientDatabase> {
    const cacheAtStart = await this.#cache.load();
    const localAtStart = cacheAtStart?.database ?? emptyPatientDatabase();
    const startRevision = cacheAtStart?.localRevision ?? 0;
    this.#setState({
      status: "syncing",
      detail: "正在與 Google Drive 同步",
      conflictCount: 0,
    });

    try {
      const remoteAtStart = await this.#remote.read();
      let remoteAfterSync: PatientDatabase;
      let remoteRevision: string;
      let conflictCount = 0;

      if (!cacheAtStart && remoteAtStart) {
        remoteAfterSync = remoteAtStart.database;
        remoteRevision = remoteAtStart.revision;
      } else if (!remoteAtStart) {
        const written = await this.#remote.write(localAtStart, null);
        remoteAfterSync = written.database;
        remoteRevision = written.revision;
      } else {
        const merge = mergePatientDatabases(
          localAtStart,
          remoteAtStart.database,
          cacheAtStart?.base ?? null,
        );
        conflictCount = merge.conflicts.length;
        await this.#backupConflicts(
          remoteAtStart.database,
          conflictCount,
          "cross-device-sync",
        );
        if (patientDatabasesEqual(merge.database, remoteAtStart.database)) {
          remoteAfterSync = remoteAtStart.database;
          remoteRevision = remoteAtStart.revision;
        } else {
          const written = await this.#remote.write(
            merge.database,
            remoteAtStart.revision,
          );
          remoteAfterSync = written.database;
          remoteRevision = written.revision;
        }
      }

      const latestCache = await this.#cache.load();
      const changedDuringSync =
        latestCache !== null && latestCache.localRevision > startRevision;
      const completedAt = this.#now();

      if (changedDuringSync) {
        const rebase = mergePatientDatabases(
          latestCache.database,
          remoteAfterSync,
          makeDatabaseSyncBase(localAtStart),
        );
        await this.#backupConflicts(
          remoteAfterSync,
          rebase.conflicts.length,
          "edits-during-sync",
        );
        conflictCount += rebase.conflicts.length;
        const dirty = !patientDatabasesEqual(rebase.database, remoteAfterSync);
        await this.#cache.save(
          SyncCacheRecordSchema.parse({
            ...latestCache,
            database: rebase.database,
            base: makeDatabaseSyncBase(remoteAfterSync),
            remoteRevision,
            dirty,
            savedAt: completedAt,
            lastSyncedAt: completedAt,
          }),
        );
        this.#setState({
          status: dirty ? "pending" : conflictCount > 0 ? "conflict" : "synced",
          detail: dirty
            ? "已保留同步期間的新輸入，請再同步一次"
            : conflictCount > 0
              ? "衝突已保留本機版本，並備份遠端資料"
              : "同步完成",
          dirty,
          lastSyncedAt: completedAt,
          conflictCount,
        });
        return rebase.database;
      }

      await this.#cache.save(
        SyncCacheRecordSchema.parse({
          formatVersion: 1,
          database: remoteAfterSync,
          base: makeDatabaseSyncBase(remoteAfterSync),
          remoteRevision,
          dirty: false,
          localRevision: startRevision,
          savedAt: completedAt,
          lastSyncedAt: completedAt,
        }),
      );
      this.#setState({
        status: conflictCount > 0 ? "conflict" : "synced",
        detail: conflictCount > 0 ? "衝突已保留本機版本，並備份遠端資料" : "同步完成",
        dirty: false,
        lastSyncedAt: completedAt,
        conflictCount,
      });
      return remoteAfterSync;
    } catch (error) {
      const failure = syncErrorState(error);
      const retained = await this.#cache.load().catch(() => null);
      this.#setState({
        ...failure,
        dirty: retained?.dirty ?? cacheAtStart?.dirty ?? false,
      });
      throw error;
    }
  }
}
