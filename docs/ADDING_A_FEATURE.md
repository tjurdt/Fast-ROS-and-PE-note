# 新增或遷移 v2 功能指南

## 1. 先建立 parity 契約

若功能在 legacy 已存在，先用 Playwright 或純函式 contract 固定使用者可見行為。測試應描述語意結果，不依賴不穩定的 DOM 排列或目前實作細節。

新功能則先在 `src/features/<feature-name>/README.md` 寫清楚：

- 使用者工作與驗收條件。
- 明確非目標。
- domain/schema 變更與缺省行為。
- application port、失敗模式與離線行為。
- 隱私、同步與匯出影響。

## 2. 依依賴方向實作

1. 在 `src/domain/` 加入純型別、schema 與規則。
2. 在 `src/application/` 加入 use case 或 port。
3. 必要時在 `src/infrastructure/` 實作 adapter。
4. 最後在自己的 feature slice 接上 React UI。

Domain 不得 import React、DOM、localStorage、fetch 或 Google API。Feature 不直接讀 storage key，也不跨目錄操作另一個 feature 的內部 state。

## 3. 保持單檔輸出

v2 使用標準 ES module import，不加入 `config/assets.mjs`。Vite 會把 module graph 與 CSS 內嵌至 `dist-v2/index.html`。不得加入未內嵌的本機圖片、字型、stylesheet 或 script。

只有修正正式 legacy 行為時才使用 classic-script manifest 與 baseline 例外流程。

## 4. 以風險決定測試

- domain、格式化、合併、validation：Vitest 單元測試。
- React 互動與 orchestration：Testing Library。
- localStorage：空資料、round-trip、壞資料不覆寫、quota/error。
- Google 同步：mock API 的成功、離線、401、衝突及同步途中再編輯。
- parity 與手機操作：Playwright Chromium。
- 匯出：固定輸入的精確文字或結構契約。

測試只使用虛構代碼，不含姓名、病歷號、token 或真實臨床匯出。

## 5. 完成條件

```bash
npm run build
npm run build:v2
npm run verify
```

確認 legacy `index.html` 沒有非預期變動、v2 單檔檢查通過、feature README 已更新，而且對應 parity gate 有可自動執行的證據。
