# 貢獻指南

## 基本流程

1. 從最新主分支建立小而單一目的的變更。
2. 新功能建立在 `src/features/<feature-name>/`，先寫該功能的 `README.md` 契約。
3. 新功能預設進入 TypeScript/React v2，以 ES module 明確匯入；不要加入 legacy asset manifest。
4. 先為要搬移的既有行為加入 parity 或 contract test。
5. 執行 `npm run build && npm run build:v2 && npm run verify`。
6. legacy 未變時根目錄 `index.html` 應保持原 hash；v2 成品在 CI 重建，不提交 `dist-v2/`。

若 intentional legacy 修正改動 `SECTIONS` 或 `SPECIALTIES`，必須執行 `npm run sync:clinical-catalog`，審查生成 catalog 差異並更新相應 parity 測試。

## 不可破壞的契約

- 根目錄 `index.html` 必須維持單檔可執行，不增加本機靜態資源依賴。
- `dist-v2/index.html` 也必須是單檔，且未達 parity gate 前不得取代根目錄成品。
- 既有 localStorage key、Google Drive schema 與離線資料必須向後相容。
- migration 必須可重複執行，且不得刪除未知欄位。
- 不提交 Client Secret、private key、病人資料或測試用真實識別資訊。
- 不把新功能直接塞入 `src/legacy/app.js`；必要的 legacy 修正需有回歸測試與接受理由。

## Legacy 的例外流程

若 bug 只能在 `src/legacy/app.js` 修正：

1. 先加入會在修正前失敗的回歸測試。
2. 做最小修正，不順便重構無關區域。
3. 執行 `npm run build && npm run verify`。
4. 確認測試通過後，以具體理由更新 baseline：

```bash
npm run accept:legacy -- --reason "修正哪個既有契約，以及為何無法從 feature 邊界處理"
npm run build
npm run build:v2
npm run verify
```

baseline 變更是審查訊號，不是略過測試的方式。
