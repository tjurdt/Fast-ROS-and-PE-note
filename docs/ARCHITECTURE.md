# 架構與維護策略

## 評估摘要

導入基礎建設前，專案只有一個約 304 KB 的 `index.html`。其中約 1,000 行 CSS 與 3,500 行 JavaScript 同時承擔臨床定義、畫面渲染、事件、localStorage、Google Drive 同步、衝突合併、資料 migration、匯出與列印。產品可以運作，但缺少建置、測試、lint、CI 與修改邊界；持續直接追加功能會快速提高全域名稱衝突、資料不相容與同步回歸的風險。

本次只改變開發與品質流程。原始 inline CSS/JavaScript 是機械式抽出，初始建置能重建相同的 `index.html`，沒有更改既有執行路徑。

## 現行結構

```text
src/index.template.html
        │
        ├── {{APP_CSS}} ◀── config/assets.mjs ◀── styles + feature CSS
        └── {{APP_JS}}  ◀── config/assets.mjs ◀── legacy + core + features
                                      │
                                      ▼
                                  index.html
                             （單檔離線發布物）
```

`scripts/build.mjs` 按 manifest 順序串接來源，仍只輸出一個 inline style 與 classic script。這保留直接下載 HTML 後以瀏覽器開啟的能力，也讓未來程式碼能依功能拆檔。

## 邊界與依賴方向

1. `legacy` 是目前可運作產品的行為基線。新功能不以擴充此檔為預設。
2. `core` 只提供窄而穩定的共用契約，暫時可包含 legacy bridge。
3. `features` 是垂直切片，包含自己的 UI、狀態協調、樣式與契約說明。
4. feature 可依賴 core；core 不依賴 feature；feature 不直接依賴另一個 feature 的內部實作。
5. 只有發布所需進入點列在 asset manifest；測試與開發工具不進成品。

目前 legacy 尚未有公開 API。第一個真正需要既有狀態的新功能，應在 `src/core/` 建立最小 bridge，集中存取 `DB`、`CUR`、`save()` 或渲染入口；不要讓這些全域耦合擴散到每個 feature。待契約與測試穩定後，再逐步把相關 legacy 邏輯搬出，而不是一次重寫整個應用。

## 資料相容性

既有資料比程式碼更難恢復，因此以下視為公開契約：

- localStorage 的 `rounding_notes_v1` 與儲存模式相關 keys。
- Google Drive `rounding-notes-cloud-v1` envelope 與 appDataFolder 檔案。
- 病人、組套、抗生素選項與同步 base snapshot 中未知欄位的保留。

新增 schema 時應採 additive 欄位、缺省值正規化與 idempotent migration。不可用「清空資料即可」作為升級策略；同步層改動還需涵蓋離線編輯、跨裝置衝突及同步途中再次編輯。

## 自動護欄

- `check:generated`：阻止直接修改或忘記重建 `index.html`。
- `check:legacy`：以換行正規化後的 hash 凍結現有大型腳本。
- `check:architecture`：驗證 manifest、單檔離線、固定 DOM、持久化契約與常見 secret。
- `check:syntax` / `lint` / `format:check`：檢查新程式與基礎建設。
- `test`：以 DOM 環境實際走過啟動、切換單機、新增病人與 localStorage 持久化。
- GitHub Actions：每次 push 與 pull request 執行完整 `npm run verify`。

## 漸進式改善順序

後續不要先做大爆炸重寫。較安全的順序是：

1. 每次產品需求都建立 feature slice 與回歸測試。
2. 第一次需要 legacy 狀態時建立窄 bridge；第二個使用者出現後才抽成 core abstraction。
3. 優先抽離純函式：資料正規化、文字輸出模型、陽性判斷與 three-way merge，並補單元測試。
4. 再抽離 storage adapters，讓 local 與 Google 同一組契約測試可替換執行。
5. 最後才處理 UI component 化；每一步維持單檔輸出與資料相容。
