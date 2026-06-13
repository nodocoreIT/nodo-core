import { create } from "zustand";

/**
 * Global search query shared between the top-bar SearchInput and list views.
 *
 * A single module-scoped store (not a provider) keeps the layout and feature
 * lists decoupled: each list reads `query` and filters its own data.
 * Reset `query` on route change so areas don't inherit each other's search.
 */
interface SearchState {
  query: string;
  setQuery: (query: string) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  reset: () => set({ query: "" }),
}));
