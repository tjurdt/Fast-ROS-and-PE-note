# Core boundaries

此目錄只放穩定、可測試的跨功能契約，例如資料存取介面、事件介面或 legacy bridge。Core 不放畫面功能，也不建立萬用 `utils.js`。

依賴方向固定為：feature 可以依賴 core；core 不依賴 feature。任何 core API 都要有契約測試，且改動時要考慮已持久化資料的向後相容性。
