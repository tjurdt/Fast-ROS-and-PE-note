# 架構與維護策略

## 評估摘要

原始產品是一個約 304 KB 的 `index.html`，其中約 1,000 行 CSS 與 3,500 行 JavaScript 同時承擔臨床定義、畫面渲染、事件、localStorage、Google Drive 同步、衝突合併、資料 migration、匯出與列印。它可正常運作，但全域狀態與字串式 DOM 讓任何大改都容易產生遠端回歸。

專案曾採雙軌策略重建：legacy 作為不再擴充的可執行 oracle，v2 用 typed boundaries 重新實作，兩者都輸出單一離線 HTML。2026-09-05（[ADR 0005](adr/0005-v2-production-cutover.md)）7 個切換 gate 全部有測試證據、一次性 import 完成、`npm run verify` 全綠後，v2 已切換為正式入口。**目前狀態是 [ADR 0004](adr/0004-legacy-retirement-and-v2-import.md) 的 Phase 2 觀察期：legacy 保留作為回退依據，尚未刪除，也不再擴充。**

## 目前結構

```text
v2 production track                      legacy rollback track（Phase 2 觀察期）

src/v2/index.html                        src/index.template.html
src/app + domain + application            src/styles/app.css
infrastructure + features + ui            src/legacy/app.js
          │                                          │
          ▼                                          ▼
  Vite + React + TypeScript              scripts/build-legacy.mjs
          │                                          │
          ▼                                          ▼
   dist-v2/index.html                      dist-legacy/index.html
          │                                候選、自包含單檔、不提交
          ▼                                （回退預覽 / 測試用）
  npm run promote:v2
          │
          ▼
     index.html
正式、由 npm run build 產生
```

legacy asset manifest（`config/assets.mjs`）只服務既有 classic script，僅在 Phase 2 期間修正 legacy 行為時才會用到。v2 使用 ES modules、Vite module graph 與 `vite-plugin-singlefile`，不得把 v2 feature 加進 `config/assets.mjs`。

## v2 依賴方向

```text
React feature / app
        │
        ▼
application workflows + ports
        │
        ▼
pure domain model

infrastructure adapters ──implements──▶ application ports
```

- `domain`：Zod schema、資料型別與純規則；不可依賴 React、DOM、storage 或 fetch。
- `application`：use cases 與 repository ports；不知道實際使用 localStorage 或 Google Drive。
- `infrastructure`：驗證所有外部資料並實作 ports。解析失敗不能覆寫原資料。
- `features`：以使用者能力切片的 React UI；各自維護 README 契約。
- `app`：畫面協調、依賴組裝、儲存佇列與全域錯誤呈現。
- `ui`：真正跨 feature、且不含 domain 流程的展示元件。

v2 已打通「選擇 repository → 載入 → 建立／搜尋／排序／安全刪除病人 → 編輯完整 workspace／ROS／PE／組套 → 序列化儲存 → 重載 → 摘要匯出」。清單查詢是無副作用的 domain 規則，搜尋與排序偏好不進入病人 schema；永久刪除經 UI 二次確認後才由 application workflow 產生新 database。Legacy oracle 機械同步 25 個區塊、194 個題目、16 個科別及臨床選項；全部題型、專用／自訂組套、匯出與列印皆已有 typed 實作。

Google 同步採 cache-first repository：病人每筆獨立做三方合併，全域設定以共同 base snapshot 判斷；無共同 base 時只做加法合併，避免空白新裝置誤刪遠端紀錄。真正雙邊衝突採目前裝置版本，但必須先成功建立遠端備份才允許覆寫。同步期間的新輸入會再 rebase 並維持 dirty，下一輪才上傳。

Google Identity Services 只在使用者明確登入時動態載入，access token 僅放記憶體與 `sessionStorage`，過期後由 UI 重新授權，不在背景開啟登入視窗。`CloudRepositoryConnector` 取得 Drive 的 opaque `permissionId` 後才建立該帳號的 cache repository；`localStorage` 只保存帳號標籤、cache locator 與已驗證資料，不保存 token。離線入口只載入上次帳號的裝置快取，切換帳號會建立不同 key；離開模式預設保留快取，永久清除必須再次確認。

## 資料策略

v2 使用獨立的 `pe_note_v2` key 與 `schemaVersion: 2`，不直接承接 legacy 物件。所有 storage/network 邊界仍必須 runtime validation，以避免部分寫入或壞資料被靜默覆蓋。

一次性 legacy（`rounding_notes_v1`）→ v2 import 已實作並接上 UI（`src/infrastructure/legacy-import/`、`src/features/legacy-import/`）：選擇本機模式且 v2 資料庫是空的、`rounding_notes_v1` 有病人時才會顯式提示；讀取唯讀，絕不寫回或刪除 legacy 資料。決策細節與 legacy 退場的分階段計畫見 [ADR 0004](adr/0004-legacy-retirement-and-v2-import.md)。

## 自動護欄

- `check:generated`：確保根目錄 `index.html` 與新鮮建置的 `dist-v2/index.html` 一致，沒有被手改或漂移（切換前比對的是 legacy render，見 [ADR 0005](adr/0005-v2-production-cutover.md)）。
- `check:legacy`：確保 `src/legacy/app.js` 原始碼本身沒有偏離 frozen baseline；與根目錄 `index.html` 現在放什麼無關，切換前後行為不變。
- `typecheck` / `lint` / `format:check`：TypeScript strict、ESLint 與格式檢查。
- `check:clinical-catalog`：確保生成的 25/194/16 catalog、CN panel、特殊 widget 與 workspace 選項和 frozen legacy oracle 完全一致。
- `check:v2-boundaries`：機械驗證 domain/application/infrastructure/feature/ui 的依賴方向及 feature isolation。
- `check:v2-parity`：機械驗證 [ADR 0002](adr/0002-controlled-v2-rewrite.md) 訂的 7 個切換 gate 各自都有對應測試證據。
- `test:legacy`：`dist-legacy/index.html` 的 jsdom 單機冒煙流程，驗證回退路徑仍可用。
- `test:unit`：v2 domain、repository、legacy import、同步衝突／離線／401／版本競爭與 React slice 測試。
- `build:v2` / `check:v2-artifact`：確認 `dist-v2/index.html` 只有單一 HTML，沒有外部本機 CSS/JS。
- `build:legacy`：產生 `dist-legacy/index.html` 供回退預覽與 `test:legacy`/`legacy-parity` e2e 使用。
- `test:e2e`：Chromium 驗證正式入口（`npm start`，v2）、v2 開發預覽、legacy 回退預覽三邊的手機／桌面主要流程、病人 CRUD／搜尋／排序／重載、特殊 widget、完整 workspace、legacy import，以及 mock Google 登入／離線快取生命週期。
- GitHub Actions：安裝 Chromium 後執行完整 `npm run verify`。

## 已完成：切換正式入口的 gate

以下 7 項在切換前（2026-09-05）全部完成，並由 `check:v2-parity` 持續機械驗證：

1. 病人 CRUD、排序與重載。
2. 全部 ROS/PE 題型、Focus、gate 與陽性計數。
3. 所有內建與自訂組套。
4. 完整版、限縮版、TXT 與列印輸出。
5. Google 授權、cache、離線、401、衝突與同步中再次編輯。
6. 手機與桌面主要操作流程。
7. 單檔 `file://`/靜態部署契約與安全檢查。

詳細決策見 [ADR 0002](adr/0002-controlled-v2-rewrite.md)。
同步安全決策見 [ADR 0003](adr/0003-local-first-google-sync.md)。
一次性 import 與退場計畫見 [ADR 0004](adr/0004-legacy-retirement-and-v2-import.md)。
切換執行細節見 [ADR 0005](adr/0005-v2-production-cutover.md)。

## 下一步：Phase 2 觀察期與 Phase 3 退場

目前處於 ADR 0004 的 Phase 2：legacy 原始碼、baseline 保護與專屬測試全部保留、持續在 CI 跑，純作回退保險，不再開發。建議觀察至少 2–4 週的實際 v2 使用後，才由人工確認進入 Phase 3（刪除 legacy 原始碼與相關腳本、測試，並將 ADR 0002 標記為 Superseded）。Phase 3 不會自動發生，需要明確決定。
