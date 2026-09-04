# Google sync status

## Intent

呈現可注入之同步 repository 狀態，讓使用者知道目前帳號、資料來源與同步狀態，並提供手動同步、重新連線、離開 Google 模式及清除帳號快取入口。

## Non-goals

- 不持有 OAuth token、不直接呼叫 Google API，也不讀寫 localStorage。
- 不自行合併病人資料或決定衝突版本。
- 清除快取必須經第二次明確確認；元件只回傳意圖，實際清除由 connector 執行。

## Data changes

無病人 schema 變更。同步快取與 base snapshot 由 application port 及 infrastructure adapter 管理。

## Integration points

`App` 訂閱 `SyncCapablePatientRepository`，將唯讀 `PatientSyncState` 與最小化帳號標籤傳入本元件；所有動作只回傳意圖給 App。
