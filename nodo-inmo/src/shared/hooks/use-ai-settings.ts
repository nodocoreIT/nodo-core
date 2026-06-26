import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────

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

const STORAGE_KEY = "nodo-ai-settings";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getActiveApiKey(settings: AiSettings): string {
  if (settings.provider === "openai") return settings.openaiApiKey;
  if (settings.provider === "anthropic") return settings.anthropicApiKey;
  return settings.geminiApiKey;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AiStore {
  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => void;
}

const getInitialAiSettings = (): AiSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiSettings> & { geminiApiKey?: string };
      // Migrate old format (only had geminiApiKey)
      if (!parsed.provider) parsed.provider = "gemini";
      if (!parsed.openaiApiKey) parsed.openaiApiKey = "";
      if (!parsed.anthropicApiKey) parsed.anthropicApiKey = "";
      return { ...DEFAULT_AI_SETTINGS, ...parsed } as AiSettings;
    }
  } catch {
    // Ignored
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
        // Ignored
      }
      return { aiSettings: updated };
    }),
}));

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAiSettings() {
  const { aiSettings, setAiSettings } = useAiStore();
  return { aiSettings, setAiSettings };
}
