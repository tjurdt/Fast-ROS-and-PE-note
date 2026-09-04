import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../../src/app/App";
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
});
