# Storage choice

## Intent

提供 v2 啟動畫面與儲存模式入口。本機模式永遠可用；Google connector 可用時提供互動式登入，已有帳號快取時另提供完全不碰網路的離線入口。

## Non-goals

- 不在此元件讀寫 localStorage 或 Google token。
- 不實作同步、快取或帳號授權，只呈現 App 傳入的能力與帳號標籤。

## Data and integration

元件只發出本機、Google 登入或離線快取選擇意圖；repository 載入、cache-first 啟動與錯誤處理由 app orchestration 負責。帳號標籤不參與病人資料 schema。
