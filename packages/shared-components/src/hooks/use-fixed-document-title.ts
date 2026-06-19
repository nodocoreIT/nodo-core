import { useEffect } from "react";

/** Keeps the browser tab title fixed for the whole nodo app (does not change per route). */
export function useFixedDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
