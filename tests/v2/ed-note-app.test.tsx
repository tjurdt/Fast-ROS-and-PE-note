import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";
import type { PatientRepository } from "../../src/application/patient-repository";
import { parseChartText } from "../../src/domain/ed/chart-text";
import { createPatient } from "../../src/domain/patient";
import {
  addPatient,
  emptyPatientDatabase,
  type PatientDatabase,
} from "../../src/domain/patient-database";

class MemoryRepository implements PatientRepository {
  database: PatientDatabase = emptyPatientDatabase();
  async load() {
    return structuredClone(this.database);
  }
  async save(database: PatientDatabase) {
    this.database = structuredClone(database);
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seededRepository(sex: "女 F" | "男 M" = "男 M", age = "40") {
  const repository = new MemoryRepository();
  repository.database = addPatient(
    emptyPatientDatabase(),
    createPatient(
      { code: "ED-01", specialty: "ed", sex, age, problem: "" },
      { createId: () => "ed-patient", now: () => 100 },
    ),
  );
  return repository;
}

async function openPatient(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("choose-local-v2"));
  await user.click(await screen.findByRole("button", { name: /ED-01/ }));
}

describe("ED problem-oriented note", () => {
  it("replaces the ROS/PE/bundle tabs with the problem flow for ED patients", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);

    const tabs = within(screen.getByRole("navigation", { name: "病人筆記分頁" }));
    for (const name of ["問題", "問診", "PE", "病史", "病歷輸出"]) {
      expect(tabs.getByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
    expect(tabs.queryByRole("button", { name: /^ROS/ })).toBeNull();
    expect(tabs.queryByRole("button", { name: /^組套/ })).toBeNull();
    expect(screen.queryByTestId("open-clinical-export")).toBeNull();
  });

  it("merges two problems into one interview, one exam, one ICD list and a copyable note", async () => {
    const user = userEvent.setup();
    const repository = seededRepository();
    render(<App repository={repository} />);
    await openPatient(user);

    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "腹痛" }));
    await user.click(screen.getByRole("button", { name: /噁心／嘔吐/ }));
    await user.type(screen.getByLabelText("主訴時間"), "since 22:00");
    expect(screen.getByTestId("ed-cc-preview").textContent).toBe(
      "abd pain, N/V since 22:00",
    );

    // 問診：嘔吐是兩個問題共用，只出現一次。
    await user.click(screen.getByRole("button", { name: /^問診/ }));
    expect(screen.getAllByTestId("ed-h-vomiting")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "右下腹" }));
    await user.click(screen.getByLabelText("嘔吐：有"));
    await user.click(screen.getByLabelText("發燒：無"));

    // PE：腹部。
    await user.click(screen.getByRole("button", { name: /^PE/ }));
    await user.click(screen.getByLabelText("外觀／軟硬：正常"));
    await user.click(screen.getByLabelText("壓痛：異常"));
    await user.click(
      within(screen.getByTestId("ed-pe-abd_tender")).getByRole("button", {
        name: "RLQ",
      }),
    );

    await user.click(screen.getByRole("button", { name: /^病歷輸出/ }));
    expect(
      (screen.getByLabelText("CHIEF COMPLAINT") as HTMLTextAreaElement).value,
    ).toBe("RLQ abd pain, N/V since 22:00");
    expect(
      (screen.getByLabelText("PRESENT ILLNESS") as HTMLTextAreaElement).value,
    ).toBe("RLQ pain, vomiting. no fever");
    expect((screen.getByLabelText("ABDOMEN") as HTMLTextAreaElement).value).toBe(
      "Soft, flat, tenderness(+) at RLQ",
    );
    expect((screen.getByLabelText("ICD R10.9") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("ICD R11.2") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId("ed-missing").textContent).toContain("不可漏");

    const exported = (screen.getByLabelText("交換文字") as HTMLTextAreaElement).value;
    const parsed = parseChartText(exported);
    expect(parsed.fields.CC).toBe("RLQ abd pain, N/V since 22:00");
    expect(parsed.icd.map((entry) => entry.code)).toEqual(["R10.9", "R11.2"]);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByTestId("ed-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(exported));

    // 答案以 ed.* 命名空間存進 findings（不動到 legacy 的 ROS/PE 題庫）。
    await waitFor(() => {
      const findings = repository.database.patients[0]?.findings ?? {};
      expect(Object.keys(findings).every((key) => key.startsWith("ed."))).toBe(true);
      expect(findings["ed.h.vomiting"]).toEqual({ on: true });
    });
  }, 30_000);

  it("allows a manual edit and shows the character budget", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "發燒" }));
    await user.click(screen.getByRole("button", { name: /^病歷輸出/ }));

    const cc = screen.getByLabelText("CHIEF COMPLAINT") as HTMLTextAreaElement;
    expect(cc.value).toBe("fever");
    expect(screen.getByTestId("ed-count-CC").textContent).toBe("5/180");
    await user.clear(cc);
    await user.type(cc, "fever x3d");
    expect(
      (screen.getByLabelText("CHIEF COMPLAINT") as HTMLTextAreaElement).value,
    ).toBe("fever x3d");
    await user.click(screen.getByRole("button", { name: /已手動修改/ }));
    expect(
      (screen.getByLabelText("CHIEF COMPLAINT") as HTMLTextAreaElement).value,
    ).toBe("fever");
  }, 20_000);

  it("only asks pregnancy questions for women of child-bearing age", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository("女 F", "28")} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "腹痛" }));
    await user.click(screen.getByRole("button", { name: /^問診/ }));
    expect(screen.getByTestId("ed-h-pregnancy_possible")).toBeTruthy();
    expect(screen.getByTestId("ed-h-lmp")).toBeTruthy();
  }, 20_000);
});
