"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obraApi } from "@/lib/obra/client-api";
import { TAREA_TIPO_LABELS } from "@/lib/obra/tareas";
import type { TareaTipo } from "@/lib/obra/types";

const REQUERIMIENTO_TIPOS: TareaTipo[] = [
  "propietario",
  "logistica",
  "agenda",
  "operativa",
  "caja",
];

interface FichaPendienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proyectoId: string;
  title: string;
  allowedTipos?: TareaTipo[];
  defaultTipo?: TareaTipo;
  showFechaLimite?: boolean;
  showAgendaHora?: boolean;
  onSaved: () => void;
}

export function FichaPendienteDialog({
  open,
  onOpenChange,
  proyectoId,
  title,
  allowedTipos = REQUERIMIENTO_TIPOS,
  defaultTipo = "propietario",
  showFechaLimite = true,
  showAgendaHora = false,
  onSaved,
}: FichaPendienteDialogProps) {
  const [tipo, setTipo] = useState<TareaTipo>(defaultTipo);
  const [titulo, setTitulo] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTipo(defaultTipo);
      setTitulo("");
      setFechaLimite("");
      setFechaHora("");
      setError(null);
    }
  }, [open, defaultTipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await obraApi.createTarea({
        proyectoId,
        titulo,
        tipo,
        fechaLimite: fechaLimite || undefined,
        fechaHora: tipo === "agenda" && fechaHora ? fechaHora : undefined,
      });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pendiente-titulo">Descripción</Label>
            <Input
              id="pendiente-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                tipo === "propietario"
                  ? "Ej: Elegir cerámicos del baño principal"
                  : "Detalle del pendiente"
              }
              required
            />
          </div>

          {allowedTipos.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="pendiente-tipo">Tipo</Label>
              <select
                id="pendiente-tipo"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TareaTipo)}
                required
              >
                {allowedTipos.map((value) => (
                  <option key={value} value={value}>
                    {TAREA_TIPO_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tipo === "agenda" && showAgendaHora ? (
            <div className="space-y-2">
              <Label htmlFor="pendiente-fecha-hora">Fecha y hora</Label>
              <Input
                id="pendiente-fecha-hora"
                type="datetime-local"
                value={fechaHora}
                onChange={(e) => setFechaHora(e.target.value)}
                required
              />
            </div>
          ) : (
            showFechaLimite && (
              <div className="space-y-2">
                <Label htmlFor="pendiente-fecha">Fecha límite (opcional)</Label>
                <Input
                  id="pendiente-fecha"
                  type="date"
                  value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)}
                />
              </div>
            )
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
