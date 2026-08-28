"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RecetaForm } from "@/components/medical/recetas/receta-form";
import { RecetasList } from "@/components/medical/recetas/recetas-list";

type FormMode = { mode: "closed" } | { mode: "create" } | { mode: "edit"; id: string };

/** Fase 5 de "Recetas" — el historial (<RecetasList />) es la vista por
 * defecto; "Nueva receta" abre el form (Fase 2) en un dialog para no romper
 * el layout de la lista. Fase 6 agrega un modo edición para borradores,
 * disparado desde <RecetasList onEdit />. */
export function RecetasClient() {
  const [formState, setFormState] = useState<FormMode>({ mode: "closed" });
  const [listKey, setListKey] = useState(0);

  const closeForm = () => {
    setFormState({ mode: "closed" });
    setListKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-navy">Recetas</h2>
        <Button
          onClick={() => setFormState({ mode: "create" })}
          className="gap-2 bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Nueva receta
        </Button>
      </div>

      <RecetasList
        key={listKey}
        onEdit={(id) => setFormState({ mode: "edit", id })}
      />

      <Dialog
        open={formState.mode !== "closed"}
        onOpenChange={(open) => !open && setFormState({ mode: "closed" })}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formState.mode === "edit" ? "Editar receta" : "Nueva receta"}
            </DialogTitle>
            <DialogDescription>
              Armá una receta para un paciente registrado o no registrado.
            </DialogDescription>
          </DialogHeader>
          {formState.mode !== "closed" && (
            <RecetaForm
              editingId={formState.mode === "edit" ? formState.id : undefined}
              onSaved={closeForm}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
