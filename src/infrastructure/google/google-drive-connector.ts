import { z } from "zod";

import type {
  CachedCloudAccount,
  CloudAccount,
  CloudConnectorAvailability,
  CloudRepositoryConnection,
  CloudRepositoryConnector,
} from "../../application/cloud-repository-connector";
import {
  RemoteStorageError,
  SynchronizedPatientRepository,
} from "../../application/synchronized-patient-repository";
import { LocalSyncCacheStore } from "../storage/local-sync-cache-store";
import {
  GoogleDrivePatientStore,
  type GoogleAccessTokenProvider,
} from "./google-drive-patient-store";
import { GoogleIdentityTokenProvider } from "./google-identity-token-provider";

export const V2_GOOGLE_LAST_ACCOUNT_KEY = "pe_note_v2_google_last_account";

interface InteractiveGoogleTokenProvider extends GoogleAccessTokenProvider {
  authorize(): Promise<string>;
  disconnect(): void;
}

interface GoogleDriveConnectorDependencies {
  clientId?: string;
  fetch?: typeof fetch;
  localStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  locationProtocol?: string;
  now?: () => number;
  tokenProvider?: InteractiveGoogleTokenProvider;
}

const AccountSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

const CachedAccountSchema = z
  .object({
    formatVersion: z.literal(1),
    account: AccountSchema,
  })
  .strict();

const DriveAboutSchema = z
  .object({
    user: z
      .object({
        displayName: z.string().optional(),
        emailAddress: z.string().optional(),
        permissionId: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

function configuredClientId(): string {
  return (
    document
      .querySelector<HTMLMetaElement>('meta[name="google-oauth-client-id"]')
      ?.content.trim() ?? ""
  );
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function browserLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

async function responseDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).trim().slice(0, 180);
  } catch {
    return "";
  }
}

export class GoogleDriveConnector implements CloudRepositoryConnector {
  readonly #clientId: string;
  readonly #fetch: typeof fetch;
  readonly #storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  readonly #protocol: string;
  readonly #now: () => number;
  readonly #tokenProvider: InteractiveGoogleTokenProvider;

  constructor(dependencies: GoogleDriveConnectorDependencies = {}) {
    this.#clientId = dependencies.clientId?.trim() ?? configuredClientId();
    this.#fetch = dependencies.fetch ?? fetch;
    this.#storage = dependencies.localStorage ?? browserLocalStorage();
    this.#protocol = dependencies.locationProtocol ?? window.location.protocol;
    this.#now = dependencies.now ?? (() => Date.now());
    this.#tokenProvider =
      dependencies.tokenProvider ??
      new GoogleIdentityTokenProvider(this.#clientId, {
        locationProtocol: this.#protocol,
        now: this.#now,
      });
  }

  getAvailability(): CloudConnectorAvailability {
    if (!this.#clientId) {
      return { available: false, detail: "尚未設定 Google OAuth Client ID。" };
    }
    if (this.#protocol === "file:") {
      return {
        available: false,
        detail: "Google 登入需從 HTTPS 網址開啟；單機模式仍可使用。",
      };
    }
    return {
      available: true,
      detail: "登入後先開啟此裝置快取，再安全同步遠端版本。",
    };
  }

  #readCachedAccount(): CloudAccount | null {
    let serialized: string | null;
    try {
      serialized = this.#storage.getItem(V2_GOOGLE_LAST_ACCOUNT_KEY);
    } catch {
      return null;
    }
    if (serialized === null) return null;
    try {
      return CachedAccountSchema.parse(JSON.parse(serialized)).account;
    } catch {
      return null;
    }
  }

  getCachedAccount(): CachedCloudAccount | null {
    const account = this.#readCachedAccount();
    if (!account) return null;
    try {
      if (!new LocalSyncCacheStore(account.key, this.#storage).has()) return null;
    } catch {
      return null;
    }
    return { account };
  }

  #repository(account: CloudAccount): SynchronizedPatientRepository {
    return new SynchronizedPatientRepository(
      new LocalSyncCacheStore(account.key, this.#storage),
      new GoogleDrivePatientStore(this.#tokenProvider, {
        fetch: this.#fetch,
        now: this.#now,
      }),
      this.#now,
    );
  }

  async #identifyAccount(accessToken: string): Promise<CloudAccount> {
    let response: Response;
    try {
      response = await this.#fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (error) {
      throw new RemoteStorageError("offline", "目前無法取得 Google 帳號資訊。", {
        cause: error,
      });
    }
    if (response.status === 401) {
      this.#tokenProvider.invalidate();
      throw new RemoteStorageError("auth-required", "Google 授權未生效，請重新連線。");
    }
    if (!response.ok) {
      const detail = await responseDetail(response);
      throw new RemoteStorageError(
        "remote-error",
        `無法取得 Google 帳號資訊 (${response.status})${detail ? `：${detail}` : ""}`,
      );
    }

    let about: z.infer<typeof DriveAboutSchema>;
    try {
      about = DriveAboutSchema.parse(await response.json());
    } catch (error) {
      throw new RemoteStorageError(
        "invalid-data",
        "Google 回傳了無法辨識的帳號資訊。",
        { cause: error },
      );
    }
    const displayName = about.user.displayName?.trim();
    const email = about.user.emailAddress?.trim();
    return AccountSchema.parse({
      key: about.user.permissionId,
      label:
        displayName && email
          ? `${displayName}（${email}）`
          : email || displayName || "Google 帳號",
    });
  }

  #rememberAccount(account: CloudAccount): void {
    try {
      this.#storage.setItem(
        V2_GOOGLE_LAST_ACCOUNT_KEY,
        JSON.stringify({ formatVersion: 1, account: AccountSchema.parse(account) }),
      );
    } catch (error) {
      throw new RemoteStorageError(
        "remote-error",
        "瀏覽器無法記住 Google 帳號的裝置快取位置。",
        { cause: error },
      );
    }
  }

  async connect(): Promise<CloudRepositoryConnection> {
    const availability = this.getAvailability();
    if (!availability.available) {
      throw new RemoteStorageError("auth-required", availability.detail);
    }
    const account = await this.#identifyAccount(await this.#tokenProvider.authorize());
    this.#rememberAccount(account);
    return { account, repository: this.#repository(account) };
  }

  async openCached(): Promise<CloudRepositoryConnection | null> {
    const cached = this.getCachedAccount();
    if (!cached) return null;
    return {
      account: cached.account,
      repository: this.#repository(cached.account),
    };
  }

  async disconnect(
    accountKey: string,
    options: { clearCache: boolean },
  ): Promise<void> {
    this.#tokenProvider.disconnect();
    if (!options.clearCache) return;

    new LocalSyncCacheStore(accountKey, this.#storage).clear();
    const remembered = this.#readCachedAccount();
    if (remembered?.key !== accountKey) return;
    try {
      this.#storage.removeItem(V2_GOOGLE_LAST_ACCOUNT_KEY);
    } catch (error) {
      throw new RemoteStorageError(
        "remote-error",
        "裝置快取已清除，但無法移除帳號捷徑。",
        { cause: error },
      );
    }
  }
}
