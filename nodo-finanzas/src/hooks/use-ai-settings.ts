import { useState, useEffect, useContext, createContext, useCallback } from "react";
import {
  type AiProvider,
  type AiSettings,
  DEFAULT_AI_SETTINGS,
  getActiveApiKey,
} from "@nodocore/nodo-modules/settings";
import { FinanzasService } from "@/services/finanzas-service";

export type { AiProvider, AiSettings };
export { getActiveApiKey };

const AI_SETTINGS_KEY = "ai_settings";

// ── Shared context so all consumers react to the same state ──────────────────

interface AiSettingsContextValue {
  aiSettings: AiSettings;
  setAiSettings: (next: Partial<AiSettings>) => Promise<void>;
  loading: boolean;
}

export const AiSettingsContext = createContext<AiSettingsContextValue>({
  aiSettings: DEFAULT_AI_SETTINGS,
  setAiSettings: async () => {},
  loading: true,
});

export function useAiSettingsProvider(userId: string | undefined) {
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

  const setAiSettings = useCallback(async (next: Partial<AiSettings>) => {
    const merged = { ...aiSettings, ...next };
    setAiSettingsState(merged);
    try {
      await FinanzasService.guardarConfiguracion(AI_SETTINGS_KEY, merged);
    } catch {
      // Best-effort
    }
  }, [aiSettings]);

  return { aiSettings, setAiSettings, loading };
}

export function useAiSettings() {
  return useContext(AiSettingsContext);
}
