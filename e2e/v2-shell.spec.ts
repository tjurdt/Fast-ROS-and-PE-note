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
