# Patient note shell

## Intent

提供 v2 病人基本資料的可編輯筆記外殼，證明 typed domain → application workflow → repository → React UI 的完整資料流。

## Non-goals

- 本元件只處理病人基本資料與版面容器；ROS/PE 由 App 組合 `clinical-note` feature。
- 匯出、同步狀態與 Google 帳號生命週期由 App 組合獨立 feature；未達完整 parity 前不取代正式入口。
- 元件不直接呼叫 repository，也不直接 import 其他 feature。

## Data and integration

接收單一 `Patient`，每次欄位變更回傳 typed patch。App 層負責序列化儲存順序與錯誤呈現。
