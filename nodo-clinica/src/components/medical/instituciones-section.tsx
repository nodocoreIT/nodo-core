"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle, Building2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { clinicApi, type InstitutionRecord } from "@/lib/clinic/client-api";

interface InstitutionSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface InstitutionFormState {
  name: string;
  city: string;
  address: string;
  extra_info: string;
  slots: InstitutionSlot[];
}

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const EMPTY_FORM: InstitutionFormState = {
  name: "",
  city: "",
  address: "",
  extra_info: "",
  slots: [],
};

export function InstitucionesSection() {
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<InstitutionFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstitutionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadInstitutions = () => {
    setLoading(true);
    clinicApi
      .getInstitutions()
      .then((res) => setInstitutions(res.institutions))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las instituciones"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId("new");
  };

  const startEdit = (inst: InstitutionRecord) => {
    setForm({
      name: inst.name,
      city: inst.city ?? "",
      address: inst.address ?? "",
      extra_info: inst.extra_info ?? "",
      slots: inst.schedule?.days ?? [],
    });
    setEditingId(inst.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const addSlot = () => {
    setForm((prev) => ({
      ...prev,
      slots: [...prev.slots, { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }],
    }));
  };

  const removeSlot = (idx: number) => {
    setForm((prev) => ({ ...prev, slots: prev.slots.filter((_, i) => i !== idx) }));
  };

  const updateSlot = (idx: number, field: keyof InstitutionSlot, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Ingresá el nombre de la institución");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        extra_info: form.extra_info.trim(),
        schedule: { days: form.slots },
      };

      if (editingId === "new") {
        await clinicApi.saveInstitution(payload);
        toast.success("Institución agregada");
      } else if (editingId) {
        await clinicApi.updateInstitution(editingId, payload);
        toast.success("Institución actualizada");
      }

      cancelEdit();
      loadInstitutions();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar la institución");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await clinicApi.deleteInstitution(deleteTarget.id);
      toast.success("Institución eliminada");
      setDeleteTarget(null);
      loadInstitutions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la institución");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Cargá las instituciones (clínicas, hospitales) donde atendés. Van a aparecer
        como membrete en las recetas médicas.
      </p>

      {institutions.length === 0 && editingId !== "new" && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
          <Building2 className="h-5 w-5 mx-auto mb-2 text-slate-300" />
          Todavía no cargaste ninguna institución.
        </div>
      )}

      <div className="space-y-2">
        {institutions.map((inst) =>
          editingId === inst.id ? (
            <InstitutionForm
              key={inst.id}
              form={form}
              setForm={setForm}
              onAddSlot={addSlot}
              onRemoveSlot={removeSlot}
              onUpdateSlot={updateSlot}
              onSave={handleSave}
              onCancel={cancelEdit}
              saving={saving}
            />
          ) : (
            <div
              key={inst.id}
              className="rounded-lg border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {inst.name}
                </p>
                {(inst.city || inst.address) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[inst.city, inst.address].filter(Boolean).join(" — ")}
                  </p>
                )}
                {inst.extra_info && (
                  <p className="text-xs text-slate-400 mt-0.5">{inst.extra_info}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => startEdit(inst)}
                  aria-label="Editar institución"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                  onClick={() => setDeleteTarget(inst)}
                  aria-label="Eliminar institución"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>

      {editingId === "new" ? (
        <InstitutionForm
          form={form}
          setForm={setForm}
          onAddSlot={addSlot}
          onRemoveSlot={removeSlot}
          onUpdateSlot={updateSlot}
          onSave={handleSave}
          onCancel={cancelEdit}
          saving={saving}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Agregar institución
        </Button>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar institución"
        description={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Ya no va a aparecer disponible para tus recetas.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Dialog open={!!saveError} onOpenChange={(open) => !open && setSaveError(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              No se pudo guardar
            </DialogTitle>
            <DialogDescription>{saveError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setSaveError(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InstitutionForm({
  form,
  setForm,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
  onSave,
  onCancel,
  saving,
}: {
  form: InstitutionFormState;
  setForm: React.Dispatch<React.SetStateAction<InstitutionFormState>>;
  onAddSlot: () => void;
  onRemoveSlot: (idx: number) => void;
  onUpdateSlot: (idx: number, field: keyof InstitutionSlot, value: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">Datos de la institución</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">
          Nombre <span className="text-red-600">(obligatorio)</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Hospital Italiano"
          className="mt-1 h-9 text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Ciudad</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="Ej: CABA"
            className="mt-1 h-9 text-sm bg-white"
          />
        </div>
        <div>
          <Label className="text-xs">Dirección</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Ej: Perón 4190"
            className="mt-1 h-9 text-sm bg-white"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Info extra</Label>
        <Input
          value={form.extra_info}
          onChange={(e) => setForm((prev) => ({ ...prev, extra_info: e.target.value }))}
          placeholder="Ej: Servicio de Gastroenterología"
          className="mt-1 h-9 text-sm bg-white"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Días y horarios en esta institución</Label>
        {form.slots.length > 0 && (
          <div className="space-y-2">
            {form.slots.map((slot, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) => onUpdateSlot(idx, "dayOfWeek", Number(e.target.value))}
                  className="h-9 rounded border border-slate-200 px-2 text-sm flex-1 bg-white"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => onUpdateSlot(idx, "startTime", e.target.value)}
                  className="h-9 rounded border border-slate-200 px-2 text-sm flex-1 bg-white"
                />
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => onUpdateSlot(idx, "endTime", e.target.value)}
                  className="h-9 rounded border border-slate-200 px-2 text-sm flex-1 bg-white"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => onRemoveSlot(idx)}>
                  −
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onAddSlot} className="w-full">
          + Agregar horario
        </Button>
      </div>

      <Button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full bg-emerald-700 hover:bg-emerald-800"
      >
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Guardar institución
      </Button>
    </div>
  );
}
