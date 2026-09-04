# 貢獻指南

## Commit message

- 格式:`<area>: <改了什麼>，because <為什麼／解決什麼問題>`。`area` 用路徑片段或 feature 名稱(如 `bundles`、`google-drive-connector`、`docs`),不要只寫動詞。
- 禁止只寫 `improve`、`fix`、`update`、`WIP` 這類空泛訊息。目標是讓之後的人(或下一次接手的 AI session)光看 `git log` 就知道這個 commit 做了什麼、為什麼要做,不用重新讀 diff 猜意圖。
- 一個 commit 一個目的,不要把無關的 cleanup、依賴升版和行為變更混在同一個 commit。
- 若這個 commit 更新了 legacy baseline 或 clinical catalog,訊息要帶上 `accept:legacy`/`sync:clinical-catalog` 使用的 `--reason`,不要只寫「更新 baseline」。

## Git hooks

`npm install` 會透過 `prepare` script 自動安裝 Husky hook:

- **pre-commit**:對本次 staged 的檔案跑 `eslint --fix` + `prettier --write`(見 `lint-staged` 設定),再跑一次全專案 `typecheck`。幾秒內完成,抓格式與型別問題。
- **pre-push**:跑 `check:architecture`、`check:v2-boundaries`、`check:clinical-catalog`、`check:legacy` 與 `test:unit`。約一分鐘內完成,抓結構邊界與行為回歸。

這兩層都只是本地快速防線,不含 `build:v2`、`test:e2e` 等較重的步驟。它們不能取代推送前完整跑一次 `npm run verify`——CI 仍然是最終判準。臨時需要略過(例如中間暫存 commit)可用 `git commit --no-verify` / `git push --no-verify`,但正常流程不應依賴它。

## 基本流程

1. 從最新主分支建立小而單一目的的變更。
2. 新功能建立在 `src/features/<feature-name>/`，先寫該功能的 `README.md` 契約。
3. 新功能一律進入 TypeScript/React v2，以 ES module 明確匯入；不要加入 legacy asset manifest。
4. 若涉及既有 legacy 行為的搬移或修正，先加入 parity 或 contract test。
5. 執行 `npm run verify`。
6. `index.html`、`dist-v2/`、`dist-legacy/` 都不提交、不可手改，一律由對應 build script 產生。

若 intentional legacy 修正改動 `SECTIONS`、`SPECIALTIES`、神經學 widget、PMH、Admission 或 ADL 選項，必須執行 `npm run sync:clinical-catalog`，審查生成 catalog 差異並更新相應 parity 測試。

## 不可破壞的契約

- 根目錄 `index.html`（v2 正式成品，見 [ADR 0005](docs/adr/0005-v2-production-cutover.md)）必須維持單檔可執行，不增加本機靜態資源依賴。
- `dist-legacy/index.html` 也必須是單檔，做為 Phase 2 觀察期的回退預覽，不得被拿來取代根目錄成品。
- 既有 localStorage key（含 legacy 的 `rounding_notes_v1`）、Google Drive schema 與離線資料必須向後相容。
- migration 必須可重複執行，且不得刪除未知欄位。
- 不提交 Client Secret、private key、病人資料或測試用真實識別資訊。
- 不把新功能直接塞入 `src/legacy/app.js`；必要的 legacy 修正需有回歸測試與接受理由。

## Legacy 的例外流程

Legacy 現在只在 ADR 0004 的 Phase 2 觀察期作為回退依據，不再擴充。若 bug 只能在 `src/legacy/app.js` 修正：

1. 先加入會在修正前失敗的回歸測試。
2. 做最小修正，不順便重構無關區域。
3. 執行 `npm run verify`。
4. 確認測試通過後，以具體理由更新 baseline：

```bash
npm run accept:legacy -- --reason "修正哪個既有契約，以及為何無法從 feature 邊界處理"
npm run verify
```

baseline 變更是審查訊號，不是略過測試的方式。
