import { expect, test } from "@playwright/test";

test("v2 single-file shell creates and reloads a typed local patient", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.getByTestId("choose-google-v2")).toBeEnabled();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("V2-TEST-01");
  await page.getByLabel("年齡 Age").fill("65");
  await page.getByLabel("主要問題").fill("Architecture parity");
  await page.getByLabel("科別 Department").selectOption("cms");
  await page.getByRole("button", { name: "建立並開始" }).click();

  await expect(page.getByLabel("病人代號")).toHaveValue("V2-TEST-01");
  await page.getByRole("button", { name: "ROS" }).click();
  const focusRos = page.locator('[data-clinical-section="focus_ros"]');
  await expect(focusRos).toContainText("Focus ROS");
  await focusRos.click();
  await page.getByTestId("finding-control-cough").click();
  await expect(page.getByTestId("finding-total")).toContainText("1");
  await page.getByRole("button", { name: /病人清單/ }).click();
  await expect(page.getByRole("button", { name: /V2-TEST-01/ })).toBeVisible();

  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByRole("button", { name: /V2-TEST-01/ })).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.schemaVersion).toBe(2);
  expect(stored.patients[0].problem).toBe("Architecture parity");
  expect(stored.patients[0].findings.cough.on).toBe(true);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 patient list searches, sorts, and safely persists deletion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByTestId("choose-local-v2").click();

  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("BED-10");
  await page.getByLabel("主要問題").fill("Pneumonia follow-up");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /病人清單/ }).click();

  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("BED-2");
  await page.getByLabel("主要問題").fill("Stroke follow-up");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /病人清單/ }).click();

  const rows = page.getByTestId("patient-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("BED-2");
  await page.getByLabel("病人排序").selectOption("updated-asc");
  await expect(rows.nth(0)).toContainText("BED-10");

  await page.getByLabel("搜尋病人").fill("pneumonia");
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("顯示 1／2 筆")).toBeVisible();
  const pneumoniaRow = rows.filter({ hasText: "BED-10" });
  await pneumoniaRow.getByRole("button", { name: "刪除此筆紀錄" }).click();
  await expect(
    pneumoniaRow.getByRole("group", { name: "確認刪除病人 BED-10" }),
  ).toBeVisible();
  await pneumoniaRow.getByRole("button", { name: "取消" }).click();
  await expect(pneumoniaRow.getByRole("button", { name: /BED-10/ })).toBeVisible();

  await pneumoniaRow.getByRole("button", { name: "刪除此筆紀錄" }).click();
  await pneumoniaRow.getByRole("button", { name: "確認刪除" }).click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("找不到符合「pneumonia」的病人紀錄")).toBeVisible();

  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByTestId("patient-row")).toHaveCount(1);
  await expect(page.getByTestId("patient-row")).toContainText("BED-2");
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.patients.map((patient: { code: string }) => patient.code)).toEqual([
    "BED-2",
  ]);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 neurological widgets match legacy state and survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("NEURO-V2");
  await page.getByLabel("科別 Department").selectOption("neuro");
  await page.getByRole("button", { name: "建立並開始" }).click();

  await page.getByRole("button", { name: "PE", exact: true }).click();
  const focusPe = page.locator('[data-clinical-section="focus_pe"]');
  await focusPe.click();

  await page.getByTestId("finding-control-pe_cn").click();
  await page.getByTestId("finding-control-pe_cn").click();
  await expect(page.getByTestId("cranial-nerve-widget")).toBeVisible();
  await page.getByTestId("cn-toggle-cn1").click();
  await page.getByTestId("cn-cell-cn1-anosmia_L").click();

  await page.getByTestId("dtr-biceps_L").click();
  await page.getByTestId("plantar-L").click();
  await page.getByTestId("plantar-L").click();
  await page.getByTestId("sensory-status").click();
  await page.getByTestId("sensory-status").click();
  await page.getByLabel("側別 / 部位").selectOption("左下肢 LLE");
  await page.getByRole("button", { name: "輕觸 Light touch" }).click();
  await page.getByLabel("感覺異常 1 精確分布").fill("L4");

  await expect(page.getByTestId("finding-total")).toContainText("4");
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.findings?.pe_sensory?.sensory?.findings?.[0]
        ?.location;
    })
    .toBe("L4");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /NEURO-V2/ }).click();
  await page.getByRole("button", { name: "PE", exact: true }).click();
  await page.locator('[data-clinical-section="focus_pe"]').click();

  await expect(page.getByTestId("cn-cell-cn1-anosmia_L")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("dtr-biceps_L")).toHaveText("0");
  await expect(page.getByTestId("plantar-L")).toContainText("Babinski(+)");
  await expect(page.getByLabel("側別 / 部位")).toHaveValue("左下肢 LLE");
  await expect(page.getByLabel("感覺異常 1 精確分布")).toHaveValue("L4");

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.patients[0].findings.pe_cn.cn.cn1.grid.anosmia_L).toBe(true);
  expect(stored.patients[0].findings.pe_dtr.dtr.biceps_L).toBe("0");
  expect(stored.patients[0].findings.pe_plantar.plantar.L).toContain("Babinski(+)");
  expect(
    stored.patients[0].findings.pe_sensory.sensory.findings[0].modalities,
  ).toContain("輕觸 Light touch");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 note workspace persists todo, history, ADL, and block notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("WORKSPACE-V2");
  await page.getByRole("button", { name: "建立並開始" }).click();

  await page.getByRole("button", { name: /^待辦與備註/ }).click();
  const todoRegion = page.getByRole("region", { name: "待辦事項" });
  await todoRegion.getByRole("button", { name: "＋ 新增" }).click();
  await page.getByLabel("待辦內容").fill("追蹤血液培養");
  await page.getByRole("button", { name: "追蹤血液培養：設為重要" }).click();
  await page.getByRole("button", { name: "追蹤血液培養：完成" }).click();
  await page.getByLabel("其他備註 Additional notes").fill("家屬已知情");

  await page.getByRole("button", { name: /^病史/ }).click();
  const history = page.getByTestId("history-workspace");
  await history.getByRole("button", { name: "入院評估" }).click();
  await history.getByRole("button", { name: "菸 Smoking" }).click();
  await page.getByTestId("admission-drugAllergy").click();
  await page.getByLabel("藥物過敏內容").fill("Penicillin rash");
  await page.getByLabel("家族史 Family history").fill("父親 HTN");
  await history.getByRole("button", { name: "TOCC" }).click();
  await page.getByLabel("旅遊 Travel").fill("日本");
  await history.getByRole("button", { name: "ADL", exact: true }).click();
  await page.getByTestId("adl-level").click();
  await history.getByRole("button", { name: "家人 Family" }).click();
  await page.getByLabel("家人姓名或關係 Family member").fill("女兒");
  await expect(history.getByRole("button", { name: "入院評估" })).toContainText("3");

  await history.getByRole("button", { name: "過去病史" }).click();
  await page.getByLabel("選擇常見過去病史").selectOption("高血壓 Hypertension");

  await page.getByRole("button", { name: "ROS" }).click();
  await page.locator('[data-clinical-section="ros_const"]').click();
  await page.getByRole("button", { name: "區塊備註：一般全身 Constitutional" }).click();
  await page
    .getByLabel("區塊備註內容：一般全身 Constitutional")
    .fill("感染症狀區塊備註");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.blockNotes?.ros_const;
    })
    .toBe("感染症狀區塊備註");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /WORKSPACE-V2/ }).click();

  await page.getByRole("button", { name: /^待辦與備註/ }).click();
  await expect(page.getByLabel("待辦內容")).toHaveValue("追蹤血液培養");
  await expect(
    page.getByRole("button", { name: "追蹤血液培養：完成" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("其他備註 Additional notes")).toHaveValue("家屬已知情");

  await page.getByRole("button", { name: /^病史/ }).click();
  const historyReload = page.getByTestId("history-workspace");
  await historyReload.getByRole("button", { name: "入院評估" }).click();
  await expect(page.getByLabel("藥物過敏內容")).toHaveValue("Penicillin rash");

  await historyReload.getByRole("button", { name: "ADL", exact: true }).click();
  await expect(page.getByTestId("adl-level")).toContainText("部分依賴");
  await expect(page.getByLabel("家人姓名或關係 Family member")).toHaveValue("女兒");

  await historyReload.getByRole("button", { name: "過去病史" }).click();
  await expect(
    page.getByRole("textbox", { name: "過去病史 1", exact: true }),
  ).toHaveValue("高血壓 Hypertension");

  await page.getByRole("button", { name: "ROS" }).click();
  await page.getByRole("button", { name: /^一般全身 Constitutional/ }).click();
  await expect(page.getByLabel("區塊備註內容：一般全身 Constitutional")).toHaveValue(
    "感染症狀區塊備註",
  );

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  const patient = stored.patients[0];
  expect(patient.todos[0]).toMatchObject({
    text: "追蹤血液培養",
    important: true,
    status: "done",
  });
  expect(patient.admission.habits).toContain("菸 Smoking");
  expect(patient.admission.tocc.t).toBe("日本");
  expect(patient.adl.level).toBe("Partially dependent 部分依賴");
  expect(patient.pmh[0].text).toBe("高血壓 Hypertension");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 LQQOPERA, dialysis, and DNR bundles persist and reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("BUNDLES-V2");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  await page.getByTestId("add-lqq").click();
  await page.getByLabel("症狀分析 1 名稱").fill("胸痛 Chest pain");
  await page.getByRole("button", { name: "壓迫 pressure" }).click();
  await page.getByLabel("症狀分析 1 嚴重度").fill("8");
  await page.getByLabel("症狀分析 1 發作型態").selectOption("突發 sudden");

  await page.getByTestId("add-bundle-sys_dialysis").click();
  await page
    .getByLabel("洗腎 Dialysis 透析方式", { exact: true })
    .selectOption("血液透析 HD");
  await page.getByTestId("bundle-day-W1").click();
  await page.getByTestId("bundle-day-W3").click();
  await page.getByLabel("洗腎 Dialysis 乾體重 kg").fill("58.5");

  await page.getByTestId("add-bundle-sys_orders").click();
  await page.getByTestId("bundle-toggle-f_sys_orders_0").click();
  await expect(page.getByTestId("dnr-state-0")).toHaveText("同意");
  await page.getByTestId("dnr-state-0").click();
  await expect(page.getByTestId("dnr-state-0")).toHaveText("未同意");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.customSets?.sys_dialysis?.f_sys_dialysis_3;
    })
    .toBe("58.5");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /BUNDLES-V2/ }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  await expect(page.getByLabel("症狀分析 1 名稱")).toHaveValue("胸痛 Chest pain");
  await expect(page.getByRole("button", { name: "壓迫 pressure" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("症狀分析 1 嚴重度")).toHaveValue("8");
  await expect(page.getByLabel("洗腎 Dialysis 透析方式", { exact: true })).toHaveValue(
    "血液透析 HD",
  );
  await expect(page.getByTestId("bundle-day-W1")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("dnr-state-0")).toHaveText("未同意");

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.patients[0].lqq[0]).toMatchObject({
    name: "胸痛 Chest pain",
    quality: ["壓迫 pressure"],
    sev: 8,
    onset: "突發 sudden",
  });
  expect(stored.patients[0].customSets.sys_dialysis.f_sys_dialysis_1).toEqual([
    "W1",
    "W3",
  ]);
  expect(
    stored.patients[0].customSets.sys_orders.f_sys_orders_1["不施行心肺復甦術"],
  ).toBe("disagree");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 postoperative care preserves POD, multi-findings, and repeatable drains", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("POSTOP-V2");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^組套/ }).click();
  await page.getByTestId("add-bundle-postop").click();

  const today = await page.evaluate(() => {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await page
    .getByLabel("術後照護 手術", { exact: true })
    .fill("Laparoscopic colectomy");
  await page.getByLabel("術後照護 手術日期").fill(today);
  await expect(page.getByTestId("postop-pod")).toHaveText("POD 0");
  await page.getByLabel("術後照護 疼痛", { exact: true }).fill("8");
  await page.getByTestId("postop-cycle-vitals").click();
  await page.getByTestId("postop-cycle-vitals").click();

  const nausea = page.getByRole("group", { name: "術後照護 噁心嘔吐" });
  await nausea.getByRole("button", { name: "無 None" }).click();
  await nausea.getByRole("button", { name: "嘔吐 Vomiting" }).click();
  const wound = page.getByRole("group", { name: "術後照護 傷口" });
  await wound.getByRole("button", { name: "乾淨乾燥完整 CDI" }).click();
  await wound.getByRole("button", { name: "出血 Bleeding" }).click();

  await page.getByTestId("postop-add-drain").click();
  const drain = page.getByTestId("postop-drain-1");
  await drain.getByLabel("Drain 1 種類位置").fill("JP, RUQ");
  await drain.getByLabel("Drain 1 量").fill("120");
  await page.getByTestId("postop-drain-1-period").click();
  await drain.getByRole("button", { name: "膿性 Purulent" }).click();
  await page.getByTestId("postop-drain-1-patency").click();
  await page.getByTestId("postop-drain-1-patency").click();
  await drain.getByRole("button", { name: "周圍乾淨" }).click();
  await drain.getByRole("button", { name: "滲漏" }).click();
  await drain.getByLabel("Drain 1 註記").fill("持續觀察趨勢");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.postop?.drains?.[0]?.note;
    })
    .toBe("持續觀察趨勢");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /POSTOP-V2/ }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  await expect(page.getByLabel("術後照護 手術", { exact: true })).toHaveValue(
    "Laparoscopic colectomy",
  );
  await expect(page.getByLabel("術後照護 疼痛", { exact: true })).toHaveValue("8");
  await expect(page.getByTestId("postop-cycle-vitals")).toHaveText("需留意 Concern");
  await expect(
    page
      .getByRole("group", { name: "術後照護 噁心嘔吐" })
      .getByRole("button", { name: "嘔吐 Vomiting" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Drain 1 種類位置")).toHaveValue("JP, RUQ");
  await expect(page.getByTestId("postop-drain-1-patency")).toHaveText(
    "疑阻塞 Blocked?",
  );
  await expect(page.getByLabel("Drain 1 註記")).toHaveValue("持續觀察趨勢");

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.patients[0].postop).toMatchObject({
    surgery: "Laparoscopic colectomy",
    surgeryDate: today,
    pain: "8",
    vitals: "需留意 Concern",
    nauseaSymptoms: ["嘔吐 Vomiting"],
    woundFindings: ["出血 Bleeding"],
  });
  expect(stored.patients[0].postop.drains[0]).toMatchObject({
    site: "JP, RUQ",
    amount: "120",
    period: "單次",
    patency: "疑阻塞 Blocked?",
    characterFindings: ["膿性 Purulent"],
    surroundFindings: ["滲漏"],
    note: "持續觀察趨勢",
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 infection workups score risk and persist repeatable antibiotics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("INFECTION-V2");
  await page.getByLabel("年齡 Age").fill("70");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^組套/ }).click();
  await page.getByTestId("add-infection").click();

  const infection = page.getByTestId("infection-1");
  await infection.getByLabel("感染組套 1 名稱").fill("肺炎 Pneumonia");
  await infection.getByLabel("感染組套 1 體溫").fill("38.2");
  await expect(infection).toContainText("發燒 ≥38°C");
  await infection
    .getByRole("group", { name: "感染組套 感染源評估" })
    .getByRole("button", { name: "肺部 Pulmonary" })
    .click();
  await infection
    .getByRole("group", { name: "感染組套 已送培養" })
    .getByRole("button", { name: "血液培養 Blood ×2" })
    .click();

  const qsofa = infection.locator(".v2-infection-score").filter({ hasText: "qSOFA" });
  await qsofa.locator("summary").click();
  const qsofaSbp = qsofa.getByRole("button", { name: /^qSOFA 收縮壓/ });
  const qsofaRr = qsofa.getByRole("button", { name: /^qSOFA 呼吸速率/ });
  const qsofaMentation = qsofa.getByRole("button", {
    name: /^qSOFA 意識狀態改變/,
  });
  await qsofaSbp.click();
  await qsofaSbp.click();
  await qsofaRr.click();
  await qsofaRr.click();
  await qsofaMentation.click();
  await expect(qsofa).toContainText("qSOFA 2/3：高風險提示");

  const curb65 = infection
    .locator(".v2-infection-score")
    .filter({ hasText: "CURB-65" });
  await curb65.locator("summary").click();
  const confusion = curb65.getByRole("button", { name: /^CURB-65 C｜/ });
  await confusion.click();
  await confusion.click();
  await curb65.getByRole("button", { name: /^CURB-65 U｜/ }).click();
  await curb65.getByRole("button", { name: /^CURB-65 R｜/ }).click();
  await curb65.getByRole("button", { name: /^CURB-65 B｜/ }).click();
  await expect(curb65).toContainText("CURB-65 2/5：中度風險");

  const today = await page.evaluate(() => {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await page.getByTestId("infection-1-add-antibiotic").click();
  await page.getByLabel("抗生素 1 藥物").selectOption("Cefepime");
  await page.getByLabel("抗生素 1 開始使用日").fill(today);
  await expect(page.getByTestId("antibiotic-1-day")).toHaveText("Day 1");
  await page.getByTestId("antibiotic-1-route").click();
  await page.getByLabel("抗生素 1 劑量頻次註記").fill("2 g q8h");

  await infection.getByLabel("感染組套 1 自訂抗生素").fill("Custom-X");
  await infection.getByRole("button", { name: "加入選單" }).click();
  await expect(page.getByLabel("抗生素 2 藥物")).toHaveValue("Custom-X");
  await infection.getByLabel("感染組套 1 整體註記").fill("追蹤乳酸");

  await page.getByTestId("add-infection").click();
  await page.getByTestId("infection-2").getByLabel("感染組套 2 名稱").fill("UTI");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.infections?.length;
    })
    .toBe(2);

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /INFECTION-V2/ }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  await expect(page.getByTestId("add-infection")).toContainText("2");
  const reloaded = page.getByTestId("infection-1");
  await reloaded.locator(":scope > summary").click();
  await expect(reloaded.getByLabel("感染組套 1 名稱")).toHaveValue("肺炎 Pneumonia");
  await expect(reloaded.getByLabel("感染組套 1 體溫")).toHaveValue("38.2");
  await expect(reloaded).toContainText("qSOFA 2/3：高風險提示");
  await expect(page.getByLabel("抗生素 1 藥物")).toHaveValue("Cefepime");
  await expect(page.getByTestId("antibiotic-1-route")).toHaveText("IV 靜脈");
  await expect(page.getByLabel("抗生素 2 藥物")).toHaveValue("Custom-X");
  await expect(
    page.getByTestId("infection-2").getByLabel("感染組套 2 名稱"),
  ).toHaveValue("UTI");

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.antibioticOptions).toEqual(["Custom-X"]);
  expect(stored.patients[0].infections[0]).toMatchObject({
    name: "肺炎 Pneumonia",
    temperature: "38.2",
    sources: ["肺部 Pulmonary"],
    cultures: ["血液培養 Blood ×2"],
    note: "追蹤乳酸",
    qsofa: { sbp: "yes", rr: "yes", mentation: "no" },
    curb65: {
      confusion: "yes",
      urea: "no",
      rr: "no",
      bp: "no",
      age: "yes",
    },
  });
  expect(stored.patients[0].infections[0].antibiotics).toHaveLength(2);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 chemotherapy follow-up preserves safety states and the limb matrix", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("CHEMO-V2");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^組套/ }).click();
  await page.getByTestId("add-bundle-chemo").click();

  const chemo = page.getByTestId("bundle-chemo");
  await chemo.getByLabel("化療副作用 療程", { exact: true }).fill("FOLFOX C3");
  const today = await page.evaluate(() => {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await chemo.getByLabel("化療副作用 治療日期").fill(today);
  await expect(chemo.getByTestId("chemo-day")).toHaveText("D+0");
  await chemo.getByLabel("化療副作用 體溫", { exact: true }).fill("38");
  await expect(chemo).toContainText("≥38°C 警訊");

  const nausea = chemo.getByRole("group", { name: "化療副作用 噁心嘔吐" });
  await nausea.getByRole("button", { name: "無 None" }).click();
  await nausea.getByRole("button", { name: "嘔吐 Vomiting" }).click();
  await expect(nausea.getByRole("button", { name: "無 None" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(nausea.getByRole("button", { name: "嘔吐 Vomiting" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await chemo.getByTestId("chemo-cycle-giImpact").click();
  await chemo.getByTestId("chemo-cycle-giImpact").click();
  await expect(chemo.getByTestId("chemo-cycle-giImpact")).toHaveText(
    "影響進食 Reduced",
  );
  await chemo.getByTestId("chemo-cycle-fatigue").click();
  await chemo.getByTestId("chemo-cycle-fatigue").click();
  await chemo.getByTestId("chemo-cycle-fatigue").click();
  await expect(chemo.getByTestId("chemo-cycle-fatigue")).toHaveText("活動受限 Limited");

  await chemo.getByTestId("chemo-neuro-numbness-LH").click();
  await chemo.getByTestId("chemo-neuro-numbness-RH").click();
  await chemo.getByTestId("chemo-neuro-fine-LH").click();
  await expect(chemo.getByTestId("chemo-neuropathy-status")).toHaveText(
    "有異常 Present",
  );
  await expect(chemo.getByTestId("chemo-neuro-fine-LF")).toBeDisabled();

  const skin = chemo.getByRole("group", { name: "化療副作用 皮膚／管路" });
  await skin.getByRole("button", { name: "無明顯異常 None" }).click();
  await skin.getByRole("button", { name: "腫脹/疑外滲" }).click();
  await chemo
    .getByRole("group", { name: "化療副作用 感染徵象" })
    .getByRole("button", { name: "寒顫 Chills" })
    .click();
  await chemo
    .getByRole("group", { name: "化療副作用 出血徵象" })
    .getByRole("button", { name: "活動性出血", exact: true })
    .click();
  await chemo
    .getByRole("group", { name: "化療副作用 需立即注意" })
    .getByRole("button", { name: "呼吸困難/胸痛" })
    .click();
  await chemo.getByLabel("化療副作用 CBC／ANC", { exact: true }).fill("ANC 400");
  await chemo.getByLabel("化療副作用 處置／Plan", { exact: true }).fill("送急診評估");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return stored?.patients?.[0]?.chemo?.plan;
    })
    .toBe("送急診評估");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /CHEMO-V2/ }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  const reloaded = page.getByTestId("bundle-chemo");
  await expect(reloaded.getByLabel("化療副作用 療程", { exact: true })).toHaveValue(
    "FOLFOX C3",
  );
  await expect(reloaded.getByTestId("chemo-cycle-giImpact")).toHaveText(
    "影響進食 Reduced",
  );
  await expect(reloaded.getByTestId("chemo-neuro-numbness-LH")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(reloaded.getByTestId("chemo-neuro-fine-LH")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.patients[0].chemo).toMatchObject({
    regimen: "FOLFOX C3",
    chemoDate: today,
    temperature: "38",
    nauseaSymptoms: ["嘔吐 Vomiting"],
    giImpact: "影響進食 Reduced",
    fatigue: "活動受限 Limited",
    neuropathyStatus: "有異常 Present",
    skinFindings: ["腫脹/疑外滲"],
    infectionSigns: ["寒顫 Chills"],
    bleedingSigns: ["活動性出血"],
    flags: ["呼吸困難/胸痛"],
    labs: "ANC 400",
    plan: "送急診評估",
    _multiV37: true,
    _neuroMatrixV38: true,
  });
  expect(stored.patients[0].chemo.neuropathyMatrix).toMatchObject({
    numbness: ["LH", "RH"],
    fine: ["LH"],
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 custom bundle templates retain stable patient values through edits and archive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("CUSTOM-BUNDLE-V2");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  await page.getByTestId("manage-bundle-templates").click();
  await page.getByTestId("create-bundle-template").click();
  await page.getByLabel("自訂組套名稱").fill("傷口換藥");

  await page.getByTestId("add-template-field").click();
  await page.getByLabel("欄位 1 名稱").fill("感染徵象");

  await page.getByTestId("add-template-field").click();
  await page.getByLabel("欄位 2 名稱").fill("滲液量");
  await page.getByLabel("欄位 2 類型").selectOption("select");
  await page.getByLabel("欄位 2 選項").fill("少量\n中量\n大量");

  await page.getByTestId("add-template-field").click();
  await page.getByLabel("欄位 3 名稱").fill("傷口狀況");
  await page.getByLabel("欄位 3 類型").selectOption("multi");
  await page.getByLabel("欄位 3 選項").fill("乾燥\n紅腫\n滲血");
  await page.getByRole("button", { name: "欄位 3 上移" }).click();
  await page.getByTestId("save-bundle-template").click();

  await expect(page.getByTestId("bundle-template-editor")).toContainText("傷口換藥");
  await expect(page.getByTestId("bundle-template-editor")).toContainText("3 個欄位");
  await page.getByRole("button", { name: "關閉組套編輯器" }).click();

  const templateId = await page.evaluate(() => {
    const database = JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null");
    return database.customBundleTemplates[0].id as string;
  });
  await page.getByTestId(`add-bundle-${templateId}`).click();
  const bundle = page.getByTestId(`bundle-${templateId}`);
  await bundle.getByRole("button", { name: "(−) 否" }).click();
  await bundle.getByRole("button", { name: "紅腫" }).click();
  await bundle.getByLabel("傷口換藥 滲液量", { exact: true }).selectOption("大量");
  await bundle.getByLabel("傷口換藥 組套註記").fill("每日評估");

  await expect
    .poll(async () => {
      const database = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
      );
      return database?.patients?.[0]?.customSets?.[templateId]?.__setNote;
    })
    .toBe("每日評估");

  await page.getByRole("button", { name: /病人清單/ }).click();
  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: /CUSTOM-BUNDLE-V2/ }).click();
  await page.getByRole("button", { name: /^組套/ }).click();

  const reloaded = page.getByTestId(`bundle-${templateId}`);
  await expect(reloaded.getByRole("button", { name: "(+) 是" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(reloaded.getByRole("button", { name: "紅腫" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(reloaded.getByLabel("傷口換藥 滲液量", { exact: true })).toHaveValue(
    "大量",
  );

  await page.getByTestId("manage-bundle-templates").click();
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await page.getByLabel("自訂組套名稱").fill("傷口換藥追蹤");
  await page.getByTestId("save-bundle-template").click();
  await page.getByRole("button", { name: "關閉組套編輯器" }).click();
  await expect(page.getByTestId(`bundle-${templateId}`)).toContainText("傷口換藥追蹤");
  await expect(
    page
      .getByTestId(`bundle-${templateId}`)
      .getByLabel("傷口換藥追蹤 滲液量", { exact: true }),
  ).toHaveValue("大量");

  await page.getByTestId("manage-bundle-templates").click();
  await page.getByRole("button", { name: "封存", exact: true }).click();
  await page.getByRole("button", { name: "確認封存" }).click();
  await page.getByRole("button", { name: "關閉組套編輯器" }).click();
  await expect(page.getByTestId(`add-bundle-${templateId}`)).toHaveCount(0);
  await expect(page.getByTestId(`bundle-${templateId}`)).toContainText("已封存範本");

  await page.getByTestId("manage-bundle-templates").click();
  await page.getByText("已封存組套（1）").click();
  await page.getByRole("button", { name: "還原", exact: true }).click();
  await page.getByRole("button", { name: "關閉組套編輯器" }).click();
  await expect(page.getByTestId(`add-bundle-${templateId}`)).toBeDisabled();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.customBundleTemplates[0]).toMatchObject({
    id: templateId,
    name: "傷口換藥追蹤",
    archived: false,
  });
  expect(
    stored.customBundleTemplates[0].fields.map(
      (field: { label: string }) => field.label,
    ),
  ).toEqual(["感染徵象", "傷口狀況", "滲液量"]);
  const fieldsByLabel = Object.fromEntries(
    stored.customBundleTemplates[0].fields.map(
      (field: { id: string; label: string }) => [field.label, field.id],
    ),
  );
  expect(stored.patients[0].customSets[templateId]).toMatchObject({
    [fieldsByLabel["感染徵象"]]: true,
    [fieldsByLabel["傷口狀況"]]: ["紅腫"],
    [fieldsByLabel["滲液量"]]: "大量",
    __setNote: "每日評估",
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("v2 clinical summary previews, copies, downloads, and prints without changing patient data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("EXPORT-V2");
  await page.getByLabel("年齡 Age").fill("72");
  await page.getByLabel("主要問題").fill("Pneumonia follow-up");
  await page.getByRole("button", { name: "建立並開始" }).click();

  await page.getByRole("button", { name: "ROS" }).click();
  await page.getByRole("button", { name: /^一般全身 Constitutional/ }).click();
  await page.getByTestId("finding-control-fever").click();
  await page.getByLabel("體溫/描述").fill("38.5°C");
  await page.getByRole("button", { name: /^待辦與備註/ }).click();
  await page.getByLabel("其他備註 Additional notes").fill("家屬已知情");

  const storedBefore = await page.evaluate(() =>
    window.localStorage.getItem("pe_note_v2"),
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.localStorage.setItem("v2-export-copied", text);
        },
      },
    });
    window.print = () => window.localStorage.setItem("v2-export-printed", "yes");
  });

  await page.getByTestId("open-clinical-export").click();
  const preview = page.getByTestId("clinical-export-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("EXPORT-V2");
  await expect(preview).toContainText("Pneumonia follow-up");
  await expect(preview).toContainText("38.5°C");
  await expect(preview).toContainText("家屬已知情");
  await expect(preview).toContainText("限縮版：重點＋陽性/異常＋備註");
  await expect(preview).not.toContainText("Pruritus（搔癢）");

  await preview.getByRole("button", { name: "完整版" }).click();
  await expect(preview).toContainText("完整版：全部項目");
  await expect(preview).toContainText("Pruritus（搔癢）");

  await preview.getByRole("button", { name: "複製全文" }).click();
  await expect(preview.getByRole("status")).toHaveText("已複製全文");
  const copied = await page.evaluate(() =>
    window.localStorage.getItem("v2-export-copied"),
  );
  expect(copied).toContain("病人代號：EXPORT-V2");
  expect(copied).toContain("（完整版：全部項目）");

  const downloadPromise = page.waitForEvent("download");
  await preview.getByRole("button", { name: "下載 TXT" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ROS_PE_EXPORT-V2_\d{12}_full\.txt$/);

  await preview.getByRole("button", { name: "列印／存成 PDF" }).click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("v2-export-printed")))
    .toBe("yes");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(await page.evaluate(() => window.localStorage.getItem("pe_note_v2"))).toBe(
    storedBefore,
  );

  await preview.getByRole("button", { name: "關閉匯出預覽" }).click();
  await expect(preview).toHaveCount(0);
});

test("v2 Google mode keeps session credentials separate and reopens its cache offline", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type TokenClientOptions = {
      callback: (response: { access_token: string; expires_in: number }) => void;
    };
    const browser = window as typeof window & {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (options: TokenClientOptions) => {
              requestAccessToken: () => void;
            };
            revoke: (_token: string, callback?: () => void) => void;
          };
        };
      };
    };
    browser.google = {
      accounts: {
        oauth2: {
          initTokenClient: (options) => ({
            requestAccessToken: () =>
              options.callback({ access_token: "e2e-session-token", expires_in: 3600 }),
          }),
          revoke: (_token, callback) => callback?.(),
        },
      },
    };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/drive/v3/about")) {
        return new Response(
          JSON.stringify({
            user: {
              permissionId: "e2e-account-1",
              displayName: "E2E User",
              emailAddress: "e2e@example.invalid",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if ((init?.method ?? "GET") === "GET" && url.includes("/drive/v3/files")) {
        return new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (init?.method === "POST" && url.includes("/upload/drive/v3/files")) {
        return new Response(
          JSON.stringify({
            id: "e2e-cloud-file",
            name: "pe_note_v2_cloud.json",
            version: "1",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              etag: '"e2e-etag-1"',
            },
          },
        );
      }
      return nativeFetch(input, init);
    };
  });

  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page.getByTestId("choose-google-v2").click();
  await expect(page.getByTestId("sync-status-panel")).toContainText("E2E User");
  await expect(page.getByTestId("sync-status-panel")).toContainText("同步完成");

  const credentialStorage = await page.evaluate(() => ({
    session: window.sessionStorage.getItem("pe_note_v2_google_session"),
    account: window.localStorage.getItem("pe_note_v2_google_last_account"),
  }));
  expect(credentialStorage.session).toContain("e2e-session-token");
  expect(credentialStorage.account).not.toContain("e2e-session-token");

  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("GOOGLE-OFFLINE-CACHE");
  await page.getByLabel("主要問題").fill("local-first draft");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await expect(page.getByTestId("sync-status-panel")).toContainText("待同步");

  await page.getByText("帳號與快取").click();
  await page.getByRole("button", { name: "離開 Google 模式" }).click();
  await expect(page.getByRole("button", { name: /GOOGLE-OFFLINE-CACHE/ })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("pe_note_v2_google_session"),
    ),
  ).toBeNull();

  await page.reload();
  await expect(page.getByTestId("open-google-cache-v2")).toContainText("E2E User");
  await page.getByTestId("open-google-cache-v2").click();
  await expect(
    page.getByRole("button", { name: /GOOGLE-OFFLINE-CACHE/ }),
  ).toBeVisible();

  await page.getByText("帳號與快取").click();
  await page.getByRole("button", { name: "清除此帳號快取" }).click();
  await expect(page.getByRole("alert")).toContainText("無法復原");
  await page.getByRole("button", { name: "確認清除此帳號快取" }).click();
  await page.reload();
  await expect(page.getByTestId("open-google-cache-v2")).toHaveCount(0);
});

test("v2 offers and imports legacy local data once, leaving the legacy record untouched", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "rounding_notes_v1",
      JSON.stringify({
        patients: [
          {
            id: "legacy-1",
            code: "LEGACY-E2E",
            specialty: "general",
            sex: "男 M",
            age: "68",
            problem: "legacy import e2e",
            createdAt: 10,
            updatedAt: 20,
            values: {},
            globalNote: "",
            blockNotes: {},
            todos: [],
          },
        ],
        antibioticOptions: [],
        customSets: [],
      }),
    );
  });
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByTestId("legacy-import-offer")).toContainText("1");
  await page.getByRole("button", { name: "匯入" }).click();

  await expect(page.getByTestId("legacy-import-done")).toContainText("已匯入 1 位病人");
  await expect(page.getByRole("button", { name: /LEGACY-E2E/ })).toBeVisible();

  const storedV2 = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(storedV2.patients).toHaveLength(1);
  expect(storedV2.patients[0].problem).toBe("legacy import e2e");

  const legacyStillIntact = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("rounding_notes_v1") ?? "null"),
  );
  expect(legacyStillIntact.patients).toHaveLength(1);

  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByTestId("legacy-import-offer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /LEGACY-E2E/ })).toBeVisible();
});

test("v2 clinical section tabs switch a single panel in place, without navigating", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("TAB-TEST");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: "ROS" }).click();

  const constitutional = page.locator('[data-clinical-section="ros_const"]');
  const skin = page.locator('[data-clinical-section="ros_skin"]');
  const beforeUrl = page.url();

  // No panel is open yet: both tabs are visible, neither is "active".
  await expect(constitutional).toBeVisible();
  await expect(skin).toBeVisible();
  await expect(page.locator(".v2-clinical-panel")).toHaveCount(0);

  await constitutional.click();
  await expect(constitutional).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".v2-clinical-panel")).toHaveCount(1);
  await expect(page.locator(".v2-clinical-panel__label")).toHaveText(
    "一般全身 Constitutional",
  );
  await page.getByTestId("finding-control-fever").click();
  expect(page.url()).toBe(beforeUrl);
  await expect(page.getByTestId("finding-total")).toContainText("1");

  // Switching to a different tab replaces the panel instead of opening a second one.
  await skin.click();
  await expect(constitutional).toHaveAttribute("aria-pressed", "false");
  await expect(skin).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".v2-clinical-panel")).toHaveCount(1);
  await expect(page.locator(".v2-clinical-panel__label")).toHaveText("皮膚 Skin");
  // The finding made earlier is preserved even though its panel is closed.
  await expect(page.getByTestId("finding-total")).toContainText("1");

  // The count badge on the fever section's tab reflects the earlier finding.
  await expect(constitutional.locator(".v2-clinical-tab__badge")).toHaveText("1");

  await page.getByRole("button", { name: "關閉區塊" }).click();
  await expect(page.locator(".v2-clinical-panel")).toHaveCount(0);
  await expect(skin).toHaveAttribute("aria-pressed", "false");
});

test("v2 clinical tabs stay compact on mobile and every tab in a row is the same height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("COMPACT-TEST");
  await page.getByLabel("科別 Department").selectOption("cms");
  await page.getByRole("button", { name: "建立並開始" }).click();

  // ROS and PE are now separate top-level tabs (never on screen together),
  // so each kind's own tab bar must independently stay compact.
  await page.getByRole("button", { name: "ROS" }).click();
  const rosHeading = page.getByRole("heading", { name: "ROS", exact: true });
  const rosTabs = page.locator(".v2-clinical-tabs");
  const [rosHeadingBox, rosTabsBox] = await Promise.all([
    rosHeading.boundingBox(),
    rosTabs.boundingBox(),
  ]);
  const rosTabAreaHeight =
    (rosTabsBox?.y ?? 0) + (rosTabsBox?.height ?? 0) - (rosHeadingBox?.y ?? 0);
  // ROS alone (12 sections) must stay well under one mobile screen, not the
  // "at least 1.5 screens" a flex-wrap layout gave the combined ROS+PE bar.
  expect(rosTabAreaHeight).toBeLessThan(300);
  expect(rosTabsBox?.height ?? 0).toBeGreaterThan(0);

  // A short trailing row (e.g. ROS's last row of 2) must not stretch to fill
  // the row -- every tab in the grid is the same size, gaps stay empty.
  const focusRosBox = await page
    .locator('[data-clinical-section="focus_ros"]')
    .boundingBox();
  const constitutionalBox = await page
    .locator('[data-clinical-section="ros_const"]')
    .boundingBox();
  expect(focusRosBox?.width).toBeCloseTo(constitutionalBox?.width ?? 0, 0);
  expect(focusRosBox?.height).toBeCloseTo(constitutionalBox?.height ?? 0, 0);

  await page.getByRole("button", { name: "PE", exact: true }).click();
  const peHeading = page.getByRole("heading", { name: "PE", exact: true });
  const peTabs = page.locator(".v2-clinical-tabs");
  const [peHeadingBox, peTabsBox] = await Promise.all([
    peHeading.boundingBox(),
    peTabs.boundingBox(),
  ]);
  const peTabAreaHeight =
    (peTabsBox?.y ?? 0) + (peTabsBox?.height ?? 0) - (peHeadingBox?.y ?? 0);
  expect(peTabAreaHeight).toBeLessThan(300);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
