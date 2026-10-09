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

const isChecked = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).checked;

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
    for (const name of ["問題", "問診", "PE", "病史", "檢查", "病歷輸出"]) {
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

  it("suggests de-duplicated ERS orders, lets the doctor untick one, and exports them", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository("女 F", "28")} />);
    await openPatient(user);

    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "腹痛" }));
    await user.click(screen.getByRole("button", { name: /噁心／嘔吐/ }));
    await user.click(screen.getByRole("button", { name: /^檢查/ }));

    // 兩個問題都要求的項目只出現一次。
    expect(screen.getAllByTestId("ed-order-cbc_dc")).toHaveLength(1);
    expect(screen.getAllByTestId("ed-order-lipase")).toHaveLength(1);
    // 育齡女性：驗孕；高輻射的 CT 只列出、不勾選。
    expect(isChecked("HCG, urine（90727204）")).toBe(true);
    expect(isChecked("CT/SCAN- UPPER ABDOMEN（15015A60）")).toBe(false);

    const countBefore = Number(
      /\d+/.exec(screen.getByTestId("ed-order-count").textContent ?? "")?.[0],
    );
    await user.click(screen.getByLabelText("KUB- PLAIN（15003010）"));
    expect(screen.getByTestId("ed-order-count").textContent).toBe(
      `已選 ${countBefore - 1} 項`,
    );

    await user.click(screen.getByRole("button", { name: /^病歷輸出/ }));
    const exported = parseChartText(
      (screen.getByLabelText("交換文字") as HTMLTextAreaElement).value,
    );
    const keys = exported.orders.map((order) => order.pfkey);
    expect(keys).toHaveLength(countBefore - 1);
    expect(keys).toContain("9071715F");
    expect(keys).toContain("90727204");
    expect(keys).not.toContain("15003010");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("asks for a problem before suggesting orders", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: /^檢查/ }));
    expect(screen.getByText(/請先到「問題」分頁/)).toBeTruthy();
  });

  it("searches symptoms, adds a custom complaint and lets the doctor mark the main one", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));

    await user.type(screen.getByLabelText("搜尋症狀"), "肚子痛");
    const results = within(screen.getByTestId("ed-search-results"));
    await user.click(results.getByRole("button", { name: "腹痛" }));

    await user.clear(screen.getByLabelText("搜尋症狀"));
    await user.type(screen.getByLabelText("搜尋症狀"), "右上腹悶痛");
    await user.click(screen.getByRole("button", { name: /自訂主訴「右上腹悶痛」/ }));
    expect(screen.getByTestId("ed-cc-preview").textContent).toBe(
      "abd pain, 右上腹悶痛",
    );

    await user.click(screen.getByRole("button", { name: "設為主訴：右上腹悶痛" }));
    expect(screen.getByTestId("ed-cc-preview").textContent).toBe(
      "右上腹悶痛, abd pain",
    );
    const selected = within(screen.getByTestId("ed-selected"));
    expect(selected.getAllByRole("listitem")[0]?.textContent).toContain("★");

    await user.click(screen.getByRole("button", { name: "移除：右上腹悶痛" }));
    expect(screen.getByTestId("ed-cc-preview").textContent).toBe("abd pain");
  });

  it("groups symptoms sensibly: common first, ENT and eye in their own group", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings.indexOf("常用")).toBeLessThan(headings.indexOf("心肺"));
    expect(headings).toContain("五官");
    expect(headings).toContain("精神");
    expect(headings).not.toContain("其他");
  });

  it("starts the interview lean and remembers the doctor's depth choice", async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem("pe_note_ed_depth");
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "腹痛" }));
    await user.click(screen.getByRole("button", { name: /^問診/ }));

    expect(
      screen.getByRole("button", { name: "精簡" }).getAttribute("aria-pressed"),
    ).toBe("true");
    // 必問（發燒）直接顯示；非必問（便秘）收進「其他題目」。
    const other = screen.getByTestId("ed-other-summary").closest("details");
    expect(
      within(screen.getByTestId("ed-h-fever")).getByLabelText("發燒：有"),
    ).toBeTruthy();
    expect(other?.contains(screen.getByTestId("ed-h-constipation"))).toBe(true);
    expect(other?.open).toBe(false);

    await user.click(screen.getByRole("button", { name: "完整" }));
    expect(window.localStorage.getItem("pe_note_ed_depth")).toBe("full");
    expect(screen.getByTestId("ed-other-summary").closest("details")?.open).toBe(true);
    window.localStorage.removeItem("pe_note_ed_depth");
  });

  it("accepts free-text interview and exam findings and special situations", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository("女 F", "30")} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "發燒" }));

    await user.click(screen.getByRole("button", { name: /^問診/ }));
    await user.type(screen.getByLabelText("問診補充"), "家人也有類似症狀");
    await user.click(screen.getByRole("button", { name: "酒醉／疑似物質影響" }));
    await user.type(screen.getByLabelText("酒醉／疑似物質影響 細節"), "alcohol");

    await user.click(screen.getByRole("button", { name: /^PE/ }));
    await user.type(
      screen.getByLabelText("EXTREMITIES 補充（自由輸入）"),
      "L leg erythema 2x3 cm",
    );

    await user.click(screen.getByRole("button", { name: /^病史/ }));
    await user.click(screen.getByRole("button", { name: "懷孕中" }));
    await user.type(screen.getByLabelText("懷孕中 細節"), "GA 20w");
    expect(screen.getByTestId("ed-ph-preview").textContent).toBe(
      "Situation: pregnant (GA 20w)",
    );

    await user.click(screen.getByRole("button", { name: /^病歷輸出/ }));
    const pi = (screen.getByLabelText("PRESENT ILLNESS") as HTMLTextAreaElement).value;
    expect(pi).toContain("intoxicated (alcohol)");
    expect(pi).toContain("家人也有類似症狀");
    const ext = (screen.getByLabelText(/EXTREMITIES/) as HTMLTextAreaElement).value;
    expect(ext).toBe("L leg erythema 2x3 cm");
  });

  it("lets the doctor leave one sentence out through the per-field detail list", async () => {
    const user = userEvent.setup();
    render(<App repository={seededRepository()} />);
    await openPatient(user);
    await user.click(screen.getByRole("button", { name: "問題" }));
    await user.click(screen.getByRole("button", { name: "發燒" }));
    await user.click(screen.getByRole("button", { name: /^問診/ }));
    await user.click(screen.getByLabelText("頭痛：無"));
    await user.click(screen.getByLabelText("喘／呼吸困難：無"));
    await user.click(screen.getByRole("button", { name: /^病歷輸出/ }));

    const pi = () =>
      (screen.getByLabelText("PRESENT ILLNESS") as HTMLTextAreaElement).value;
    expect(pi()).toContain("headache");
    const details = within(screen.getByTestId("ed-fit-PI"));
    expect(details.getByText(/逐句明細/).textContent).toMatch(/寫入 2／2 句/);
    await user.click(details.getByLabelText("PI：headache"));
    expect(pi()).not.toContain("headache");
    expect(pi()).toContain("dyspnea");
    expect(
      within(screen.getByTestId("ed-fit-PI")).getByText(/你指定不寫入/),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "還原本欄的手動設定" }));
    expect(pi()).toContain("headache");
  });
});
