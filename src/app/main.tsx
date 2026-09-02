import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./app.css";

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #root element for PE Note v2.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
