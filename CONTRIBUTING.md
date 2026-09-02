# 貢獻指南

## 基本流程

1. 從最新主分支建立小而單一目的的變更。
2. 新功能建立在 `src/features/<feature-name>/`，先寫該功能的 `README.md` 契約。
3. 需要進入單檔成品的 CSS/JS，依執行順序明確加入 `config/assets.mjs`。
4. 執行 `npm run build`，再執行 `npm run verify`。
5. 一併提交來源、測試與生成後的 `index.html`。

## 不可破壞的契約

- 根目錄 `index.html` 必須維持單檔可執行，不增加本機靜態資源依賴。
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
npm run verify
```

baseline 變更是審查訊號，不是略過測試的方式。
