# Patient note shell

## Intent

提供 v2 病人基本資料的可編輯筆記外殼，證明 typed domain → application workflow → repository → React UI 的完整資料流。

## Non-goals

- ROS/PE、組套、待辦與匯出尚未遷入；未達 parity 前不取代正式入口。
- 元件不直接呼叫 repository。

## Data and integration

接收單一 `Patient`，每次欄位變更回傳 typed patch。App 層負責序列化儲存順序與錯誤呈現。
