# Clinical note

## Intent

以 typed legacy catalog 呈現 ROS/PE 區塊，支援 Focus 搬移、婦產科 gate、陽性計數，以及 toggle、select、text、group、follow-up 與 item note 的共用互動。

## Non-goals

- DTR、plantar、sensory 與 cranial nerve detail 等 custom widgets 尚未達 parity，目前只標示待遷移。
- 此階段不處理 block notes、Admission、PMH、組套、匯出與列印。

## Data and integration

Catalog 由 frozen legacy 自動生成並以 Zod 驗證。元件只回傳 typed `FindingValue`；持久化由 App/application/repository 流程負責。
