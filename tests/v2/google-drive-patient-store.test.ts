import { describe, expect, it } from "vitest";

import { RemoteStorageError } from "../../src/application/synchronized-patient-repository";
import { emptyPatientDatabase } from "../../src/domain/patient-database";
import {
  GoogleDrivePatientStore,
  V2_GOOGLE_DRIVE_FILE_NAME,
  type GoogleAccessTokenProvider,
} from "../../src/infrastructure/google/google-drive-patient-store";

class TokenProvider implements GoogleAccessTokenProvider {
  invalidated = false;

  async getAccessToken(): Promise<string> {
    return "fake-token";
  }

  invalidate(): void {
    this.invalidated = true;
  }
}

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

function queuedFetch(responses: Response[]) {
  const requests: RecordedRequest[] = [];
  const mock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected fetch request.");
    return response;
  }) as typeof fetch;
  return { mock, requests };
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function cloudEnvelope() {
  return {
    format: "pe-note-v2-cloud",
    formatVersion: 1,
    savedAt: 100,
    database: emptyPatientDatabase(),
  };
}

describe("GoogleDrivePatientStore", () => {
  it("reads the appDataFolder envelope and uses ETag on conditional update", async () => {
    const { mock, requests } = queuedFetch([
      jsonResponse({
        files: [{ id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "4" }],
      }),
      jsonResponse(cloudEnvelope(), 200, { etag: '"etag-4"' }),
      jsonResponse(
        { id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "5" },
        200,
        { etag: '"etag-5"' },
      ),
    ]);
    const store = new GoogleDrivePatientStore(new TokenProvider(), {
      fetch: mock,
      now: () => 200,
    });

    const snapshot = await store.read();
    const written = await store.write(
      emptyPatientDatabase(),
      snapshot?.revision ?? null,
    );

    expect(snapshot).toMatchObject({ revision: 'etag:"etag-4"' });
    expect(written.revision).toBe('etag:"etag-5"');
    expect(requests[0]?.url).toContain("spaces=appDataFolder");
    expect(requests[1]?.url).toContain("file-1?alt=media");
    expect(requests[2]?.init?.method).toBe("PATCH");
    expect(new Headers(requests[2]?.init?.headers).get("If-Match")).toBe('"etag-4"');
    expect(String(requests[2]?.init?.body)).toContain('"format":"pe-note-v2-cloud"');
    expect(new Headers(requests[2]?.init?.headers).get("Authorization")).toBe(
      "Bearer fake-token",
    );
  });

  it("maps a network failure to offline without exposing the access token", async () => {
    const requests: RecordedRequest[] = [];
    const mock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      throw new TypeError("network unavailable");
    }) as typeof fetch;
    const store = new GoogleDrivePatientStore(new TokenProvider(), { fetch: mock });

    await expect(store.read()).rejects.toMatchObject({
      name: "RemoteStorageError",
      code: "offline",
    });
    expect(requests.map((request) => request.url).join(" ")).not.toContain(
      "fake-token",
    );
  });

  it("invalidates an expired token on HTTP 401", async () => {
    const provider = new TokenProvider();
    const { mock } = queuedFetch([new Response("", { status: 401 })]);
    const store = new GoogleDrivePatientStore(provider, { fetch: mock });

    await expect(store.read()).rejects.toMatchObject({
      code: "auth-required",
    });
    expect(provider.invalidated).toBe(true);
  });

  it("rejects malformed cloud data without attempting a write", async () => {
    const { mock, requests } = queuedFetch([
      jsonResponse({
        files: [{ id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "4" }],
      }),
      jsonResponse({ format: "unknown", database: {} }),
    ]);
    const store = new GoogleDrivePatientStore(new TokenProvider(), { fetch: mock });

    await expect(store.read()).rejects.toMatchObject({ code: "invalid-data" });
    expect(requests).toHaveLength(2);
  });

  it("turns an HTTP precondition failure into a recoverable revision conflict", async () => {
    const { mock } = queuedFetch([
      jsonResponse({
        files: [{ id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "4" }],
      }),
      jsonResponse(cloudEnvelope(), 200, { etag: '"etag-4"' }),
      new Response("changed", { status: 412 }),
    ]);
    const store = new GoogleDrivePatientStore(new TokenProvider(), { fetch: mock });
    const snapshot = await store.read();

    const write = store.write(emptyPatientDatabase(), snapshot?.revision ?? null);
    await expect(write).rejects.toMatchObject({
      name: RemoteStorageError.name,
      code: "revision-conflict",
    });
  });

  it("rechecks a Drive version before updating when no ETag is available", async () => {
    const { mock, requests } = queuedFetch([
      jsonResponse({
        files: [{ id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "4" }],
      }),
      jsonResponse(cloudEnvelope()),
      jsonResponse({ id: "file-1", name: V2_GOOGLE_DRIVE_FILE_NAME, version: "5" }),
    ]);
    const store = new GoogleDrivePatientStore(new TokenProvider(), { fetch: mock });
    const snapshot = await store.read();

    expect(snapshot?.revision).toBe("version:4");
    await expect(
      store.write(emptyPatientDatabase(), snapshot?.revision ?? null),
    ).rejects.toMatchObject({ code: "revision-conflict" });
    expect(requests).toHaveLength(3);
    expect(requests[2]?.url).toContain("fields=id,name,modifiedTime,version");
  });
});
