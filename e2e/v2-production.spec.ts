import { expect, test } from "@playwright/test";

test("v2 production artifact (index.html via npm start) boots, persists, and ships no legacy chrome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.getByRole("heading", { name: "查房快速紀錄" })).toBeVisible();
  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("PROD-01");
  await page.getByLabel("主要問題").fill("production entry check");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^一般全身 Constitutional/ }).click();
  await page.getByTestId("finding-control-fever").click();
  await expect(page.getByTestId("finding-total")).toContainText("1");

  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByRole("button", { name: /PROD-01/ })).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored.schemaVersion).toBe(2);
  expect(stored.patients[0].problem).toBe("production entry check");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  // The production artifact must be the v2 build, not a stray legacy copy.
  expect(await page.locator("#fabNew").count()).toBe(0);
  expect(
    await page.evaluate(() => window.localStorage.getItem("rounding_notes_v1")),
  ).toBe(null);
});
