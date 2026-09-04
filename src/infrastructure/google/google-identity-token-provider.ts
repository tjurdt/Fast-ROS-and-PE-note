import { z } from "zod";

import { RemoteStorageError } from "../../application/synchronized-patient-repository";
import type { GoogleAccessTokenProvider } from "./google-drive-patient-store";

export const GOOGLE_DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";
export const V2_GOOGLE_SESSION_KEY = "pe_note_v2_google_session";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): GoogleTokenClient;
  revoke?(token: string, callback?: () => void): void;
}

interface GoogleIdentityTokenProviderDependencies {
  sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  locationProtocol?: string;
  now?: () => number;
  loadIdentityScript?: () => Promise<void>;
  getOAuth2?: () => GoogleOAuth2 | undefined;
}

const SessionTokenSchema = z
  .object({
    formatVersion: z.literal(1),
    accessToken: z.string().min(1),
    expiresAt: z.number().int().positive(),
  })
  .strict();

type SessionToken = z.infer<typeof SessionTokenSchema>;

let identityScriptPromise: Promise<void> | null = null;

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function browserSessionStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    return window.sessionStorage;
  } catch {
    return memoryStorage();
  }
}

function browserOAuth2(): GoogleOAuth2 | undefined {
  const candidate = (
    globalThis as typeof globalThis & {
      google?: { accounts?: { oauth2?: GoogleOAuth2 } };
    }
  ).google;
  return candidate?.accounts?.oauth2;
}

function loadBrowserIdentityScript(): Promise<void> {
  if (browserOAuth2()) return Promise.resolve();
  if (identityScriptPromise) return identityScriptPromise;

  identityScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-pe-note-google-identity]",
    );
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (browserOAuth2()) resolve();
      else reject(new Error("Google Identity Services did not initialize."));
    };
    const onError = () => reject(new Error("Google Identity Services failed to load."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.peNoteGoogleIdentity = "1";
      document.head.append(script);
    }
  }).catch((error: unknown) => {
    identityScriptPromise = null;
    throw error;
  });
  return identityScriptPromise;
}

function authorizationError(detail?: string): RemoteStorageError {
  return new RemoteStorageError(
    "auth-required",
    detail ? `Google 連線未完成：${detail}` : "Google 連線未完成，請再試一次。",
  );
}

export class GoogleIdentityTokenProvider implements GoogleAccessTokenProvider {
  readonly #clientId: string;
  readonly #storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  readonly #protocol: string;
  readonly #now: () => number;
  readonly #loadIdentityScript: () => Promise<void>;
  readonly #getOAuth2: () => GoogleOAuth2 | undefined;
  #current: SessionToken | null = null;
  #authorizationPromise: Promise<string> | null = null;

  constructor(
    clientId: string,
    dependencies: GoogleIdentityTokenProviderDependencies = {},
  ) {
    this.#clientId = clientId.trim();
    this.#storage = dependencies.sessionStorage ?? browserSessionStorage();
    this.#protocol = dependencies.locationProtocol ?? window.location.protocol;
    this.#now = dependencies.now ?? (() => Date.now());
    this.#loadIdentityScript =
      dependencies.loadIdentityScript ?? loadBrowserIdentityScript;
    this.#getOAuth2 = dependencies.getOAuth2 ?? browserOAuth2;
  }

  #readSession(): SessionToken | null {
    if (this.#current) return this.#current;
    let serialized: string | null;
    try {
      serialized = this.#storage.getItem(V2_GOOGLE_SESSION_KEY);
    } catch {
      return null;
    }
    if (serialized === null) return null;
    try {
      this.#current = SessionTokenSchema.parse(JSON.parse(serialized));
      return this.#current;
    } catch {
      try {
        this.#storage.removeItem(V2_GOOGLE_SESSION_KEY);
      } catch {
        // Invalid credentials remain unusable even when storage cleanup is blocked.
      }
      return null;
    }
  }

  #remember(accessToken: string, expiresInSeconds: number): string {
    const token = SessionTokenSchema.parse({
      formatVersion: 1,
      accessToken,
      expiresAt: this.#now() + Math.max(1, expiresInSeconds) * 1000,
    });
    this.#current = token;
    try {
      this.#storage.setItem(V2_GOOGLE_SESSION_KEY, JSON.stringify(token));
    } catch {
      // A memory-only token is still safe and usable for the current page session.
    }
    return token.accessToken;
  }

  async getAccessToken(): Promise<string> {
    const token = this.#readSession();
    if (token && token.expiresAt - this.#now() > 30_000) return token.accessToken;
    this.invalidate();
    throw new RemoteStorageError(
      "auth-required",
      "Google 授權已到期；請由畫面重新連線。",
    );
  }

  authorize(): Promise<string> {
    if (this.#authorizationPromise) return this.#authorizationPromise;
    const promise = this.#performAuthorization().finally(() => {
      if (this.#authorizationPromise === promise) this.#authorizationPromise = null;
    });
    this.#authorizationPromise = promise;
    return promise;
  }

  async #performAuthorization(): Promise<string> {
    if (!this.#clientId) {
      throw authorizationError("尚未設定 Google OAuth Client ID。");
    }
    if (this.#protocol === "file:") {
      throw authorizationError("Google 模式必須從 HTTPS 網址開啟。");
    }

    try {
      await this.#loadIdentityScript();
    } catch (error) {
      throw new RemoteStorageError(
        "offline",
        "無法載入 Google 登入服務，請檢查網路後再試。",
        { cause: error },
      );
    }
    const oauth2 = this.#getOAuth2();
    if (!oauth2) throw authorizationError("Google 登入服務尚未就緒。");

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const fail = (error: RemoteStorageError) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      try {
        const client = oauth2.initTokenClient({
          client_id: this.#clientId,
          scope: GOOGLE_DRIVE_APPDATA_SCOPE,
          callback: (response) => {
            if (settled) return;
            if (response.error || !response.access_token) {
              fail(authorizationError(response.error_description ?? response.error));
              return;
            }
            const expiresIn = Number(response.expires_in ?? 3600);
            settled = true;
            resolve(
              this.#remember(
                response.access_token,
                Number.isFinite(expiresIn) ? expiresIn : 3600,
              ),
            );
          },
          error_callback: (error) => fail(authorizationError(error.type)),
        });
        client.requestAccessToken({ prompt: "select_account" });
      } catch (error) {
        fail(
          new RemoteStorageError("remote-error", "無法開啟 Google 登入視窗。", {
            cause: error,
          }),
        );
      }
    });
  }

  invalidate(): void {
    this.#current = null;
    try {
      this.#storage.removeItem(V2_GOOGLE_SESSION_KEY);
    } catch {
      // The in-memory token is still discarded even if browser storage is blocked.
    }
  }

  disconnect(): void {
    const token = this.#readSession()?.accessToken;
    this.invalidate();
    const revoke = this.#getOAuth2()?.revoke;
    if (!token || !revoke) return;
    try {
      revoke(token, () => undefined);
    } catch {
      // Local disconnection must complete even when Google's revoke call is unavailable.
    }
  }
}
