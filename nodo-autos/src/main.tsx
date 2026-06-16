import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function Root() {
  useEffect(() => {
    const splash = document.getElementById("nodo-splash");
    if (!splash) return;
    splash.style.opacity = "0";
    const t = setTimeout(() => splash.remove(), 300);
    return () => clearTimeout(t);
  }, []);

  return <App />;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
