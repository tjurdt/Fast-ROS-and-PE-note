# ADR 0003：Google Drive 採 local-first 三方同步

- 狀態：Accepted
- 日期：2026-09-04

## 背景

臨床紀錄必須在網路中斷、授權過期或遠端競爭更新時仍可持續輸入。直接把 Drive 當一般 CRUD repository，會讓較晚回來的網路回應覆蓋同步期間的新輸入，也無法區分真正刪除與新裝置尚未下載的資料。

## 決策

- Google 模式先讀取依帳號隔離的裝置快取；所有編輯先驗證並寫入快取，再標記為 dirty。
- access token 只透過 `GoogleAccessTokenProvider` 在請求當下取得，不進入病人資料、同步快取或雲端 envelope。
- OAuth 採 Google Identity Services browser token model，僅在使用者動作時呼叫授權；token 只保留在記憶體與 `sessionStorage`，過期後不做背景 popup 或持久 refresh。
- Drive `about.user.permissionId` 作為帳號隔離用 opaque key；`localStorage` 只記錄最小帳號標籤與該 key，不保存 token。
- 重新登入可安全切換帳號；離線開啟不要求 token、不呼叫網路。離開 Google 模式預設保留快取，清除需二次確認。
- 成功同步後保存每位病人的穩定 hash 與全域設定 hash，作為下一次三方合併的共同 base。
- 不同病人或單邊變更自動合併；雙邊修改同一病人時保留目前裝置版本。
- 若沒有可信的共同 base，只做加法合併，不把缺少的項目解讀成刪除。
- 真正衝突必須先在 Drive `appDataFolder` 建立遠端備份；備份失敗時停止覆寫並保留 dirty 快取。
- Drive 更新帶上已讀取的 ETag；HTTP 409／412 視為可重試的版本競爭，不清除本機變更。
- 同步期間若 `localRevision` 增加，將最新本機資料 rebase 到同步結果並維持 dirty，避免舊回應覆蓋輸入。
- 401、離線、壞資料及一般遠端錯誤使用明確狀態；任何失敗都不得刪除或覆寫裝置快取。

## 結果

同步演算法、雲端連線器、Google API 與 React UI 分離，可用記憶體 fake 完整測試。App 只依賴 `CloudRepositoryConnector` 與 `SyncCapablePatientRepository`，更換遠端供應者不需修改病人 domain 與 feature。代價是同步會保留額外 base snapshot，且衝突後可能需要第二輪同步；這是保護輸入與可恢復性的刻意選擇。
