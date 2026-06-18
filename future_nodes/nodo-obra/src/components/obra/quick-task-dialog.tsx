"use client";

import { useState } from "react";
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
import type { ProyectoDashboard, TareaTipo } from "@/lib/obra/types";

interface QuickTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TareaTipo;
  title: string;
  obras: ProyectoDashboard[];
  onSaved: () => void;
}

export function QuickTaskDialog({
  open,
  onOpenChange,
  tipo,
  title,
  obras,
  onSaved,
}: QuickTaskDialogProps) {
  const [proyectoId, setProyectoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await obraApi.createTarea({
        proyectoId,
        titulo,
        tipo,
        fechaHora: tipo === "agenda" ? fechaHora : undefined,
      });
      setTitulo("");
      setFechaHora("");
      setProyectoId("");
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
            <Label>Obra</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              required
            >
              <option value="">Seleccionar obra…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Detalle</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                tipo === "caja"
                  ? "Ej: Rendir ticket ferretería"
                  : "Descripción de la tarea"
              }
              required
            />
          </div>
          {tipo === "agenda" && (
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={fechaHora}
                onChange={(e) => setFechaHora(e.target.value)}
                required
              />
            </div>
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
