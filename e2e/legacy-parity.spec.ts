import { expect, test } from "@playwright/test";

test("legacy local workflow persists findings and preserves export semantics", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "查房快速紀錄" })).toBeVisible();
  await page.getByRole("button", { name: /單機使用/ }).click();

  await page.locator("#fabNew").click();
  await page.locator("#nf_code").fill("TEST-01");
  await page.locator("#nf_sex").selectOption("女 F");
  await page.locator("#nf_age").fill("72");
  await page.locator("#nf_problem").fill("Pneumonia");
  await page.locator("#nf_create").click();

  await expect(page.locator("#pCode")).toHaveValue("TEST-01");
  const fever = page.locator('[data-item="fever"]').first();
  const feverSection = fever.locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' section ')][1]",
  );
  await feverSection.locator(".sec-head").click();
  await fever.locator("[data-toggle]").click();
  await fever.locator('[data-fu="fever_t"]').fill("38.5°C");
  await expect(page.locator("#summary")).toContainText("1");

  const limitedExport = await page.evaluate(() => {
    const legacyWindow = window as typeof window & {
      buildText: (limited: boolean) => string;
    };
    return legacyWindow.buildText(true);
  });
  expect(limitedExport).toContain("病人代號：TEST-01");
  expect(limitedExport).toContain("主要問題：Pneumonia");
  expect(limitedExport).toContain("Fever");
  expect(limitedExport).toContain("38.5°C");

  await page.locator("#backBtn").click();
  await page.reload();
  await expect(page.getByText("TEST-01", { exact: true })).toBeVisible();
  await page.getByText("TEST-01", { exact: true }).click();
  await expect(page.locator('[data-item="fever"] [data-toggle]').first()).toHaveText(
    /陽性/,
  );

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("rounding_notes_v1") ?? "null"),
  );
  expect(stored.patients).toHaveLength(1);
  expect(stored.patients[0].values.fever.on).toBe(true);
});

test("legacy specialty focus and gynecology gates remain stable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /單機使用/ }).click();
  await page.locator("#fabNew").click();
  await page.locator("#nf_code").fill("GATE-TEST");
  await page.locator("#nf_sex").selectOption("女 F");
  await page.locator("#nf_spec").selectOption("general");
  await page.locator("#nf_create").click();

  await expect(page.locator('[data-item="lmp"]')).toHaveCount(1);
  await expect(page.locator('[data-item="ga"]')).toHaveCount(0);

  await page.locator("#specSel").selectOption("obs");
  await expect(page.locator('[data-item="ga"]')).toHaveCount(1);
  await expect(page.locator('[data-item="fetal_heart"]')).toHaveCount(1);

  await page.locator("#specSel").selectOption("cms");
  const cough = page.locator('[data-item="cough"]');
  await expect(cough).toHaveCount(1);
  await expect(
    cough.locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' section ')][1]",
    ),
  ).toHaveClass(/focus/);
});

test("legacy landing and patient list remain usable at a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /單機使用/ }).click();
  await expect(page.locator("#fabNew")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("legacy note workspace persists todo, history, ADL, and block notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /單機使用/ }).click();
  await page.locator("#fabNew").click();
  await page.locator("#nf_code").fill("WORKSPACE-LEGACY");
  await page.locator("#nf_create").click();

  await page.locator("#addTodoBtn").click();
  await page.locator(".todo-text").fill("追蹤血液培養");
  await page.locator(".todo-star").click();
  await page.locator('.todo-row [data-st="done"]').click();
  await page.locator("#globalNote").fill("家屬已知情");

  const admission = page.locator(".section.admission");
  await admission.locator(".sec-head").click();
  await admission.locator('[data-adm-chip="菸 Smoking"]').click();
  await admission.locator('[data-adm-tgl="drugAllergy"]').click();
  await admission.locator('[data-adm-note="drugAllergy"]').fill("Penicillin rash");
  await admission.locator('[data-adm-tocc="t"]').fill("日本");
  await admission.locator("[data-adm-fam]").fill("父親 HTN");
  await admission.locator("#adlBtn").click();
  await admission.locator('[data-cg="family"]').click();
  await expect(admission.locator(".cnt")).toHaveText("4");

  const pmh = page.locator(".section.pmh");
  await pmh.locator(".sec-head").click();
  await pmh.locator("#pmhPick").selectOption("高血壓 Hypertension");

  const constitutional = page
    .locator('[data-item="fever"]')
    .first()
    .locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' section ')][1]",
    );
  await constitutional.locator("[data-secnote]").click();
  await constitutional.locator(".blocknote-input").fill("感染症狀區塊備註");

  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("rounding_notes_v1") ?? "null"),
      );
      return stored?.patients?.[0]?.blockNotes?.ros_const;
    })
    .toBe("感染症狀區塊備註");

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("rounding_notes_v1") ?? "null"),
  );
  const patient = stored.patients[0];
  expect(patient.todos[0]).toMatchObject({
    text: "追蹤血液培養",
    important: true,
    status: "done",
  });
  expect(patient.globalNote).toBe("家屬已知情");
  expect(patient.admission.drugAllergyNote).toBe("Penicillin rash");
  expect(patient.admission.tocc.t).toBe("日本");
  expect(patient.adl.level).toBe("Partially dependent 部分依賴");
  expect(patient.adl.family).toBe(true);
  expect(patient.pmh[0].text).toBe("高血壓 Hypertension");
});
