# Fast ROS and PE Note

一個可離線使用的單檔 ROS / PE 查房筆記工具。部署與分享的成品仍是根目錄的 `index.html`；開發來源已拆分，避免未來所有功能持續堆進同一個 HTML。

## 開始開發

需求：Node.js 22 以上。

```bash
npm install
npm run build
npm run verify
npm start
```

- 編輯 `src/`，不要直接編輯根目錄的 `index.html`。
- `npm run build` 依 `config/assets.mjs` 產生單檔成品。
- `npm run verify` 執行生成檔、legacy、架構、語法、格式、lint 與冒煙測試檢查。
- `npm start` 在 `http://127.0.0.1:4173` 預覽成品。

## 專案地圖

```text
src/index.template.html   HTML 外殼
src/styles/app.css        既有樣式（legacy）
src/legacy/app.js         既有應用，受 baseline 保護
src/core/                 未來可共用的穩定邊界
src/features/             未來功能的垂直切片
config/assets.mjs         單檔成品的載入順序
scripts/                  建置與品質檢查
tests/                    行為與契約測試
docs/                     架構決策與開發指南
index.html                自動生成、可離線執行的發布成品
```

新增功能前請讀 [新增功能指南](docs/ADDING_A_FEATURE.md)；整體設計與目前風險見 [架構說明](docs/ARCHITECTURE.md)。

## 隱私提醒

這是臨床紀錄輔助工具，不應在缺乏院方授權與適當保護時儲存可直接識別病人的資料。建議使用床號或自訂代碼，並依所屬機構的資訊安全、個資與醫療紀錄規範使用。
