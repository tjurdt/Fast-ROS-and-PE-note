import { describe, expect, it, vi } from "vitest";

import { emptyPatientDatabase } from "../../src/domain/patient-database";
import {
  GoogleDriveConnector,
  V2_GOOGLE_LAST_ACCOUNT_KEY,
} from "../../src/infrastructure/google/google-drive-connector";
import { V2_GOOGLE_CACHE_PREFIX } from "../../src/infrastructure/storage/local-sync-cache-store";

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

class TokenProvider {
  authorizeCount = 0;
  disconnectCount = 0;
  invalidated = false;

  async authorize(): Promise<string> {
    this.authorizeCount += 1;
    return "fake-access-token";
  }

  async getAccessToken(): Promise<string> {
    return "fake-access-token";
  }

  invalidate(): void {
    this.invalidated = true;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

function aboutResponse(
  permissionId: string,
  displayName = "Test User",
  emailAddress = "test@example.invalid",
): Response {
  return new Response(
    JSON.stringify({ user: { permissionId, displayName, emailAddress } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("GoogleDriveConnector", () => {
  it("identifies the account and persists only a cache locator, never its token", async () => {
    const storage = new MemoryStorage();
    const tokenProvider = new TokenProvider();
    const fetchMock = vi.fn(async () => aboutResponse("permission/one"));
    const connector = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: fetchMock as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      now: () => 100,
      tokenProvider,
    });

    const connection = await connector.connect();
    await connection.repository.load();
    await connection.repository.save(emptyPatientDatabase());

    expect(connection.account).toEqual({
      key: "permission/one",
      label: "Test User（test@example.invalid）",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/drive/v3/about?fields="),
      { headers: { Authorization: "Bearer fake-access-token" } },
    );
    expect(storage.getItem(V2_GOOGLE_LAST_ACCOUNT_KEY)).not.toContain(
      "fake-access-token",
    );
    expect(storage.values.has(`${V2_GOOGLE_CACHE_PREFIX}permission%2Fone`)).toBe(true);
    expect(connector.getCachedAccount()).toEqual({ account: connection.account });
  });

  it("opens a cached account without authorization or network access", async () => {
    const storage = new MemoryStorage();
    const onlineTokens = new TokenProvider();
    const online = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: vi.fn(async () => aboutResponse("permission-1")) as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      tokenProvider: onlineTokens,
    });
    const first = await online.connect();
    await first.repository.load();
    await first.repository.save(emptyPatientDatabase());

    const offlineTokens = new TokenProvider();
    const offlineFetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const offline = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: offlineFetch as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      tokenProvider: offlineTokens,
    });
    const cached = await offline.openCached();

    await expect(cached?.repository.load()).resolves.toEqual(emptyPatientDatabase());
    expect(offlineTokens.authorizeCount).toBe(0);
    expect(offlineFetch).not.toHaveBeenCalled();
  });

  it("preserves cache on leave and clears only the selected account after confirmation", async () => {
    const storage = new MemoryStorage();
    const tokens = new TokenProvider();
    const connector = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: vi.fn(async () => aboutResponse("permission-1")) as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      tokenProvider: tokens,
    });
    const connection = await connector.connect();
    await connection.repository.load();
    await connection.repository.save(emptyPatientDatabase());

    await connector.disconnect("permission-1", { clearCache: false });
    expect(connector.getCachedAccount()).not.toBeNull();

    await connector.disconnect("permission-1", { clearCache: true });
    expect(connector.getCachedAccount()).toBeNull();
    expect(storage.getItem(V2_GOOGLE_LAST_ACCOUNT_KEY)).toBeNull();
    expect(tokens.disconnectCount).toBe(2);
  });

  it("keeps different Google accounts in separate cache keys", async () => {
    const storage = new MemoryStorage();
    const responses = [aboutResponse("permission-1"), aboutResponse("permission-2")];
    const connector = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: vi.fn(
        async () => responses.shift() ?? new Response("", { status: 500 }),
      ) as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      tokenProvider: new TokenProvider(),
    });

    const first = await connector.connect();
    await first.repository.load();
    await first.repository.save(emptyPatientDatabase());
    const second = await connector.connect();
    await second.repository.load();
    await second.repository.save(emptyPatientDatabase());

    expect(storage.values.has(`${V2_GOOGLE_CACHE_PREFIX}permission-1`)).toBe(true);
    expect(storage.values.has(`${V2_GOOGLE_CACHE_PREFIX}permission-2`)).toBe(true);
  });

  it("invalidates a rejected identity lookup and never creates an account cache", async () => {
    const storage = new MemoryStorage();
    const tokens = new TokenProvider();
    const connector = new GoogleDriveConnector({
      clientId: "public-client-id",
      fetch: vi.fn(async () => new Response("", { status: 401 })) as typeof fetch,
      localStorage: storage,
      locationProtocol: "https:",
      tokenProvider: tokens,
    });

    await expect(connector.connect()).rejects.toMatchObject({
      code: "auth-required",
    });
    expect(tokens.invalidated).toBe(true);
    expect(storage.getItem(V2_GOOGLE_LAST_ACCOUNT_KEY)).toBeNull();
  });
});
