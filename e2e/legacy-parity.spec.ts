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
