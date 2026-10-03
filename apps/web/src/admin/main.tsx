import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@shared/styles/index.css";
import { App } from "./App";
import { PANEL_MARKER } from "./marker";

document.documentElement.dataset.app = PANEL_MARKER;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
