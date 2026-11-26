import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startRum } from "../../shared/rum";
import "../../shared/styles.css";
import { App } from "./App";

startRum({
  service: "northcrest-status-web",
  edgeUrl: import.meta.env.VITE_OTEL_EDGE_URL,
  sampleRatio: Number(import.meta.env.VITE_OTEL_SAMPLE_RATIO ?? 1),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
