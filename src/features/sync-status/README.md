# Google sync status

## Intent

呈現可注入之同步 repository 狀態，讓使用者知道目前資料來自裝置快取、正在同步、仍待上傳、離線或已發生可恢復錯誤，並提供明確的手動重試入口。

## Non-goals

- 不持有 OAuth token、不直接呼叫 Google API，也不讀寫 localStorage。
- 不自行合併病人資料或決定衝突版本。
- 本階段不負責 Google Identity Services 登入畫面。

## Data changes

無病人 schema 變更。同步快取與 base snapshot 由 application port 及 infrastructure adapter 管理。

## Integration points

`App` 訂閱 `SyncCapablePatientRepository`，將唯讀 `PatientSyncState` 傳入本元件；點擊同步只回傳意圖給 App。
