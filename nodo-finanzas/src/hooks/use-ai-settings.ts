import { useState, useEffect } from "react";
import { FinanzasService } from "@/services/finanzas-service";
import { useAuth } from "@nodocore/shared-components";

export type AiProvider = "gemini" | "openai" | "anthropic" | "groq";

export interface AiSettings {
  provider: AiProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  groqApiKey: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  groqApiKey: "",
};

export function getActiveApiKey(settings: AiSettings): string {
  if (settings.provider === "openai") return settings.openaiApiKey;
  if (settings.provider === "anthropic") return settings.anthropicApiKey;
  if (settings.provider === "groq") return settings.groqApiKey;
  return settings.geminiApiKey;
}

const AI_SETTINGS_KEY = "ai_settings";

export function useAiSettings() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [aiSettings, setAiSettingsState] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stored = await FinanzasService.obtenerConfiguracion(AI_SETTINGS_KEY) as any;
        if (!cancelled && stored && typeof stored === "object") {
          setAiSettingsState({ ...DEFAULT_AI_SETTINGS, ...stored });
        }
      } catch {
        // Fallback to defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const setAiSettings = async (next: Partial<AiSettings>) => {
    const merged = { ...aiSettings, ...next };
    setAiSettingsState(merged);
    try {
      await FinanzasService.guardarConfiguracion(AI_SETTINGS_KEY, merged);
    } catch {
      // Best-effort
    }
  };

  return { aiSettings, setAiSettings, loading };
}
