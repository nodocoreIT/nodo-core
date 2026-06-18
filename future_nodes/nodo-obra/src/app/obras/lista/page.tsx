"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obraApi } from "@/lib/obra/client-api";
import type { ProyectoDashboard } from "@/lib/obra/types";
import { ObraCard } from "@/components/obra/obra-card";
import { Button } from "@/components/ui/button";

export default function ObrasListaPage() {
  const [obras, setObras] = useState<ProyectoDashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obraApi
      .getProyectos()
      .then((d) => setObras(d.obras))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-navy">
          Todas las obras
        </h2>
        <Button asChild size="sm">
          <Link href="/obras/nueva">Nueva obra</Link>
        </Button>
      </div>
      {obras.length === 0 ? (
        <p className="text-sm text-slate2">No hay obras cargadas.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {obras.map((obra) => (
            <ObraCard key={obra.id} obra={obra} />
          ))}
        </div>
      )}
    </div>
  );
}
