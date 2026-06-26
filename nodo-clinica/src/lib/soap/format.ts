import type { SoapSummary } from "@/types";

/** Convierte un resumen SOAP a markdown editable en notas clínicas. */
export function formatSoapAsMarkdown(summary: Pick<
  SoapSummary,
  "subjective" | "objective" | "analysis" | "plan"
>): string {
  return `## Resumen SOAP (IA)

### Subjetivo (S)
${summary.subjective.trim()}

### Objetivo (O)
${summary.objective.trim()}

### Análisis (A)
${summary.analysis.trim()}

### Plan (P)
${summary.plan.trim()}`;
}

export function normalizeSoapResponse(data: Record<string, unknown>): Pick<
  SoapSummary,
  "subjective" | "objective" | "analysis" | "plan"
> {
  return {
    subjective: String(data.subjective ?? ""),
    objective: String(data.objective ?? ""),
    analysis: String(data.analysis ?? ""),
    plan: String(data.plan ?? ""),
  };
}

export function toSoapSummary(
  appointmentId: string,
  data: Record<string, unknown>
): SoapSummary {
  const sections = normalizeSoapResponse(data);
  return {
    id: String(data.id ?? appointmentId),
    appointment_id: appointmentId,
    ...sections,
    created_at: String(data.created_at ?? new Date().toISOString()),
  };
}
