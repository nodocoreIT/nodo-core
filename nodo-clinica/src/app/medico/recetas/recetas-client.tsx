"use client";

import { RecetaForm } from "@/components/medical/recetas/receta-form";

export function RecetasClient() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-navy">Nueva receta</h2>
      <RecetaForm />
    </div>
  );
}
