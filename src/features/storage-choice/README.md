# Storage choice

## Intent

提供 v2 啟動畫面與儲存模式入口。第一階段只啟用本機模式，Google Drive 必須等 adapter parity 測試完成後才開放。

## Non-goals

- 不在此元件讀寫 localStorage 或 Google token。
- 不實作同步與帳號授權。

## Data and integration

元件只發出 `onChooseLocal` 意圖；repository 載入與錯誤處理由 app orchestration 負責。
