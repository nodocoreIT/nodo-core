"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  getActiveApiKey,
  useSettingsModule,
} from "@nodocore/nodo-modules/settings";
import { generateTaskTitleFromDescription } from "@/lib/panel/generate-task-title";
import { formatTaskDescription } from "@/lib/panel/task-code";

type GenerateTitleFromDescriptionProps = {
  description: string;
  unitCode: string;
  onTitle: (title: string) => void;
  /** Also push normalized description back (sentence-case if ALL CAPS). */
  onDescriptionNormalized?: (description: string) => void;
};

export function GenerateTitleFromDescriptionButton({
  description,
  unitCode,
  onTitle,
  onDescriptionNormalized,
}: GenerateTitleFromDescriptionProps) {
  const { aiSettings } = useSettingsModule();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getActiveApiKey(aiSettings);
  const canGenerate = description.trim().length >= 8;

  async function handleClick() {
    if (!canGenerate || loading) return;
    setLoading(true);
    setError(null);
    try {
      const normalized = formatTaskDescription(description);
      if (normalized && onDescriptionNormalized) {
        onDescriptionNormalized(normalized);
      }
      const title = await generateTaskTitleFromDescription({
        description: normalized ?? description,
        unitCode,
        provider: aiSettings.provider ?? "gemini",
        apiKey,
      });
      onTitle(title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el título.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={!canGenerate || loading}
        title={
          !canGenerate
            ? "Escribí una descripción un poco más larga"
            : !apiKey
              ? "Configurá la API key de IA en Configuración"
              : "Generar título a partir de la descripción"
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid var(--color-mist)",
          borderRadius: 6,
          background: canGenerate && !loading ? "white" : "var(--color-mist-200, #eef3f8)",
          color: canGenerate ? "var(--color-brand)" : "var(--color-slate2)",
          fontSize: 12,
          fontWeight: 700,
          padding: "5px 10px",
          cursor: !canGenerate || loading ? "not-allowed" : "pointer",
          fontFamily: "var(--font-sans)",
          opacity: !canGenerate || loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} strokeWidth={2.2} />
        )}
        {loading ? "Generando…" : "Generar título con IA"}
      </button>
      {error ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11.5,
            color: "#b91c1c",
            fontFamily: "var(--font-sans)",
            lineHeight: 1.35,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
