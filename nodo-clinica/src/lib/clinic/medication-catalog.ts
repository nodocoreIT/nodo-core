/** Catálogo local (MVP). Reemplazable por API Vademécum / Alfabeta vía VADEMECUM_API_URL. */

export interface MedicationCatalogEntry {
  id: string;
  name: string;
  activeIngredient: string;
  presentations?: string[];
  defaultDosage: string;
  defaultFrequency: string;
  defaultDuration: string;
  category: string;
  laboratorio?: string;
  precio?: number;
  tipoVenta?: string;
}

export const MEDICATION_CATALOG: MedicationCatalogEntry[] = [
  {
    id: "ibu-600",
    name: "Ibuprofeno 600 mg",
    activeIngredient: "Ibuprofeno",
    presentations: ["Comprimidos 600 mg", "Suspensión 4%"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "Cada 8 horas",
    defaultDuration: "5 días",
    category: "AINE",
  },
  {
    id: "paracet-500",
    name: "Paracetamol 500 mg",
    activeIngredient: "Paracetamol",
    presentations: ["Comprimidos 500 mg", "Gotas"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "Cada 6 horas",
    defaultDuration: "5 días",
    category: "Analgésico",
  },
  {
    id: "amox-500",
    name: "Amoxicilina 500 mg",
    activeIngredient: "Amoxicilina",
    presentations: ["Cápsulas 500 mg", "Suspensión 250 mg/5ml"],
    defaultDosage: "1 cápsula",
    defaultFrequency: "Cada 8 horas",
    defaultDuration: "7 días",
    category: "Antibiótico",
  },
  {
    id: "azitro-500",
    name: "Azitromicina 500 mg",
    activeIngredient: "Azitromicina",
    presentations: ["Comprimidos 500 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "1 vez al día",
    defaultDuration: "3 días",
    category: "Antibiótico",
  },
  {
    id: "omepr-20",
    name: "Omeprazol 20 mg",
    activeIngredient: "Omeprazol",
    presentations: ["Cápsulas 20 mg"],
    defaultDosage: "1 cápsula",
    defaultFrequency: "En ayunas, 1 vez al día",
    defaultDuration: "14 días",
    category: "Gastro",
  },
  {
    id: "losart-50",
    name: "Losartán 50 mg",
    activeIngredient: "Losartán",
    presentations: ["Comprimidos 50 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "1 vez al día",
    defaultDuration: "Continuo",
    category: "Cardiovascular",
  },
  {
    id: "enalap-10",
    name: "Enalapril 10 mg",
    activeIngredient: "Enalapril",
    presentations: ["Comprimidos 10 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "1 vez al día",
    defaultDuration: "Continuo",
    category: "Cardiovascular",
  },
  {
    id: "metform-850",
    name: "Metformina 850 mg",
    activeIngredient: "Metformina",
    presentations: ["Comprimidos 850 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "Con las comidas",
    defaultDuration: "Continuo",
    category: "Diabetes",
  },
  {
    id: "salbut-100",
    name: "Salbutamol inhalador 100 mcg",
    activeIngredient: "Salbutamol",
    presentations: ["Aerosol 100 mcg/dosis"],
    defaultDosage: "2 inhalaciones",
    defaultFrequency: "Según necesidad",
    defaultDuration: "Según indicación",
    category: "Respiratorio",
  },
  {
    id: "lorat-10",
    name: "Loratadina 10 mg",
    activeIngredient: "Loratadina",
    presentations: ["Comprimidos 10 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "1 vez al día",
    defaultDuration: "7 días",
    category: "Antialérgico",
  },
  {
    id: "dexa-4",
    name: "Dexametasona 4 mg",
    activeIngredient: "Dexametasona",
    presentations: ["Comprimidos 4 mg", "Ampollas 4 mg"],
    defaultDosage: "Según peso / indicación",
    defaultFrequency: "Según indicación",
    defaultDuration: "Corta duración",
    category: "Corticoide",
  },
  {
    id: "diaz-10",
    name: "Diazepam 10 mg",
    activeIngredient: "Diazepam",
    presentations: ["Comprimidos 10 mg"],
    defaultDosage: "1 comprimido",
    defaultFrequency: "Noche",
    defaultDuration: "5 días",
    category: "Ansiolítico",
  },
];

export type MedicationSearchResponse = {
  results: MedicationCatalogEntry[];
  source: string;
  hint?: string;
};

export function searchMedications(query: string, limit = 12): MedicationCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  return MEDICATION_CATALOG.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.activeIngredient.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q),
  ).slice(0, limit);
}

export function formatPrescriptionRecordContent(
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>,
): string {
  return medications
    .map((m, i) => {
      const lines = [
        `${i + 1}. ${m.name}`,
        `   Dosis: ${m.dosage} | Frecuencia: ${m.frequency} | Duración: ${m.duration}`,
      ];
      if (m.instructions) lines.push(`   Indicaciones: ${m.instructions}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function parsePrescriptionRecordContent(content: string): Array<{
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}> {
  const blocks = content.split(/\n\n+/).filter(Boolean);
  const meds: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }> = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const title = lines[0]?.replace(/^\d+\.\s*/, "") ?? "";
    if (!title) continue;
    const doseLine = lines.find((l) => l.startsWith("Dosis:")) ?? "";
    const doseMatch = doseLine.match(
      /Dosis:\s*(.+?)\s*\|\s*Frecuencia:\s*(.+?)\s*\|\s*Duración:\s*(.+)$/i,
    );
    const instrLine = lines.find((l) => l.startsWith("Indicaciones:"));
    meds.push({
      name: title,
      dosage: doseMatch?.[1]?.trim() ?? "",
      frequency: doseMatch?.[2]?.trim() ?? "",
      duration: doseMatch?.[3]?.trim() ?? "",
      instructions: instrLine?.replace(/^Indicaciones:\s*/i, "").trim(),
    });
  }

  return meds;
}
