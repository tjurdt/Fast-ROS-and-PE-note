import { readFile } from "node:fs/promises";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const artifactPath = path.join(rootDir, "dist-v2", "index.html");
const html = await readFile(artifactPath, "utf8").catch(() => null);

if (!html) {
  console.error("Missing dist-v2/index.html. Run `npm run build:v2` first.");
  process.exit(1);
}

const failures = [];
const artifactBytes = Buffer.byteLength(html, "utf8");
if (artifactBytes < 10_000) failures.push("artifact is unexpectedly small");
if (artifactBytes > 750_000) failures.push("artifact exceeds the 750 KB size budget");
if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  failures.push("artifact contains an external script source");
}
if (/<link\b[^>]*\brel=["']?stylesheet\b/i.test(html)) {
  failures.push("artifact contains an external stylesheet");
}
if (!html.includes('id="root"')) failures.push("React root element is missing");
if (!html.includes("PE Note v2")) failures.push("v2 identity marker is missing");
if (!/<meta\b[^>]*name=["']referrer["'][^>]*content=["']no-referrer["']/i.test(html)) {
  failures.push("no-referrer deployment policy is missing");
}
if (!/<meta\b[^>]*name=["']google-oauth-client-id["']/i.test(html)) {
  failures.push("public Google OAuth client identifier is missing");
}

// Count closing tags, not opening tags: React's minified runtime embeds the string
// "<script><\/script>" as a DOM sentinel, with the closing half deliberately
// backslash-escaped so it cannot terminate the real surrounding <script> block. That
// escape defeats an opening-tag scan (a bare "<script" substring still matches) but
// leaves no unescaped "</script>" behind, so counting closing tags reflects the
// actual number of script elements instead of false-positiving on bundled JS text.
const executableScripts = html.match(/<\/script>/gi) ?? [];
const inlineStyles = html.match(/<style\b/gi) ?? [];
if (executableScripts.length !== 1) {
  failures.push(`artifact contains ${executableScripts.length} script elements`);
}
if (inlineStyles.length !== 1) {
  failures.push(`artifact contains ${inlineStyles.length} style elements`);
}

const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
  (match) => match[1] ?? "",
);
for (const css of styleBlocks) {
  const externalUrls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(
    (match) => match[1]?.trim() ?? "",
  );
  if (externalUrls.some((url) => url && !url.startsWith("data:") && url !== "#")) {
    failures.push("artifact CSS contains a non-embedded URL");
  }
}

const unsafeArtifactPatterns = [
  { pattern: /sourceMappingURL\s*=/i, label: "a source map reference" },
  { pattern: /client[_-]?secret\s*[:=]/i, label: "an OAuth client secret" },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: "a private key" },
  { pattern: /AIza[0-9A-Za-z_-]{35}/, label: "a Google API key" },
  { pattern: /ya29\.[0-9A-Za-z_-]{20,}/, label: "a Google access token" },
  {
    pattern: /(?:[A-Za-z]:\\Users\\|\/Users\/|\/home\/)[^\s"'<>]+/,
    label: "an absolute developer path",
  },
  { pattern: /(?:localhost|127\.0\.0\.1)(?::\d+)?/i, label: "a local server URL" },
];
for (const { pattern, label } of unsafeArtifactPatterns) {
  if (pattern.test(html)) failures.push(`artifact contains ${label}`);
}

if (failures.length > 0) {
  console.error(`v2 artifact checks failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `v2 is a self-contained deployment-safe single-file artifact (${artifactBytes} bytes).`,
  );
}
