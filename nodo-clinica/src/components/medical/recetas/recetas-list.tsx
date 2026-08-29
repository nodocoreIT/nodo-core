"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Search,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { clinicApi } from "@/lib/clinic/client-api";
import { currencySymbol } from "@/lib/clinic/currency";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RecetaRow = Awaited<
  ReturnType<typeof clinicApi.getPrescriptionsByDoctor>
>["prescriptions"][number];

type RecetaDetail = Awaited<ReturnType<typeof clinicApi.getPrescription>>;

type MedicationEntry = {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

type RecetaStatus = "borrador" | "enviada" | "pagada";

function recetaStatus(row: RecetaRow): RecetaStatus {
  if (row.paymentStatus === "confirmed" || row.paymentStatus === "waived") {
    return "pagada";
  }
  if (row.sentAt) return "enviada";
  return "borrador";
}

const STATUS_BADGE: Record<RecetaStatus, { label: string; className: string }> = {
  borrador: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  enviada: {
    label: "Enviada",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  pagada: {
    label: "Pagada",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  return `${currencySymbol(currency)} ${amount.toLocaleString("es-AR")}`;
}

interface RecetasListProps {
  /** Fase 6 — called when the médico clicks "Editar" en un borrador (desde
   * la card o desde el modal de detalle), so the caller can open the form
   * dialog in edit mode. Only shown for recetas en estado "borrador". */
  onEdit?: (id: string) => void;
}

/** Fase 5 de "Recetas" — historial de recetas emitidas por el médico logueado,
 * con badge de estado (borrador/enviada/pagada) y botón de reenviar para las
 * que todavía no están pagadas. Fase 6 agrega "Editar" para los borradores.
 * Fase 7 agrega buscador por paciente (la lista arranca vacía hasta que se
 * busca algo) y un modal de "Ver detalle" con la info completa de la receta. */
export function RecetasList({ onEdit }: RecetasListProps = {}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RecetaRow[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecetaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    clinicApi
      .getPrescriptionsByDoctor()
      .then((data) => setRows(data.prescriptions))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las recetas"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    clinicApi
      .getPrescription(detailId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el detalle de la receta"),
      )
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detailId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return rows.filter((row) => row.patientFullName.toLowerCase().includes(q));
  }, [rows, query]);

  const detailRow = rows.find((r) => r.id === detailId) ?? null;
  const detailStatus = detailRow ? recetaStatus(detailRow) : null;

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      await clinicApi.sendPrescription(id);
      toast.success("Receta reenviada por email al paciente");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reenviar la receta");
    } finally {
      setResendingId(null);
    }
  };

  const handleEditFromDetail = () => {
    if (!detailId || !onEdit) return;
    const id = detailId;
    setDetailId(null);
    onEdit(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">
        Todavía no emitiste ninguna receta.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre de paciente…"
          className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[15px] outline-none transition-all focus:border-[var(--color-primary)] focus:shadow-[0_0_0_4px_rgba(13,148,136,.16)]"
        />
      </div>

      {query.trim() === "" ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-900">Buscá un paciente para ver sus recetas</p>
          <p className="max-w-xs text-xs text-slate-500">
            Escribí el nombre arriba y acá te van a aparecer las recetas que le emitiste.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-900">Sin resultados</p>
          <p className="max-w-xs text-xs text-slate-500">Probá con otro nombre.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const status = recetaStatus(row);
            const badge = STATUS_BADGE[status];
            const canResend = status !== "pagada";

            return (
              <div
                key={row.id}
                className="rounded-lg border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {row.patientFullName}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                    {row.institutionSnapshot && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {row.institutionSnapshot.name}
                      </span>
                    )}
                    <span className="font-medium text-slate-600">
                      {formatMoney(row.priceAmount, row.priceCurrency)}
                    </span>
                    <span>
                      {format(new Date(row.createdAt), "dd/MM/yyyy", { locale: es })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => setDetailId(row.id)}
                  >
                    <Eye className="h-3 w-3" />
                    Ver detalle
                  </Button>

                  {canResend && status === "borrador" && onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => onEdit(row.id)}
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Button>
                  )}
                  {canResend && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1"
                      disabled={resendingId === row.id}
                      onClick={() => void handleResend(row.id)}
                    >
                      {resendingId === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-3 w-3" />
                          {status === "enviada" ? "Reenviar" : "Enviar"}
                        </>
                      )}
                    </Button>
                  )}
                  {!canResend && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 shrink-0">
                      <FileText className="h-3 w-3" />
                      Pagada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Receta de {detailRow?.patientFullName ?? "paciente"}
            </DialogTitle>
            <DialogDescription>
              {detailRow &&
                `Emitida el ${format(new Date(detailRow.createdAt), "dd/MM/yyyy", { locale: es })}`}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : detail && detailRow && detailStatus ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_BADGE[detailStatus].className,
                  )}
                >
                  {STATUS_BADGE[detailStatus].label}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {formatMoney(detailRow.priceAmount, detailRow.priceCurrency)}
                </span>
              </div>

              {detailRow.institutionSnapshot && (
                <div className="text-sm text-slate-600 flex items-start gap-1.5">
                  <Building2 className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800">{detailRow.institutionSnapshot.name}</p>
                    {(detailRow.institutionSnapshot.address || detailRow.institutionSnapshot.city) && (
                      <p className="text-xs text-slate-500">
                        {[detailRow.institutionSnapshot.address, detailRow.institutionSnapshot.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Medicamentos
                </p>
                {Array.isArray(detail.medications) && detail.medications.length > 0 ? (
                  <ul className="space-y-2">
                    {(detail.medications as MedicationEntry[]).map((med, idx) => (
                      <li key={idx} className="rounded-md border border-slate-200 p-2 text-sm">
                        <p className="font-medium text-slate-900">
                          {med.name} {med.dosage ? `— ${med.dosage}` : ""}
                        </p>
                        {(med.frequency || med.duration) && (
                          <p className="text-xs text-slate-500">
                            {[med.frequency, med.duration].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {med.instructions && (
                          <p className="text-xs text-slate-500 mt-0.5">{med.instructions}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Sin medicamentos cargados.</p>
                )}
              </div>

              {detail.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Notas
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}

              {detailRow.sentAt && (
                <p className="text-xs text-slate-400">
                  Enviada el {format(new Date(detailRow.sentAt), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
              )}
            </div>
          ) : null}

          {detailStatus === "borrador" && onEdit && (
            <DialogFooter>
              <Button className="gap-1.5" onClick={handleEditFromDetail}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
