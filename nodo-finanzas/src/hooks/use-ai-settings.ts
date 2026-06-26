import { create } from "zustand";

export type AiProvider = "gemini" | "openai" | "anthropic";

export interface AiSettings {
  provider: AiProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
};

export function getActiveApiKey(settings: AiSettings): string {
  if (settings.provider === "openai") return settings.openaiApiKey;
  if (settings.provider === "anthropic") return settings.anthropicApiKey;
  return settings.geminiApiKey;
}

const STORAGE_KEY = "nodo-ai-settings";

interface AiStore {
  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => void;
}

const getInitialAiSettings = (): AiSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!parsed.provider) parsed.provider = "gemini";
      if (!parsed.openaiApiKey) parsed.openaiApiKey = "";
      if (!parsed.anthropicApiKey) parsed.anthropicApiKey = "";
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
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
