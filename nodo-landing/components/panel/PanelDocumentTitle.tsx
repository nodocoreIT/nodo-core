"use client";

import { useEffect } from "react";

const PANEL_TITLE = "Nodo | Dashboard";

export function PanelDocumentTitle() {
  useEffect(() => {
    document.title = PANEL_TITLE;
  }, []);

  return null;
}
