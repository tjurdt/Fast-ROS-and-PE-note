# 架構與維護策略

## 評估摘要

原始產品是一個約 304 KB 的 `index.html`，其中約 1,000 行 CSS 與 3,500 行 JavaScript 同時承擔臨床定義、畫面渲染、事件、localStorage、Google Drive 同步、衝突合併、資料 migration、匯出與列印。它可正常運作，但全域狀態與字串式 DOM 讓任何大改都容易產生遠端回歸。

目前專案採雙軌策略：legacy 是不再擴充的可執行 oracle；v2 使用 typed boundaries 重新實作。兩者都輸出單一離線 HTML，只有 v2 通過完整 parity gate 後才會切換正式入口。

## 雙軌結構

```text
Legacy production track                  v2 candidate track

src/index.template.html                  src/v2/index.html
src/styles/app.css                        src/app + domain + application
src/legacy/app.js                         infrastructure + features + ui
          │                                          │
          ▼                                          ▼
scripts/build.mjs                              Vite + React + TypeScript
          │                                          │
          ▼                                          ▼
index.html                                   dist-v2/index.html
正式、hash baseline 保護                    候選、自包含單檔、不提交
```

legacy asset manifest 只服務既有 classic script。v2 使用 ES modules、Vite module graph 與 `vite-plugin-singlefile`，不得把 v2 feature 加進 `config/assets.mjs`。

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

第一個 v2 slice 已打通「選擇單機 → 載入 repository → 建立病人 → 編輯 → 序列化儲存 → 重載」；ROS/PE、組套、匯出與 Google 同步仍由 legacy 提供。

## 資料策略

目前沒有正式使用者資料，因此 v2 使用獨立的 `pe_note_v2` key 與 `schemaVersion: 2`，不直接承接 legacy 物件。即使如此，所有 storage/network 邊界仍必須 runtime validation，以避免部分寫入或壞資料被靜默覆蓋。

正式切換前再決定是否需要一次性 legacy import。若建立 import，它必須是顯式、可測試且不覆寫來源的轉換，不應讓 v2 domain 永久背負 legacy shape。

## 自動護欄

- `check:generated` / `check:legacy`：確保正式 legacy 成品與行為基線沒有漂移。
- `typecheck` / `lint` / `format:check`：TypeScript strict、ESLint 與格式檢查。
- `test:legacy`：既有 jsdom 單機冒煙流程。
- `test:unit`：v2 domain、repository 與 React slice 測試。
- `build:v2` / `check:v2-artifact`：確認候選成品只有單一 HTML，沒有外部本機 CSS/JS。
- `test:e2e`：Chromium 驗證 legacy parity、手機寬度及 v2 建立/重載。
- GitHub Actions：安裝 Chromium 後執行完整 `npm run verify`。

## 切換正式入口的 gate

每搬一項功能，先把 legacy 行為固定成 Playwright 或 deterministic contract，再實作 v2。切換前至少完成：

1. 病人 CRUD、排序與重載。
2. 全部 ROS/PE 題型、Focus、gate 與陽性計數。
3. Admission、PMH、待辦與所有組套。
4. 完整版、限縮版、TXT 與列印輸出。
5. Google 授權、cache、離線、401、衝突與同步中再次編輯。
6. 手機與桌面主要操作流程。
7. 單檔 `file://`/靜態部署契約與安全檢查。

詳細決策見 `docs/adr/0002-controlled-v2-rewrite.md`。
