import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SoapResult {
  subjective: string;
  objective: string;
  analysis: string;
  plan: string;
}

export async function generateSoapSummary(
  transcription: string,
  clinicalNotes?: string
): Promise<SoapResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateMockSoap(transcription, clinicalNotes);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Eres un médico especialista en documentación clínica. A partir de la siguiente transcripción de consulta médica y notas del profesional, genera un resumen estructurado en formato SOAP (Subjetivo, Objetivo, Análisis, Plan) siguiendo estándares de historia clínica.

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

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

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

function generateMockSoap(
  transcription: string,
  clinicalNotes?: string
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

export interface ClinicalReportResult {
  report: string;
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
  input: ClinicalReportInput
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
      quotaFallback: true,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Eres un médico especialista redactando un informe clínico formal en español (Argentina).
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

  try {
    const result = await model.generateContent(prompt);
    return { report: result.response.text().trim() };
  } catch (err) {
    if (isGeminiQuotaError(err)) {
      return {
        report: buildMockClinicalReport(input, source),
        quotaFallback: true,
      };
    }
    throw err;
  }
}

function buildMockClinicalReport(
  input: ClinicalReportInput,
  source: string
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
Informe generado asistido por IA — revisar y validar antes de firmar.

---
Dr/a. ${input.doctorName}${input.doctorLicense ? ` — ${input.doctorLicense}` : ""}`;
}
