import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase/server";

const CITY = "Santa Rosa";

const MESES_ES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

// Mismo modelo (y misma lógica de default) que ya dejamos funcionando en
// src/lib/ai/gemini.ts esta sesión — a propósito NO reusamos la lista
// GEMINI_MODELS de payment-receipt.ts (gemini-2.0-flash / 2.0-flash-lite),
// esos modelos ya dejaron de estar disponibles para cuentas nuevas.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export interface PharmacyEntry {
  name: string;
  address: string;
  phones: string[];
  lat?: number;
  lon?: number;
}

export interface PharmacySchedule {
  city: string;
  year: number;
  month: number;
  dayLetters: Record<string, string>;
  letterPharmacies: Record<string, PharmacyEntry[]>;
  sourcePdfUrl: string;
  fetchedAt: string;
}

function buildPdfUrl(year: number, month: number): string {
  const mesNombre = MESES_ES[month - 1];
  const mm = String(month).padStart(2, "0");
  return `https://colfarlp.org.ar/wp-content/uploads/${year}/${mm}/${mm}-Farmacias-de-Turno-Santa-Rosa-${mesNombre}-${year}.pdf`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Probamos primero con Nominatim (gratis, sin key) y nos empezó a devolver
// 429 Too Many Requests casi de entrada — las IPs compartidas de Vercel ya
// vienen saturadas en su servidor público. LocationIQ usa la misma base de
// datos (OpenStreetMap) pero con API key propia: 5.000 requests/día, 2/seg,
// sin tarjeta de crédito. Requiere LOCATIONIQ_API_KEY en las env vars.
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) {
    console.error(
      "[pharmacy-on-call] LOCATIONIQ_API_KEY no configurada — se guarda el turnero sin distancias.",
    );
    return null;
  }
  const query = encodeURIComponent(`${address}, Santa Rosa, La Pampa, Argentina`);
  try {
    const res = await fetch(
      `https://us1.locationiq.com/v1/search?key=${apiKey}&format=json&limit=1&q=${query}`,
    );
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!results[0]) return null;
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
  } catch (err) {
    console.error(`[pharmacy-on-call] geocode failed for "${address}":`, err);
    return null;
  }
}

/** Le agrega lat/lon a cada farmacia para poder calcular "la más cercana" en
 * el cliente. Si el geocoding no encuentra una dirección, la deja sin
 * coordenadas — esa farmacia simplemente no entra en el cálculo de distancia. */
async function geocodePharmacies(
  letterPharmacies: Record<string, PharmacyEntry[]>,
): Promise<Record<string, PharmacyEntry[]>> {
  const result: Record<string, PharmacyEntry[]> = {};
  for (const [letter, pharmacies] of Object.entries(letterPharmacies)) {
    const withCoords: PharmacyEntry[] = [];
    for (const pharmacy of pharmacies) {
      const coords = await geocodeAddress(pharmacy.address);
      withCoords.push(coords ? { ...pharmacy, ...coords } : pharmacy);
      await sleep(600);
    }
    result[letter] = withCoords;
  }
  return result;
}

const PROMPT = `Esta imagen es el calendario mensual de "Farmacias de Turno" de Santa Rosa (La Pampa, Argentina), publicado por el Colegio Farmacéutico.

Tiene dos partes:
1. Un calendario con los días del mes, cada día con una letra debajo (A, B, C, D...).
2. Una leyenda debajo con una card por letra, listando las farmacias de esa letra: nombre, dirección y uno o dos teléfonos.

Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional ni markdown:
{
  "dayLetters": { "1": "C", "2": "D", "3": "E" },
  "letterPharmacies": {
    "A": [
      { "name": "AMEGHINO", "address": "Ameghino N° 587", "phones": ["414441", "2954815352"] }
    ]
  }
}

Reglas:
- "dayLetters" debe tener una entrada por CADA día del mes que muestre el calendario, la clave es el número de día como string.
- "letterPharmacies" debe tener una entrada por cada letra que aparezca en el calendario, con TODAS las farmacias listadas en esa card de la leyenda.
- "phones" es un array con los números de teléfono visibles para esa farmacia (puede ser 1 o 2, sin espacios ni guiones, solo dígitos).
- No inventes farmacias ni días que no veas en la imagen.`;

interface IngestResult {
  ok: boolean;
  error?: string;
}

/** Descarga el PDF mensual, lo interpreta con Gemini (visión) y lo guarda. */
export async function ingestPharmacyScheduleForMonth(
  year: number,
  month: number,
): Promise<IngestResult> {
  const sourcePdfUrl = buildPdfUrl(year, month);

  const pdfRes = await fetch(sourcePdfUrl);
  if (!pdfRes.ok) {
    return { ok: false, error: `PDF no encontrado (${pdfRes.status}): ${sourcePdfUrl}` };
  }
  const buffer = Buffer.from(await pdfRes.arrayBuffer());
  const base64 = buffer.toString("base64");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY no configurada" };
  }

  let parsed: { dayLetters?: Record<string, string>; letterPharmacies?: Record<string, PharmacyEntry[]> };
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: base64 } },
      { text: PROMPT },
    ]);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: "Gemini no devolvió JSON reconocible" };
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[pharmacy-on-call] Gemini call failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error al leer el PDF con IA" };
  }

  const dayLetters = parsed.dayLetters ?? {};
  const letterPharmacies = parsed.letterPharmacies ?? {};
  const expectedDays = daysInMonth(year, month);
  const gotDays = Object.keys(dayLetters).length;

  // Tolerancia: exigimos al menos 90% de los días del mes y al menos una
  // letra con farmacias — evita guardar una respuesta claramente rota, pero
  // no somos tan estrictos como para fallar por un día que Gemini no haya
  // podido leer bien.
  if (gotDays < expectedDays * 0.9 || Object.keys(letterPharmacies).length === 0) {
    return {
      ok: false,
      error: `Respuesta de Gemini incompleta (${gotDays}/${expectedDays} días, ${Object.keys(letterPharmacies).length} letras)`,
    };
  }

  const geocodedLetterPharmacies = await geocodePharmacies(letterPharmacies);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;
  const { error } = await supabase.from("pharmacy_on_call_schedules").upsert(
    {
      city: CITY,
      year,
      month,
      day_letters: dayLetters,
      letter_pharmacies: geocodedLetterPharmacies,
      source_pdf_url: sourcePdfUrl,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "city,year,month" },
  );

  if (error) {
    console.error("[pharmacy-on-call] upsert failed:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Lee el turnero guardado para (año, mes) — null si todavía no se ingirió. */
export async function getPharmacySchedule(
  year: number,
  month: number,
): Promise<PharmacySchedule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;
  const { data } = await supabase
    .from("pharmacy_on_call_schedules")
    .select("*")
    .eq("city", CITY)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (!data) return null;

  return {
    city: data.city,
    year: data.year,
    month: data.month,
    dayLetters: data.day_letters,
    letterPharmacies: data.letter_pharmacies,
    sourcePdfUrl: data.source_pdf_url,
    fetchedAt: data.fetched_at,
  };
}
