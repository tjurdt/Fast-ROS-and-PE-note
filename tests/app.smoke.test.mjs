import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { JSDOM, VirtualConsole } from "jsdom";

import { rootDir } from "../scripts/lib/render-app.mjs";

async function waitFor(check, description, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

test("offline local-mode happy path boots and persists a patient", async () => {
  const html = await readFile(path.join(rootDir, "index.html"), "utf8");
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("error", (...args) => consoleErrors.push(args.join(" ")));
  virtualConsole.on("jsdomError", (error) => consoleErrors.push(error.message));

  const dom = new JSDOM(html, {
    beforeParse(window) {
      window.alert = () => {};
      window.confirm = () => true;
      window.scrollTo = () => {};
    },
    pretendToBeVisual: true,
    runScripts: "dangerously",
    url: "https://pe-note.test/",
    virtualConsole,
  });

  try {
    const { document, localStorage } = dom.window;
    const chooseLocal = await waitFor(
      () => document.querySelector("#chooseLocal"),
      "storage-mode landing page",
    );
    assert.ok(document.querySelector("#chooseGoogle"));

    chooseLocal.click();
    const addPatient = await waitFor(
      () => document.querySelector("#fabNew"),
      "local patient list",
    );
    assert.equal(localStorage.getItem("rounding_storage_mode_v2"), "local");

    addPatient.click();
    const codeInput = document.querySelector("#nf_code");
    assert.ok(codeInput, "new-patient form should open");
    codeInput.value = "TEST-01";
    document.querySelector("#nf_create").click();

    const patientCode = await waitFor(
      () => document.querySelector("#pCode"),
      "patient note screen",
    );
    assert.equal(patientCode.value, "TEST-01");

    const saved = JSON.parse(localStorage.getItem("rounding_notes_v1"));
    assert.equal(saved.patients.length, 1);
    assert.equal(saved.patients[0].code, "TEST-01");
    assert.deepEqual(consoleErrors, []);
  } finally {
    dom.window.close();
  }
});
