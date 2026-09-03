import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../../src/app/App";
import type { PatientRepository } from "../../src/application/patient-repository";
import {
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
  }, 10_000);

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
});
