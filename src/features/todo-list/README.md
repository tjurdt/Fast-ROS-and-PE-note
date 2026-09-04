# Todo list

## Intent

提供重要、待辦、完成與刪除狀態，排序規則和 legacy 一致：重要未完成 → 一般未完成 → 已完成，同層依建立時間排序。

## Non-goals

- 不提供通知、到期日或外部任務服務同步。
- 不直接讀寫 storage。

## Data and integration

使用 domain `Todo` 與純排序規則；新增項目的 ID/時間由 App 注入，陣列更新經 workspace workflow 持久化。
