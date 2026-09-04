import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../../src/app/App";
import type {
  CloudAccount,
  CloudRepositoryConnector,
} from "../../src/application/cloud-repository-connector";
import type { PatientRepository } from "../../src/application/patient-repository";
import type {
  PatientSyncState,
  SyncCapablePatientRepository,
} from "../../src/application/synchronized-patient-repository";
import { createPatient } from "../../src/domain/patient";
import {
  addPatient,
  emptyPatientDatabase,
  type PatientDatabase,
} from "../../src/domain/patient-database";

class MemoryPatientRepository implements PatientRepository {
  database = emptyPatientDatabase();
  saveCount = 0;

  async load(): Promise<PatientDatabase> {
    return structuredClone(this.database);
  }

  async save(database: PatientDatabase): Promise<void> {
    this.database = structuredClone(database);
    this.saveCount += 1;
  }
}

class MemorySyncPatientRepository
  extends MemoryPatientRepository
  implements SyncCapablePatientRepository
{
  syncCount = 0;
  state: PatientSyncState = {
    status: "cached",
    detail: "已載入裝置快取",
    dirty: false,
    lastSyncedAt: null,
    conflictCount: 0,
  };
  readonly listeners = new Set<(state: PatientSyncState) => void>();

  getSyncState(): PatientSyncState {
    return { ...this.state };
  }

  subscribe(listener: (state: PatientSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSyncState());
    return () => this.listeners.delete(listener);
  }

  emit(patch: Partial<PatientSyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.getSyncState()));
  }

  override async save(database: PatientDatabase): Promise<void> {
    await super.save(database);
    this.emit({ status: "pending", detail: "本機已儲存，等待同步", dirty: true });
  }

  async sync(): Promise<PatientDatabase> {
    this.syncCount += 1;
    this.emit({ status: "syncing", detail: "正在同步" });
    this.emit({
      status: "synced",
      detail: "同步完成",
      dirty: false,
      lastSyncedAt: 200,
    });
    return structuredClone(this.database);
  }
}

class DeferredSyncPatientRepository extends MemorySyncPatientRepository {
  completeSync: ((database: PatientDatabase) => void) | null = null;

  override async sync(): Promise<PatientDatabase> {
    this.syncCount += 1;
    this.emit({ status: "syncing", detail: "正在同步" });
    return new Promise<PatientDatabase>((resolve) => {
      this.completeSync = resolve;
    });
  }
}

class MemoryCloudConnector implements CloudRepositoryConnector {
  readonly account: CloudAccount = {
    key: "google-account-1",
    label: "測試帳號（test@example.invalid）",
  };
  readonly repository: MemorySyncPatientRepository;
  cached = true;
  connectCount = 0;
  openCachedCount = 0;
  disconnectCalls: Array<{ accountKey: string; clearCache: boolean }> = [];

  constructor(
    repository: MemorySyncPatientRepository = new MemorySyncPatientRepository(),
  ) {
    this.repository = repository;
  }

  getAvailability() {
    return { available: true, detail: "登入後安全同步。" };
  }

  getCachedAccount() {
    return this.cached ? { account: this.account } : null;
  }

  async connect() {
    this.connectCount += 1;
    return { account: this.account, repository: this.repository };
  }

  async openCached() {
    this.openCachedCount += 1;
    return this.cached ? { account: this.account, repository: this.repository } : null;
  }

  async disconnect(accountKey: string, options: { clearCache: boolean }) {
    this.disconnectCalls.push({ accountKey, clearCache: options.clearCache });
    if (options.clearCache) this.cached = false;
  }
}

afterEach(cleanup);

describe("v2 app shell", () => {
  it("creates, edits, and persists a local patient", async () => {
    const user = userEvent.setup();
    const repository = new MemoryPatientRepository();
    render(
      <App
        repository={repository}
        patientFactory={{ createId: () => "patient-1", now: () => 100 }}
      />,
    );

    await user.click(screen.getByTestId("choose-local-v2"));
    await screen.findByRole("heading", { name: "查房快速紀錄" });
    await user.click(screen.getByRole("button", { name: "＋ 新增病人" }));
    await user.type(screen.getByLabelText("病人代號 Patient code"), "TEST-01");
    await user.type(screen.getByLabelText("年齡 Age"), "72");
    await user.type(screen.getByLabelText("主要問題"), "Pneumonia");
    await user.click(screen.getByRole("button", { name: "建立並開始" }));

    expect(await screen.findByDisplayValue("TEST-01")).toBeTruthy();
    await user.clear(screen.getByLabelText("主要問題"));
    await user.type(screen.getByLabelText("主要問題"), "Improving pneumonia");

    await user.click(screen.getByRole("button", { name: /^一般全身 Constitutional/ }));
    await user.click(screen.getByTestId("finding-control-fever"));
    expect(screen.getByTestId("finding-total").textContent).toContain("1");
    await user.type(screen.getByLabelText("體溫/描述"), "38.5°C");

    await waitFor(() => expect(repository.saveCount).toBeGreaterThan(1));
    expect(repository.database.patients).toHaveLength(1);
    expect(repository.database.patients[0]?.problem).toBe("Improving pneumonia");
    expect(repository.database.patients[0]?.findings.fever).toEqual({
      on: true,
      fu: { fever_t: "38.5°C" },
    });
  }, 20_000);

  it("searches, sorts, and requires explicit confirmation before deleting", async () => {
    const user = userEvent.setup();
    const repository = new MemoryPatientRepository();
    const older = createPatient(
      {
        code: "BED-10",
        specialty: "general",
        sex: "",
        age: "",
        problem: "Pneumonia",
      },
      { createId: () => "patient-older", now: () => 100 },
    );
    const newer = createPatient(
      {
        code: "BED-2",
        specialty: "neuro",
        sex: "",
        age: "",
        problem: "Stroke",
      },
      { createId: () => "patient-newer", now: () => 200 },
    );
    repository.database = addPatient(addPatient(emptyPatientDatabase(), older), newer);
    render(<App repository={repository} />);
    await user.click(screen.getByTestId("choose-local-v2"));

    expect(screen.getAllByTestId("patient-row").map((row) => row.textContent)).toEqual([
      expect.stringContaining("BED-2"),
      expect.stringContaining("BED-10"),
    ]);

    await user.selectOptions(screen.getByLabelText("病人排序"), "updated-asc");
    expect(screen.getAllByTestId("patient-row")[0]?.textContent).toContain("BED-10");

    await user.type(screen.getByLabelText("搜尋病人"), "pneumonia");
    expect(screen.getAllByTestId("patient-row")).toHaveLength(1);
    expect(screen.getByText("顯示 1／2 筆")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "刪除此筆紀錄" }));
    expect(repository.saveCount).toBe(0);
    expect(screen.getByRole("group", { name: "確認刪除病人 BED-10" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("button", { name: /BED-10/ })).toBeTruthy();
    expect(repository.saveCount).toBe(0);

    await user.click(screen.getByRole("button", { name: "刪除此筆紀錄" }));
    await user.click(screen.getByRole("button", { name: "確認刪除" }));

    await waitFor(() => expect(repository.saveCount).toBe(1));
    expect(repository.database.patients.map((patient) => patient.id)).toEqual([
      "patient-newer",
    ]);
    expect(screen.queryByText("BED-10")).toBeNull();
  });

  it("adds the dialysis bundle atomically when PMH matches the legacy trigger", async () => {
    const user = userEvent.setup();
    const repository = new MemoryPatientRepository();
    let id = 0;
    render(
      <App
        repository={repository}
        patientFactory={{ createId: () => `id-${++id}`, now: () => 100 }}
      />,
    );

    await user.click(screen.getByTestId("choose-local-v2"));
    await user.click(await screen.findByRole("button", { name: "＋ 新增病人" }));
    await user.type(screen.getByLabelText("病人代號 Patient code"), "AUTO-HD");
    await user.click(screen.getByRole("button", { name: "建立並開始" }));
    await user.click(screen.getByRole("button", { name: /Past history 過去病史/ }));
    await user.selectOptions(
      screen.getByLabelText("選擇常見過去病史"),
      "末期腎病／洗腎 ESRD",
    );

    expect(await screen.findByTestId("bundle-sys_dialysis")).toBeTruthy();
    await waitFor(() =>
      expect(repository.database.patients[0]?.autoTriggered.sys_dialysis).toBe(true),
    );
    expect(repository.database.patients[0]?.customSets.sys_dialysis).toBeDefined();
  });

  it("enables cache-first Google mode only when a sync repository is injected", async () => {
    const user = userEvent.setup();
    const localRepository = new MemoryPatientRepository();
    const googleRepository = new MemorySyncPatientRepository();
    googleRepository.database = addPatient(
      emptyPatientDatabase(),
      createPatient(
        {
          code: "GOOGLE-CACHED",
          specialty: "general",
          sex: "",
          age: "",
          problem: "cached problem",
        },
        { createId: () => "patient-google", now: () => 100 },
      ),
    );
    render(
      <App
        googleRepository={googleRepository}
        repository={localRepository}
        patientFactory={{ createId: () => "unused", now: () => 300 }}
      />,
    );

    await user.click(screen.getByTestId("choose-google-v2"));
    await user.click(await screen.findByRole("button", { name: /GOOGLE-CACHED/ }));

    const syncPanel = await screen.findByTestId("sync-status-panel");
    expect(syncPanel.textContent).toContain("已同步");
    expect(googleRepository.syncCount).toBe(1);

    await user.clear(screen.getByLabelText("主要問題"));
    await user.type(screen.getByLabelText("主要問題"), "new local edit");
    await waitFor(() => expect(syncPanel.textContent).toContain("待同步"));
    expect(googleRepository.database.patients[0]?.problem).toBe("new local edit");

    await user.click(screen.getByRole("button", { name: "立即同步" }));
    await waitFor(() => expect(syncPanel.textContent).toContain("同步完成"));
    expect(googleRepository.syncCount).toBe(2);
  });

  it("opens an account-isolated cache offline and leaves it recoverable", async () => {
    const user = userEvent.setup();
    const localRepository = new MemoryPatientRepository();
    const connector = new MemoryCloudConnector();
    connector.repository.database = addPatient(
      emptyPatientDatabase(),
      createPatient(
        {
          code: "OFFLINE-CACHED",
          specialty: "general",
          sex: "",
          age: "",
          problem: "retained cache",
        },
        { createId: () => "patient-cached", now: () => 100 },
      ),
    );
    render(<App cloudConnector={connector} repository={localRepository} />);

    expect(screen.getByTestId("choose-google-v2").hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("open-google-cache-v2").textContent).toContain(
      connector.account.label,
    );
    await user.click(screen.getByTestId("open-google-cache-v2"));

    expect(await screen.findByRole("button", { name: /OFFLINE-CACHED/ })).toBeTruthy();
    expect(screen.getByTestId("sync-status-panel").textContent).toContain(
      connector.account.label,
    );
    expect(connector.openCachedCount).toBe(1);
    expect(connector.repository.syncCount).toBe(0);

    await user.click(screen.getByText("帳號與快取"));
    await user.click(screen.getByRole("button", { name: "離開 Google 模式" }));

    await waitFor(() =>
      expect(connector.disconnectCalls).toEqual([
        { accountKey: connector.account.key, clearCache: false },
      ]),
    );
    expect(connector.cached).toBe(true);
    expect(screen.queryByRole("button", { name: /OFFLINE-CACHED/ })).toBeNull();
  });

  it("requires a second confirmation before deleting a Google device cache", async () => {
    const user = userEvent.setup();
    const connector = new MemoryCloudConnector();
    render(
      <App cloudConnector={connector} repository={new MemoryPatientRepository()} />,
    );

    await user.click(screen.getByTestId("open-google-cache-v2"));
    await screen.findByTestId("sync-status-panel");
    await user.click(screen.getByText("帳號與快取"));
    await user.click(screen.getByRole("button", { name: "清除此帳號快取" }));

    expect(screen.getByRole("alert").textContent).toContain("無法復原");
    expect(connector.disconnectCalls).toEqual([]);

    await user.click(screen.getByRole("button", { name: "確認清除此帳號快取" }));
    await waitFor(() =>
      expect(connector.disconnectCalls).toEqual([
        { accountKey: connector.account.key, clearCache: true },
      ]),
    );
    expect(connector.cached).toBe(false);
  });

  it("ignores a late cloud response after returning to local storage", async () => {
    const user = userEvent.setup();
    const localRepository = new MemoryPatientRepository();
    localRepository.database = addPatient(
      emptyPatientDatabase(),
      createPatient(
        {
          code: "LOCAL-SAFE",
          specialty: "general",
          sex: "",
          age: "",
          problem: "local",
        },
        { createId: () => "local-patient", now: () => 100 },
      ),
    );
    const deferredRepository = new DeferredSyncPatientRepository();
    const cloudDatabase = addPatient(
      emptyPatientDatabase(),
      createPatient(
        {
          code: "CLOUD-OLD",
          specialty: "general",
          sex: "",
          age: "",
          problem: "cloud",
        },
        { createId: () => "cloud-patient", now: () => 100 },
      ),
    );
    deferredRepository.database = cloudDatabase;
    const connector = new MemoryCloudConnector(deferredRepository);
    render(<App cloudConnector={connector} repository={localRepository} />);

    await user.click(screen.getByTestId("choose-google-v2"));
    await waitFor(() => expect(deferredRepository.syncCount).toBe(1));
    await user.click(screen.getByText("帳號與快取"));
    await user.click(screen.getByRole("button", { name: "離開 Google 模式" }));
    expect(await screen.findByRole("button", { name: /LOCAL-SAFE/ })).toBeTruthy();

    deferredRepository.completeSync?.(cloudDatabase);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /CLOUD-OLD/ })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /LOCAL-SAFE/ })).toBeTruthy();
  });
});
