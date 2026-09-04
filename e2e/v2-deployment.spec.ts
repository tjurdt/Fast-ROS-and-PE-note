import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

test("v2 desktop workflow remains usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("DESKTOP-01");
  await page.getByLabel("主要問題").fill("Desktop deployment audit");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /^一般全身 Constitutional/ }).click();
  await page.getByTestId("finding-control-fever").click();

  await expect(page.getByTestId("finding-total")).toContainText("1");
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    shellWidth: document.querySelector<HTMLElement>(".v2-shell")?.offsetWidth ?? 0,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.shellWidth).toBeGreaterThan(600);
  expect(layout.shellWidth).toBeLessThanOrEqual(760);
});

test("v2 built artifact boots and persists locally over file protocol", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) externalRequests.push(request.url());
  });
  const artifactUrl = pathToFileURL(
    path.resolve(process.cwd(), "dist-v2", "index.html"),
  ).href;

  await page.goto(artifactUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  expect(await page.evaluate(() => window.location.protocol)).toBe("file:");
  await expect(page.getByRole("heading", { name: "查房快速紀錄" })).toBeVisible();
  await expect(page.getByTestId("choose-google-v2")).toBeDisabled();
  await expect(page.getByTestId("choose-google-v2")).toContainText(
    "Google 登入需從 HTTPS 網址開啟",
  );

  await page.getByTestId("choose-local-v2").click();
  await page.getByRole("button", { name: "＋ 新增病人" }).click();
  await page.getByLabel("病人代號 Patient code").fill("FILE-OFFLINE-01");
  await page.getByLabel("主要問題").fill("Single-file offline audit");
  await page.getByRole("button", { name: "建立並開始" }).click();
  await page.getByRole("button", { name: /病人清單/ }).click();
  await expect(page.getByRole("button", { name: /FILE-OFFLINE-01/ })).toBeVisible();

  await page.reload();
  await page.getByTestId("choose-local-v2").click();
  await expect(page.getByRole("button", { name: /FILE-OFFLINE-01/ })).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pe_note_v2") ?? "null"),
  );
  expect(stored).toMatchObject({
    schemaVersion: 2,
    patients: [{ code: "FILE-OFFLINE-01", problem: "Single-file offline audit" }],
  });
  expect(externalRequests).toEqual([]);
});
