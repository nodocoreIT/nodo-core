"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search } from "lucide-react";
import type { Medication } from "@/types";
import { clinicApi } from "@/lib/clinic/client-api";
import type { MedicationCatalogEntry } from "@/lib/clinic/medication-catalog";

/** Medication plus catalog-suggested defaults, shown only as placeholders — never
 * written into the real value, so picking a drug from Vademécum never leaves text
 * the doctor has to manually clear. */
export interface MedicationDraft extends Medication {
  suggestedDosage?: string;
  suggestedFrequency?: string;
  suggestedDuration?: string;
}

export const emptyMedication = (): MedicationDraft => ({
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
});

function MedicationNameField({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (entry: MedicationCatalogEntry) => void;
}) {
  const [suggestions, setSuggestions] = useState<MedicationCatalogEntry[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await clinicApi.searchMedications(q);
      setSuggestions(data.results);
      setOpen(data.results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  return (
    <div className="relative">
      <Label className="text-xs">Nombre (Vademécum)</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            void search(e.target.value);
          }}
          onFocus={() => value.length >= 2 && void search(value)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar medicamento…"
          className="h-8 text-sm pl-8"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-white shadow-lg text-sm">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-blue-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-slate-500 ml-1 block">
                  {s.activeIngredient}
                  {s.laboratorio ? ` · ${s.laboratorio}` : ""}
                  {s.precio
                    ? ` · $${s.precio.toLocaleString("es-AR")}`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface MedicationRowsEditorProps {
  value: MedicationDraft[];
  onChange: (rows: MedicationDraft[]) => void;
}

/** Reusable medication-rows editor (Vademécum autocomplete + dosis/frecuencia/
 * duración/indicaciones) — extracted from prescription-form.tsx so the
 * standalone recetas flow (Fase 2) can reuse it without duplicating the
 * consultation form's logic. */
export function MedicationRowsEditor({ value, onChange }: MedicationRowsEditorProps) {
  const updateMedication = (
    index: number,
    field: keyof Medication,
    fieldValue: string,
  ) => {
    onChange(
      value.map((med, i) => (i === index ? { ...med, [field]: fieldValue } : med)),
    );
  };

  const applyCatalogEntry = (index: number, entry: MedicationCatalogEntry) => {
    onChange(
      value.map((med, i) =>
        i === index
          ? {
              ...med,
              name: entry.name,
              suggestedDosage: entry.defaultDosage,
              suggestedFrequency: entry.defaultFrequency,
              suggestedDuration: entry.defaultDuration,
            }
          : med,
      ),
    );
  };

  const addMedication = () => onChange([...value, emptyMedication()]);

  const removeMedication = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <>
      {value.map((med, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
        >
          <div className="col-span-2 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">
              Medicamento {index + 1}
            </span>
            {value.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMedication(index)}
                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="col-span-2">
            <MedicationNameField
              value={med.name}
              onChange={(v) => updateMedication(index, "name", v)}
              onPick={(entry) => applyCatalogEntry(index, entry)}
            />
          </div>
          <div>
            <Label className="text-xs">Dosis</Label>
            <Input
              value={med.dosage}
              onChange={(e) => updateMedication(index, "dosage", e.target.value)}
              placeholder={med.suggestedDosage || "1 comprimido"}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Frecuencia</Label>
            <Input
              value={med.frequency}
              onChange={(e) =>
                updateMedication(index, "frequency", e.target.value)
              }
              placeholder={med.suggestedFrequency || "Cada 8 horas"}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Duración</Label>
            <Input
              value={med.duration}
              onChange={(e) =>
                updateMedication(index, "duration", e.target.value)
              }
              placeholder={med.suggestedDuration || "7 días"}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Indicaciones</Label>
            <Input
              value={med.instructions || ""}
              onChange={(e) =>
                updateMedication(index, "instructions", e.target.value)
              }
              placeholder="Tomar con alimentos"
              className="h-8 text-sm"
            />
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={addMedication}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar medicamento
      </Button>
    </>
  );
}
