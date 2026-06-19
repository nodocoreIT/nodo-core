import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { consumeSkipSplashFlag } from "@/shared/lib/app-splash";
import "./index.css";
import App from "./App.tsx";

consumeSkipSplashFlag();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
