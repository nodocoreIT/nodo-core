"use client";

import { useEffect } from "react";

const GLOBAL_SEARCH_SELECTOR = "[data-global-search-input]";

/** Focus the page search field on Ctrl/Cmd + K. */
export function useGlobalSearchHotkey(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handleKeyDown(event: KeyboardEvent) {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") return;

      const target = document.querySelector<HTMLInputElement>(
        GLOBAL_SEARCH_SELECTOR,
      );
      if (!target) return;

      event.preventDefault();
      target.focus();
      target.select();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
