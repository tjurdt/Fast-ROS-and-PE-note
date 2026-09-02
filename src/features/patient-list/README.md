# Patient list

## Intent

列出本機病人草稿並建立新的病人紀錄，作為 v2 第一個可操作垂直切片。

## Non-goals

- 此階段不包含刪除、搜尋、排序設定與 Google 同步。
- 元件不直接存取 storage。

## Data and integration

接收已驗證的 `Patient[]`，建立表單只回傳 `PatientDraft`。建立與持久化由 application/app 層處理。
