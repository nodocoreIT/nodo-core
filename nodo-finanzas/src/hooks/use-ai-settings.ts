import { create } from "zustand";

export interface AiSettings {
  geminiApiKey: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  geminiApiKey: "",
};

const STORAGE_KEY = "nodo-ai-settings";

interface AiStore {
  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => void;
}

const getInitialAiSettings = (): AiSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // ignored
  }
  return DEFAULT_AI_SETTINGS;
};

export const useAiStore = create<AiStore>((set) => ({
  aiSettings: getInitialAiSettings(),
  setAiSettings: (next) =>
    set((state) => {
      const updated = { ...state.aiSettings, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignored
      }
      return { aiSettings: updated };
    }),
}));

export function useAiSettings() {
  const { aiSettings, setAiSettings } = useAiStore();
  return { aiSettings, setAiSettings };
}
