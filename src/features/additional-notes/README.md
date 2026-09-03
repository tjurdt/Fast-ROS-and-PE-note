# Additional notes

## Intent

提供整份病人筆記的自由文字備註，對應 legacy `globalNote`。

## Non-goals

- 不解析或自動改寫臨床文字。
- 不負責匯出格式與 repository 儲存。

## Data and integration

接收 `globalNote` 字串並以受控欄位回傳更新；App 將變更送入 typed workspace workflow。
