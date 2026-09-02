# 新增功能指南

## 1. 先定義契約

建立 `src/features/<feature-name>/README.md`，至少寫清楚：

- 使用者要完成的工作與驗收條件。
- 明確非目標，避免順手重構無關區域。
- 新增或讀取哪些資料欄位，以及舊資料的預設行為。
- 需要的 core/legacy 整合點與失敗模式。
- 隱私、離線、同步與匯出是否受影響。

## 2. 做成垂直切片

功能程式放在自己的目錄，不依頁面類型拆成全域 `components/`、`services/`、`helpers/`。瀏覽器 entry 以 IIFE 包住，避免 classic script 串接後污染全域：

```js
(() => {
  "use strict";

  // Feature-owned state and event wiring live here.
})();
```

若兩個以上功能真的共享同一契約，再把那一小段提升到 `src/core/`。

## 3. 明確接入成品

把需要執行的 CSS/JS 依順序加入 `config/assets.mjs`。不要在 HTML 樣板加入外部本機檔案；成品必須維持單檔離線。遠端 API 僅能是功能本身已明確處理離線與錯誤狀態的執行期依賴。

## 4. 以風險決定測試

- 純計算、格式化、migration：Node 單元測試。
- DOM 互動：從使用者可見入口到結果的 jsdom 測試。
- localStorage：舊資料 fixture、升級、重新載入與未知欄位保留。
- Google 同步：mock API 的成功、離線、401、衝突與同步途中再編輯。
- 匯出：固定輸入與文字/列印模型的契約快照或精確 assertion。

測試資料只使用虛構代碼，不含真實姓名、病歷號、token 或臨床匯出。

## 5. 完成條件

```bash
npm run build
npm run verify
```

確認來源與生成後 `index.html` 都在變更中，功能 README 已更新，而且既有資料不需清除即可繼續使用。
