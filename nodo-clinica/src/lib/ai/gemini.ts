import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
] as const;

export interface SoapResult {
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
}

export async function generateSoapSummary(
  transcription: string,
  clinicalNotes?: string,
): Promise<SoapResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateMockSoap(transcription, clinicalNotes);
  }

  const prompt = buildSoapPrompt(transcription, clinicalNotes);

  try {
    const text = await generateWithGeminiModels(apiKey, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No se pudo parsear la respuesta de Gemini");
    }
    return JSON.parse(jsonMatch[0]) as SoapResult;
  } catch (err) {
    if (isGeminiQuotaError(err)) {
      return generateMockSoap(transcription, clinicalNotes);
    }
    throw err;
  }
}

function buildSoapPrompt(transcription: string, clinicalNotes?: string) {
  return `Eres un médico especialista en documentación clínica. A partir de la siguiente transcripción de consulta médica y notas del profesional, genera un resumen estructurado en formato SOAP (Subjetivo, Objetivo, Análisis, Plan) siguiendo estándares de historia clínica.

TRANSCRIPCIÓN:
${transcription}

NOTAS CLÍNICAS DEL MÉDICO:
${clinicalNotes || "No hay notas adicionales."}

Responde ÚNICAMENTE en formato JSON válido con esta estructura exacta:
{
  "subjective": "Síntomas, motivo de consulta y antecedentes reportados por el paciente",
  "objective": "Hallazgos objetivos observados durante la consulta",
  "analysis": "Diagnóstico diferencial y evaluación clínica",
  "plan": "Plan de tratamiento, medicación, estudios y seguimiento"
}

Usa terminología médica profesional en español. Sé conciso pero completo.`;
}

function generateMockSoap(
  transcription: string,
  clinicalNotes?: string,
): SoapResult {
  return {
    subjective:
      transcription.slice(0, 300) ||
      "Paciente refiere motivo de consulta según transcripción registrada.",
    objective:
      "Evaluación por telemedicina. Signos vitales no registrados en consulta virtual.",
    analysis:
      clinicalNotes?.slice(0, 200) ||
      "Evaluación clínica basada en entrevista y exploración virtual.",
    plan: "Continuar seguimiento. Ajustar tratamiento según evolución. Control en 15 días.",
  };
}

function isGeminiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg);
}

async function generateWithGeminiModels(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (!isGeminiQuotaError(err)) throw err;
    }
  }

  throw lastError ?? new Error("Cuota de Gemini agotada");
}

export type ClinicalReportDraftReason = "no_api_key" | "quota_exceeded";

export interface ClinicalReportResult {
  report: string;
  /** Informe armado sin llamar a Gemini (siempre gratis) */
  localDraft?: boolean;
  localDraftReason?: ClinicalReportDraftReason;
  /** @deprecated usar localDraft */
  quotaFallback?: boolean;
}

export interface ClinicalReportInput {
  dictation: string;
  transcription?: string;
  clinicalNotes?: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
}

export async function generateClinicalReport(
  input: ClinicalReportInput,
): Promise<ClinicalReportResult> {
  const source = [
    input.dictation,
    input.transcription,
    input.clinicalNotes,
  ]
    .filter(Boolean)
    .join("\n\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      report: buildMockClinicalReport(input, source),
      localDraft: true,
      localDraftReason: "no_api_key",
      quotaFallback: true,
    };
  }

  const prompt = buildClinicalReportPrompt(input, source);

  try {
    const report = (await generateWithGeminiModels(apiKey, prompt)).trim();
    return { report };
  } catch (err) {
    if (isGeminiQuotaError(err)) {
      return {
        report: buildMockClinicalReport(input, source),
        localDraft: true,
        localDraftReason: "quota_exceeded",
        quotaFallback: true,
      };
    }
    throw err;
  }
}

function buildClinicalReportPrompt(
  input: ClinicalReportInput,
  source: string,
) {
  return `Eres un médico especialista redactando un informe clínico formal en español (Argentina).
A partir del dictado del profesional, la transcripción de la consulta y las notas clínicas, redactá un informe médico completo, claro y profesional.

PACIENTE: ${input.patientName}
MÉDICO: ${input.doctorName}${input.doctorSpecialty ? ` — ${input.doctorSpecialty}` : ""}${input.doctorLicense ? ` (${input.doctorLicense})` : ""}

CONTENIDO CLÍNICO (dictado, transcripción y notas):
${source || "Sin contenido adicional."}

Redactá el informe con estas secciones en markdown (usá ## para títulos):
## Motivo de consulta
## Antecedentes relevantes
## Evolución y hallazgos
## Diagnóstico / Impresión clínica
## Plan terapéutico y recomendaciones
## Observaciones

Usá terminología médica apropiada. Sé conciso pero completo. No inventes datos que no estén en el contenido clínico.
Respondé ÚNICAMENTE con el texto del informe en markdown, sin explicaciones adicionales.`;
}

function buildMockClinicalReport(
  input: ClinicalReportInput,
  source: string,
): string {
  const excerpt = source.slice(0, 400) || "Consulta por telemedicina.";
  return `## Motivo de consulta
${excerpt.split("\n")[0] || "Evaluación clínica solicitada por el paciente."}

## Antecedentes relevantes
Según relato del paciente y antecedentes consignados en la consulta.

## Evolución y hallazgos
${excerpt}

## Diagnóstico / Impresión clínica
Evaluación clínica basada en entrevista y exploración virtual. Correlacionar con estudios complementarios si corresponde.

## Plan terapéutico y recomendaciones
- Continuar tratamiento indicado según evolución.
- Estudios complementarios si fueron solicitados.
- Control médico en 15–30 días o antes si empeora.

## Observaciones
Consulta realizada por telemedicina.
Borrador asistido — revisar y validar antes de firmar.

---
Dr/a. ${input.doctorName}${input.doctorLicense ? ` — ${input.doctorLicense}` : ""}`;
}
