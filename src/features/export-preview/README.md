# Clinical export preview

## Intent

提供 v2 臨床摘要的限縮版／完整版預覽、全文複製、TXT 下載，以及瀏覽器列印或另存 PDF。顯示層只消費 `domain/clinical-summary` 建立的中間模型。

## Non-goals

- 不產生正式病歷、不取代醫師核對，也不直接寫入病人資料。
- 不依賴 legacy 全域狀態、DOM 或匯出函式。
- 不在這個 feature 內定義臨床判讀、異常規則或資料轉換。

## Data changes

無。匯出流程是唯讀快照，不新增或修改持久化欄位。

## Integration points

`App` 傳入目前的 `Patient` 與自訂組套範本；純 domain builder 組成摘要後，本 feature 負責瀏覽器的 clipboard、Blob download 與 print side effects。
