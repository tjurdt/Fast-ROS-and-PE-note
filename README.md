# Fast ROS and PE Note

一個可離線使用的單檔 ROS / PE 查房筆記工具。自 [ADR 0005](docs/adr/0005-v2-production-cutover.md)（2026-09-05）起，根目錄 `index.html` 是 TypeScript／React v2 的正式成品；舊版 legacy 已不再是正式入口，保留作為 [ADR 0004](docs/adr/0004-legacy-retirement-and-v2-import.md) Phase 2 觀察期的回退依據，尚未刪除。

## 開始開發

需求：Node.js 22 以上。

```bash
npm install
npx playwright install chromium
npm run verify
npm start
```

- 不要直接編輯根目錄的 `index.html`；它由 `npm run build` 從 v2 原始碼產生。
- `npm start` 在 `http://127.0.0.1:4173` 預覽正式 v2 成品。
- `npm run dev:v2` 在 `http://127.0.0.1:4174` 啟動 v2 開發環境。
- `npm run build:legacy` 產生 `dist-legacy/index.html`，是 legacy 的回退預覽成品，不是正式入口；`npm run preview:legacy` 可本機開啟它。
- `npm run verify` 執行 legacy baseline、TypeScript、lint、單元測試、單檔契約與 Playwright（v2 正式入口、v2 開發預覽、legacy 回退預覽三邊都會測）。

v2 已涵蓋病人建立／修改／搜尋／排序／安全刪除與重載、完整 25 區塊／194 題／16 科別 typed catalog、全部 ROS/PE 題型、Admission/ADL、PMH、待辦、全域與區塊備註、所有專用／自訂組套、臨床摘要匯出／列印，以及第一次開啟本機模式時偵測並匯入舊版 `rounding_notes_v1` 資料的一次性流程。Google 模式已完成 Identity Services 登入、session-only token、帳號隔離快取、離線開啟、三方合併、衝突備份與 Drive `appDataFolder` adapter。

## 專案地圖

```text
index.html                正式 v2 單檔成品，由 npm run build 產生
dist-legacy/index.html    legacy 回退預覽成品（不提交），由 npm run build:legacy 產生
src/legacy/               凍結中的舊版應用，受 baseline 保護，僅供回退期間參考
src/domain/               v2 純資料模型與規則
src/domain/clinical/      從 legacy oracle 同步並驗證的 clinical catalog
src/application/          v2 use cases 與 infrastructure ports
src/infrastructure/       v2 local / Google / legacy-import adapters
src/features/             v2 垂直功能切片
src/app/                  v2 orchestration 與啟動
src/v2/index.html         Vite HTML 入口
dist-v2/index.html        v2 build 直接輸出（不提交），npm run build 會把它提升為根目錄 index.html
tests/v2/                 v2 單元與元件測試
e2e/                      v2 正式入口／開發預覽與 legacy 回退預覽的瀏覽器測試
```

新增功能前請讀 [新增功能指南](docs/ADDING_A_FEATURE.md)；整體設計與目前風險見 [架構說明](docs/ARCHITECTURE.md)。

## 隱私提醒

這是臨床紀錄輔助工具，不應在缺乏院方授權與適當保護時儲存可直接識別病人的資料。建議使用床號或自訂代碼，並依所屬機構的資訊安全、個資與醫療紀錄規範使用。
