# Clinical note

## Intent

以 typed legacy catalog 呈現 ROS/PE 區塊，支援 Focus 搬移、婦產科 gate、陽性計數，以及 toggle、select、text、group、follow-up、item note、DTR、plantar、sensory 與 cranial nerve detail 的互動。

## Non-goals

- 此 feature 不處理 Admission、PMH、組套、匯出與列印；區塊備註屬於 clinical section，因此由此 feature 呈現。
- 不決定 ROS/PE 在病人筆記頁面的頂層導覽位置；`ClinicalKindWorkspace` 只負責「單一 kind（ROS 或 PE）自己的區塊 tab 列 + 當前展開的面板」，由 `App.tsx` 分別為 ROS、PE 各建立一個實例並安排到對應的頂層分頁。

## Data and integration

Catalog 由 frozen legacy 自動生成並以 Zod 驗證。特殊 widget 的選項與巢狀 finding schema 位於 domain；feature 元件只回傳 immutable typed `FindingValue`，持久化由 App/application/repository 流程負責。ROS 與 PE 各自維護自己的「目前展開哪個區塊」狀態，彼此獨立。
