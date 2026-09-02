# Fast ROS and PE Note

一個可離線使用的單檔 ROS / PE 查房筆記工具。目前採雙軌開發：根目錄 `index.html` 是尚未改變的正式 legacy 成品；TypeScript／React v2 在 parity 測試保護下逐步重建，尚未切換正式入口。

## 開始開發

需求：Node.js 22 以上。

```bash
npm install
npx playwright install chromium
npm run build
npm run build:v2
npm run verify
npm start
```

- 不要直接編輯根目錄的 `index.html`。
- `npm start` 在 `http://127.0.0.1:4173` 預覽正式 legacy 成品。
- `npm run dev:v2` 在 `http://127.0.0.1:4174` 啟動 v2 開發環境。
- `npm run build:v2` 產生自包含的 `dist-v2/index.html`，但不覆蓋正式入口。
- `npm run verify` 執行 legacy baseline、TypeScript、lint、單元測試、單檔契約與 Playwright parity。

目前 v2 已包含完整 25 區塊／194 題／16 科別 typed catalog、Focus/gate、全部 ROS/PE 題型（含 DTR、Babinski、Sensory、CN detail）、陽性計數與本機重載。Admission、PMH、組套、匯出與 Google 同步仍待 parity 遷移。

## 專案地圖

```text
index.html                正式 legacy 單檔成品，尚未改變
src/legacy/               受 baseline 保護的既有應用
src/domain/               v2 純資料模型與規則
src/domain/clinical/      從 legacy oracle 同步並驗證的 clinical catalog
src/application/          v2 use cases 與 infrastructure ports
src/infrastructure/       v2 local / Google adapters
src/features/             v2 垂直功能切片
src/app/                  v2 orchestration 與啟動
src/v2/index.html         Vite HTML 入口
dist-v2/index.html        v2 單檔候選成品（不提交）
tests/v2/                 v2 單元與元件測試
e2e/                      legacy parity 與 v2 瀏覽器測試
```

新增功能前請讀 [新增功能指南](docs/ADDING_A_FEATURE.md)；整體設計與目前風險見 [架構說明](docs/ARCHITECTURE.md)。

## 隱私提醒

這是臨床紀錄輔助工具，不應在缺乏院方授權與適當保護時儲存可直接識別病人的資料。建議使用床號或自訂代碼，並依所屬機構的資訊安全、個資與醫療紀錄規範使用。
