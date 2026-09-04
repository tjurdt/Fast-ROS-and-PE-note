# Patient list

## Intent

列出已驗證的病人紀錄，支援建立、開啟、即時搜尋、可預測排序與安全刪除。預設維持 legacy 的「最近更新優先」。

## Non-goals

- 元件不直接存取 storage。
- 不保存搜尋字串或排序偏好，也不修改病人 schema。
- 不提供批次刪除；單筆永久刪除必須在原列再次明確確認。

## Data and integration

接收已驗證的 `Patient[]`。搜尋與排序使用 domain 純函式，不改動來源陣列；建立表單回傳 `PatientDraft`，刪除只回傳 patient ID。所有資料變更由 application workflow 建立新 database，再由 App 透過目前選定的本機或 Google repository 持久化。
