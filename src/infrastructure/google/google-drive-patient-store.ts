import { z } from "zod";

import {
  RemoteStorageError,
  type RemotePatientSnapshot,
  type RemotePatientStore,
} from "../../application/synchronized-patient-repository";
import {
  PatientDatabaseSchema,
  type PatientDatabase,
} from "../../domain/patient-database";

export const V2_GOOGLE_DRIVE_FILE_NAME = "pe_note_v2_cloud.json";
const CONFLICT_BACKUP_PREFIX = "pe_note_v2_conflict_backup_";
const CONFLICT_BACKUP_KEEP = 5;
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

const CloudEnvelopeSchema = z
  .object({
    format: z.literal("pe-note-v2-cloud"),
    formatVersion: z.literal(1),
    savedAt: z.number().int().nonnegative(),
    database: PatientDatabaseSchema,
  })
  .strict();

interface DriveFile {
  id: string;
  name: string;
  version?: string | undefined;
  modifiedTime?: string | undefined;
}

const DriveFileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    version: z.union([z.string(), z.number().transform(String)]).optional(),
    modifiedTime: z.string().optional(),
  })
  .passthrough();

const DriveFileListSchema = z
  .object({ files: z.array(DriveFileSchema).default([]) })
  .passthrough();

export interface GoogleAccessTokenProvider {
  getAccessToken(): Promise<string>;
  invalidate(): void;
}

interface GoogleDrivePatientStoreDependencies {
  fetch?: typeof fetch;
  now?: () => number;
  createBoundary?: () => string;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().slice(0, 180);
  } catch {
    return "";
  }
}

function revisionFrom(response: Response, file: DriveFile): string {
  const etag = response.headers.get("etag");
  if (etag) return `etag:${etag}`;
  return `version:${file.version ?? file.modifiedTime ?? "unknown"}`;
}

export class GoogleDrivePatientStore implements RemotePatientStore {
  readonly #tokenProvider: GoogleAccessTokenProvider;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #createBoundary: () => string;
  #fileId: string | null = null;

  constructor(
    tokenProvider: GoogleAccessTokenProvider,
    dependencies: GoogleDrivePatientStoreDependencies = {},
  ) {
    this.#tokenProvider = tokenProvider;
    this.#fetch = dependencies.fetch ?? fetch;
    this.#now = dependencies.now ?? (() => Date.now());
    this.#createBoundary =
      dependencies.createBoundary ??
      (() => `pe_note_${this.#now()}_${Math.random().toString(36).slice(2)}`);
  }

  async #request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.#tokenProvider.getAccessToken();
    let response: Response;
    try {
      response = await this.#fetch(url, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      throw new RemoteStorageError("offline", "目前無法連上 Google Drive。", {
        cause: error,
      });
    }
    if (response.status === 401) {
      this.#tokenProvider.invalidate();
      throw new RemoteStorageError(
        "auth-required",
        "Google Drive 授權已到期，請重新連線。",
      );
    }
    if (response.status === 409 || response.status === 412) {
      throw new RemoteStorageError(
        "revision-conflict",
        "Google Drive 資料已由其他裝置更新。",
      );
    }
    if (!response.ok) {
      const detail = await responseMessage(response);
      throw new RemoteStorageError(
        "remote-error",
        `Google Drive 同步失敗 (${response.status})${detail ? `：${detail}` : ""}`,
      );
    }
    return response;
  }

  async #requestJson(url: string, init?: RequestInit): Promise<unknown> {
    const response = await this.#request(url, init);
    try {
      return await response.json();
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google Drive 回傳了無法解析的資料。",
        { cause: error },
      );
    }
  }

  async #findFiles(nameQuery: string, pageSize = 10): Promise<DriveFile[]> {
    const parameters = new URLSearchParams({
      spaces: "appDataFolder",
      q: `${nameQuery} and trashed=false`,
      orderBy: "modifiedTime desc",
      pageSize: String(pageSize),
      fields: "files(id,name,modifiedTime,version)",
    });
    const payload = await this.#requestJson(`${DRIVE_FILES_URL}?${parameters}`);
    try {
      return DriveFileListSchema.parse(payload).files;
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google Drive 檔案清單格式不正確。",
        { cause: error },
      );
    }
  }

  async #findPrimaryFile(): Promise<DriveFile | null> {
    const escaped = V2_GOOGLE_DRIVE_FILE_NAME.replaceAll("'", "\\'");
    return (await this.#findFiles(`name='${escaped}'`))[0] ?? null;
  }

  async read(): Promise<RemotePatientSnapshot | null> {
    const file = await this.#findPrimaryFile();
    if (!file) {
      this.#fileId = null;
      return null;
    }
    this.#fileId = file.id;
    const response = await this.#request(
      `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}?alt=media`,
    );
    try {
      const payload = CloudEnvelopeSchema.parse(await response.json());
      return {
        database: payload.database,
        revision: revisionFrom(response, file),
      };
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google Drive 中的 v2 資料格式不正確；遠端檔案尚未被覆寫。",
        { cause: error },
      );
    }
  }

  #cloudEnvelope(database: PatientDatabase) {
    return CloudEnvelopeSchema.parse({
      format: "pe-note-v2-cloud",
      formatVersion: 1,
      savedAt: this.#now(),
      database: PatientDatabaseSchema.parse(database),
    });
  }

  async #createFile(name: string, database: PatientDatabase): Promise<Response> {
    const boundary = this.#createBoundary();
    const metadata = {
      name,
      parents: ["appDataFolder"],
      mimeType: "application/json",
      appProperties: { app: "pe-note-v2", schema: "1" },
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(this.#cloudEnvelope(database)),
      `--${boundary}--`,
    ].join("\r\n");
    return this.#request(
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime,version`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
  }

  async #parseWrittenFile(response: Response): Promise<DriveFile> {
    try {
      return DriveFileSchema.parse(await response.json());
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google Drive 未回傳可辨識的檔案版本。",
        { cause: error },
      );
    }
  }

  async #etagForVersionRevision(
    fileId: string,
    expectedRevision: string,
  ): Promise<string | null> {
    if (!expectedRevision.startsWith("version:")) return null;
    if (expectedRevision === "version:unknown") {
      throw new RemoteStorageError(
        "revision-conflict",
        "Google Drive 未提供可安全更新的版本資訊。",
      );
    }
    const response = await this.#request(
      `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,version`,
    );
    let file: DriveFile;
    try {
      file = DriveFileSchema.parse(await response.json());
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google Drive 未回傳可辨識的目前版本。",
        { cause: error },
      );
    }
    const actualRevision = `version:${file.version ?? file.modifiedTime ?? "unknown"}`;
    if (actualRevision !== expectedRevision) {
      throw new RemoteStorageError(
        "revision-conflict",
        "Google Drive 資料已由其他裝置更新。",
      );
    }
    return response.headers.get("etag");
  }

  async write(
    database: PatientDatabase,
    expectedRevision: string | null,
  ): Promise<RemotePatientSnapshot> {
    const validated = PatientDatabaseSchema.parse(database);
    if (expectedRevision === null) {
      if (await this.#findPrimaryFile()) {
        throw new RemoteStorageError(
          "revision-conflict",
          "建立雲端檔案前偵測到其他裝置的新版本。",
        );
      }
      const response = await this.#createFile(V2_GOOGLE_DRIVE_FILE_NAME, validated);
      const file = await this.#parseWrittenFile(response);
      this.#fileId = file.id;
      return { database: validated, revision: revisionFrom(response, file) };
    }

    if (!this.#fileId) {
      throw new RemoteStorageError(
        "revision-conflict",
        "找不到原先讀取的 Google Drive 檔案。",
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=UTF-8",
    };
    if (expectedRevision.startsWith("etag:")) {
      headers["If-Match"] = expectedRevision.slice("etag:".length);
    } else {
      const currentEtag = await this.#etagForVersionRevision(
        this.#fileId,
        expectedRevision,
      );
      if (currentEtag) headers["If-Match"] = currentEtag;
    }
    const response = await this.#request(
      `${DRIVE_UPLOAD_URL}/${encodeURIComponent(this.#fileId)}?uploadType=media&fields=id,name,modifiedTime,version`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(this.#cloudEnvelope(validated)),
      },
    );
    const file = await this.#parseWrittenFile(response);
    return { database: validated, revision: revisionFrom(response, file) };
  }

  async backup(database: PatientDatabase, reason: string): Promise<void> {
    const timestamp = new Date(this.#now()).toISOString().replace(/[:.]/g, "-");
    const response = await this.#createFile(
      `${CONFLICT_BACKUP_PREFIX}${timestamp}_${reason.slice(0, 40)}.json`,
      database,
    );
    await this.#parseWrittenFile(response);

    const backups = await this.#findFiles(
      `name contains '${CONFLICT_BACKUP_PREFIX}'`,
      100,
    );
    await Promise.all(
      backups.slice(CONFLICT_BACKUP_KEEP).map(async (file) => {
        try {
          await this.#request(`${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}`, {
            method: "DELETE",
          });
        } catch {
          // Backup retention cleanup must not invalidate the completed backup.
        }
      }),
    );
  }
}
