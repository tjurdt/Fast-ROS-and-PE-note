export const v2ParityGates = Object.freeze([
  {
    id: "patient-lifecycle",
    description: "病人建立、修改、刪除、搜尋、排序與重載",
    evidence: [
      {
        kind: "unit",
        path: "tests/v2/patient-list.test.ts",
        marker: 'describe("patient list rules"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker: 'test("v2 patient list searches, sorts, and safely persists deletion"',
      },
    ],
  },
  {
    id: "clinical-catalog",
    description: "全部 ROS/PE 題型、Focus、gate 與陽性計數",
    evidence: [
      {
        kind: "contract",
        path: "tests/v2/clinical-rules.test.ts",
        marker: 'describe("clinical catalog parity"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker: 'test("v2 neurological widgets match legacy state and survive reload"',
      },
      {
        kind: "browser",
        path: "e2e/legacy-parity.spec.ts",
        marker: 'test("legacy specialty focus and gynecology gates remain stable"',
      },
    ],
  },
  {
    id: "workspace-and-bundles",
    description: "Admission、PMH、待辦與所有內建／自訂組套",
    evidence: [
      {
        kind: "unit",
        path: "tests/v2/bundles.test.ts",
        marker: 'describe("bundle domain"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker: 'test("v2 note workspace persists todo, history, ADL, and block notes"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker:
          'test("v2 custom bundle templates retain stable patient values through edits and archive"',
      },
    ],
  },
  {
    id: "clinical-export",
    description: "完整版、限縮版、TXT 與列印輸出",
    evidence: [
      {
        kind: "unit",
        path: "tests/v2/clinical-summary.test.ts",
        marker: 'describe("clinical summary"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker:
          'test("v2 clinical summary previews, copies, downloads, and prints without changing patient data"',
      },
    ],
  },
  {
    id: "google-sync",
    description: "Google 授權、cache、離線、401、衝突與同步中再次編輯",
    evidence: [
      {
        kind: "unit",
        path: "tests/v2/synchronized-patient-repository.test.ts",
        marker: 'describe("SynchronizedPatientRepository"',
      },
      {
        kind: "unit",
        path: "tests/v2/google-identity-token-provider.test.ts",
        marker: 'describe("GoogleIdentityTokenProvider"',
      },
      {
        kind: "browser",
        path: "e2e/v2-shell.spec.ts",
        marker:
          'test("v2 Google mode keeps session credentials separate and reopens its cache offline"',
      },
    ],
  },
  {
    id: "responsive-workflows",
    description: "手機與桌面主要操作流程",
    evidence: [
      {
        kind: "browser",
        path: "e2e/legacy-parity.spec.ts",
        marker: 'test("legacy landing and patient list remain usable at a mobile viewport"',
      },
      {
        kind: "browser",
        path: "e2e/v2-deployment.spec.ts",
        marker: 'test("v2 desktop workflow remains usable without horizontal overflow"',
      },
    ],
  },
  {
    id: "single-file-deployment",
    description: "單檔 file:// 與靜態部署安全契約",
    evidence: [
      {
        kind: "build",
        path: "scripts/check-v2-artifact.mjs",
        marker: "v2 artifact checks failed",
      },
      {
        kind: "browser",
        path: "e2e/v2-deployment.spec.ts",
        marker: 'test("v2 built artifact boots and persists locally over file protocol"',
      },
    ],
  },
]);
