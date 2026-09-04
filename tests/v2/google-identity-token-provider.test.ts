import { describe, expect, it, vi } from "vitest";

import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  GoogleIdentityTokenProvider,
  V2_GOOGLE_SESSION_KEY,
} from "../../src/infrastructure/google/google-identity-token-provider";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("GoogleIdentityTokenProvider", () => {
  it("restores only an unexpired access token from session storage", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      V2_GOOGLE_SESSION_KEY,
      JSON.stringify({
        formatVersion: 1,
        accessToken: "session-token",
        expiresAt: 140_000,
      }),
    );
    const provider = new GoogleIdentityTokenProvider("client-id", {
      sessionStorage: storage,
      locationProtocol: "https:",
      now: () => 100_000,
      loadIdentityScript: vi.fn(),
      getOAuth2: () => undefined,
    });

    await expect(provider.getAccessToken()).resolves.toBe("session-token");
  });

  it("discards expired session credentials instead of refreshing in background", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      V2_GOOGLE_SESSION_KEY,
      JSON.stringify({
        formatVersion: 1,
        accessToken: "expired-token",
        expiresAt: 120_000,
      }),
    );
    const provider = new GoogleIdentityTokenProvider("client-id", {
      sessionStorage: storage,
      locationProtocol: "https:",
      now: () => 100_000,
      loadIdentityScript: vi.fn(),
      getOAuth2: () => undefined,
    });

    await expect(provider.getAccessToken()).rejects.toMatchObject({
      code: "auth-required",
    });
    expect(storage.getItem(V2_GOOGLE_SESSION_KEY)).toBeNull();
  });

  it("requests only appDataFolder access and keeps the token session-scoped", async () => {
    const storage = new MemoryStorage();
    let requestedPrompt = "";
    let requestedScope = "";
    const provider = new GoogleIdentityTokenProvider("public-client-id", {
      sessionStorage: storage,
      locationProtocol: "https:",
      now: () => 100_000,
      loadIdentityScript: vi.fn(async () => undefined),
      getOAuth2: () => ({
        initTokenClient(options) {
          requestedScope = options.scope;
          return {
            requestAccessToken(requestOptions) {
              requestedPrompt = requestOptions?.prompt ?? "";
              options.callback({ access_token: "new-token", expires_in: 3600 });
            },
          };
        },
      }),
    });

    await expect(provider.authorize()).resolves.toBe("new-token");

    expect(requestedScope).toBe(GOOGLE_DRIVE_APPDATA_SCOPE);
    expect(requestedPrompt).toBe("select_account");
    expect(JSON.parse(storage.getItem(V2_GOOGLE_SESSION_KEY) ?? "null")).toEqual({
      formatVersion: 1,
      accessToken: "new-token",
      expiresAt: 3_700_000,
    });
    expect([...storage.values.keys()]).toEqual([V2_GOOGLE_SESSION_KEY]);
  });

  it("maps a closed popup to a recoverable authorization error", async () => {
    const provider = new GoogleIdentityTokenProvider("public-client-id", {
      sessionStorage: new MemoryStorage(),
      locationProtocol: "https:",
      loadIdentityScript: vi.fn(async () => undefined),
      getOAuth2: () => ({
        initTokenClient(options) {
          return {
            requestAccessToken() {
              options.error_callback?.({ type: "popup_closed" });
            },
          };
        },
      }),
    });

    await expect(provider.authorize()).rejects.toMatchObject({
      code: "auth-required",
      message: expect.stringContaining("popup_closed"),
    });
  });

  it("blocks file URLs before loading Google and revokes a session on disconnect", async () => {
    const fileLoader = vi.fn(async () => undefined);
    const fileProvider = new GoogleIdentityTokenProvider("public-client-id", {
      sessionStorage: new MemoryStorage(),
      locationProtocol: "file:",
      loadIdentityScript: fileLoader,
      getOAuth2: () => undefined,
    });

    await expect(fileProvider.authorize()).rejects.toMatchObject({
      code: "auth-required",
      message: expect.stringContaining("HTTPS"),
    });
    expect(fileLoader).not.toHaveBeenCalled();

    const storage = new MemoryStorage();
    storage.setItem(
      V2_GOOGLE_SESSION_KEY,
      JSON.stringify({
        formatVersion: 1,
        accessToken: "revoke-me",
        expiresAt: Date.now() + 100_000,
      }),
    );
    const revoke = vi.fn();
    const provider = new GoogleIdentityTokenProvider("public-client-id", {
      sessionStorage: storage,
      locationProtocol: "https:",
      getOAuth2: () => ({ initTokenClient: vi.fn(), revoke }),
    });

    provider.disconnect();

    expect(storage.getItem(V2_GOOGLE_SESSION_KEY)).toBeNull();
    expect(revoke).toHaveBeenCalledWith("revoke-me", expect.any(Function));
  });
});
