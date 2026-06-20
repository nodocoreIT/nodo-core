"use client";

import { useEffect, type ReactNode } from "react";
import type { StoreTheme } from "@/lib/get-store-config";

export function StoreThemeProvider({
  theme,
  children,
}: {
  theme: StoreTheme;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--store-primary", theme.primaryColor);
    root.style.setProperty("--store-secondary", theme.secondaryColor);
    root.style.setProperty(
      "--store-font",
      `"${theme.fontFamily}", system-ui, sans-serif`,
    );

    const radius =
      theme.borderRadius === "none"
        ? "0px"
        : theme.borderRadius === "full"
          ? "9999px"
          : "12px";
    root.style.setProperty("--store-radius", radius);

    // Load Google Font dynamically
    const fontId = `store-font-${theme.fontFamily}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        theme.fontFamily,
      )}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [theme]);

  return (
    <div
      style={{
        fontFamily: `var(--store-font, "${theme.fontFamily}", system-ui)`,
      }}
    >
      {children}
    </div>
  );
}
