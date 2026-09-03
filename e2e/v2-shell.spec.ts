import { expect, test } from "@playwright/test";

test("v2 single-file shell creates and reloads a typed local patient", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("V2-TEST-01");
  await page.getByLabel("年齡 Age").fill("65");
  await page.getByLabel("主要問題").fill("Architecture parity");
  await page.getByLabel("科別 Department").selectOption("cms");
  await page.getByRole("button", { name: "建立並開始" }).click();

  await expect(page.getByLabel("病人代號")).toHaveValue("V2-TEST-01");
  const focusRos = page.locator('[data-clinical-section="focus_ros"]');
  await expect(focusRos).toContainText("Focus ROS");
  await focusRos.locator(".v2-clinical-section__header").click();
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

  const focusPe = page.locator('[data-clinical-section="focus_pe"]');
  await focusPe.locator(".v2-clinical-section__header").click();

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
  await page
    .locator('[data-clinical-section="focus_pe"] .v2-clinical-section__header')
    .click();

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

  const todoRegion = page.getByRole("region", { name: "待辦事項" });
  await todoRegion.getByRole("button", { name: "＋ 新增" }).click();
  await page.getByLabel("待辦內容").fill("追蹤血液培養");
  await page.getByRole("button", { name: "追蹤血液培養：設為重要" }).click();
  await page.getByRole("button", { name: "追蹤血液培養：完成" }).click();
  await page.getByLabel("其他備註 Additional notes").fill("家屬已知情");

  const admission = page.getByTestId("admission-section");
  await admission.locator(".v2-clinical-section__header").click();
  await admission.getByRole("button", { name: "菸 Smoking" }).click();
  await page.getByTestId("admission-drugAllergy").click();
  await page.getByLabel("藥物過敏內容").fill("Penicillin rash");
  await page.getByLabel("旅遊 Travel").fill("日本");
  await page.getByLabel("家族史 Family history").fill("父親 HTN");
  await page.getByTestId("adl-level").click();
  await admission.getByRole("button", { name: "家人 Family" }).click();
  await page.getByLabel("家人姓名或關係 Family member").fill("女兒");
  await expect(admission.locator(".v2-clinical-section__header")).toContainText("4 項");

  const pmh = page.getByTestId("pmh-section");
  await pmh.locator(".v2-clinical-section__header").click();
  await page.getByLabel("選擇常見過去病史").selectOption("高血壓 Hypertension");

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

  await expect(page.getByLabel("待辦內容")).toHaveValue("追蹤血液培養");
  await expect(
    page.getByRole("button", { name: "追蹤血液培養：完成" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("其他備註 Additional notes")).toHaveValue("家屬已知情");

  await page
    .getByTestId("admission-section")
    .locator(".v2-clinical-section__header")
    .click();
  await expect(page.getByLabel("藥物過敏內容")).toHaveValue("Penicillin rash");
  await expect(page.getByTestId("adl-level")).toContainText("部分依賴");
  await expect(page.getByLabel("家人姓名或關係 Family member")).toHaveValue("女兒");

  await page.getByTestId("pmh-section").locator(".v2-clinical-section__header").click();
  await expect(
    page.getByRole("textbox", { name: "過去病史 1", exact: true }),
  ).toHaveValue("高血壓 Hypertension");
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
