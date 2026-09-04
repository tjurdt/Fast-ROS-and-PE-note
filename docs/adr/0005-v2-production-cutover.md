# ADR 0005:v2 切換為正式入口(ADR 0004 Phase 1 執行)

- 狀態:Accepted
- 日期:2026-09-05

## 背景

ADR 0004 訂出 Phase 1(切換)的三個條件:

1. `config/v2-parity.mjs` 列的 7 個 gate 全部有測試證據(`check:v2-parity` 通過)。
2. 一次性 legacy import 已實作並有測試覆蓋。
3. `npm run verify` 全綠,含 `test:e2e`。

三者在此刻全部成立。這是機械檢查通過,不是逐行證明 v2 與 3,500 行 legacy 完全等價——194 題 × 16 科別的對應靠 clinical catalog 機械同步保證,信心較高;其餘靠 17 個 e2e 場景涵蓋主要流程。在此基礎上執行切換。

## 決策

- 根目錄 `index.html` 改由 v2 build 產出。`npm run build` = `npm run build:v2`(Vite 產出 `dist-v2/index.html`)再 `npm run promote:v2`(把 `dist-v2/index.html` 提升為根目錄 `index.html`)。
- Legacy 建置改名為 `npm run build:legacy`,輸出到不提交的 `dist-legacy/index.html`——不再是正式成品,而是 Phase 2 觀察期的回退預覽與測試對象。
- `npm start`(port 4173)現在預覽的是正式 v2 成品;新增 `npm run preview:legacy`(供 `dist-legacy/index.html`,e2e 中對應 port 4175)保留 legacy 的可預覽性。
- `check:generated` 改為比對根目錄 `index.html` 與新鮮建置的 `dist-v2/index.html`,取代原本與 legacy render 的比對。
- `check:legacy`(hash baseline)不需改動,因為它本來就直接檢查 `src/legacy/app.js` 原始碼,從未依賴根目錄 `index.html`。
- `tests/app.smoke.test.mjs` 更名為 `tests/legacy.smoke.test.mjs`,改讀 `dist-legacy/index.html`,持續驗證 legacy 離線流程仍可運作(回退保險)。
- `e2e/legacy-parity.spec.ts` 全部改打專屬的 `http://127.0.0.1:4175/`(legacy 預覽伺服器),不再依賴預設 `baseURL`。
- 新增 `e2e/v2-production.spec.ts`,直接驗證真正的正式入口(port 4173、也就是根目錄 `index.html`)——這條路徑先前由 legacy-parity 涵蓋,搬遷後若不新增會出現「正式入口本身沒有任何 e2e 直接驗證」的空缺。

Legacy 原始碼(`src/legacy/app.js`、`src/styles/app.css`、`src/index.template.html`)、baseline 保護、legacy 專屬測試全部保留、繼續在 CI 跑,做為 Phase 2 觀察期的回退依據,不受本次變更影響。

## 結果

正式入口從 legacy 換成 v2。ADR 0004 的 Phase 2(觀察期)自本次變更起算——建議至少 2–4 週只拿 legacy 當回退保險、不再開發,期間持續觀察 v2 是否需要回退。Phase 3(刪除 legacy 原始碼、baseline 保護、legacy 專屬測試,並將 ADR 0002 標記為 Superseded)需等觀察期滿並經人工確認後才執行,不在本次變更範圍內。
