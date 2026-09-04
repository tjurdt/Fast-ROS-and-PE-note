# Storage choice

## Intent

提供 v2 啟動畫面與儲存模式入口。本機模式永遠可用；App 注入完成授權的同步 repository 後才啟用 Google 選項。

## Non-goals

- 不在此元件讀寫 localStorage 或 Google token。
- 不實作同步、快取或帳號授權。

## Data and integration

元件只發出本機或 Google 選擇意圖；repository 載入、cache-first 啟動與錯誤處理由 app orchestration 負責。
