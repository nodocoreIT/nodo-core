"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { clinicApi } from "@/lib/clinic/client-api";
import { toast } from "sonner";

export interface DayAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: string | null;
  payment_provider: string | null;
  mercadopago_payment_id: string | null;
  patient?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    profilePhotoUrl?: string;
  };
}

export interface PendingRefundItem {
  appointmentId: string;
  patientName: string;
  paymentProvider: "mercadopago" | "transfer";
}

interface DayAppointmentsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  appointments: DayAppointment[];
  loading: boolean;
  onCancelled: (pending: PendingRefundItem[]) => void;
}

function paymentStatusLabel(status: string | null): { label: string; variant: "default" | "secondary" | "destructive" } {
  switch (status) {
    case "confirmed":
      return { label: "Pagado", variant: "default" };
    case "pending":
      return { label: "Pago pendiente", variant: "secondary" };
    case "waived":
      return { label: "Sin cargo", variant: "secondary" };
    default:
      return { label: "Sin pago", variant: "secondary" };
  }
}

export function DayAppointmentsPanel({
  open,
  onOpenChange,
  date,
  appointments,
  loading,
  onCancelled,
}: DayAppointmentsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const groups = useMemo(() => {
    const byPatient = new Map<string, { patientId: string; patientName: string; appointments: DayAppointment[] }>();
    for (const apt of appointments) {
      const patientId = apt.patient?.id ?? apt.id;
      const entry = byPatient.get(patientId) ?? {
        patientId,
        patientName: apt.patient?.fullName ?? "Paciente",
        appointments: [],
      };
      entry.appointments.push(apt);
      byPatient.set(patientId, entry);
    }
    return Array.from(byPatient.values());
  }, [appointments]);

  function toggleAppointment(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePatient(patientAppointmentIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected = patientAppointmentIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of patientAppointmentIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function runCancel(ids: string[]) {
    setCancelling(true);
    try {
      const { results } = await clinicApi.doctorCancelAppointments(ids);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        toast.error(`No se pudieron cancelar ${failed.length} turno(s)`);
      }

      const pending: PendingRefundItem[] = [];
      for (const r of results) {
        if (!r.ok || !r.requiresRefund) continue;
        const apt = appointments.find((a) => a.id === r.id);
        pending.push({
          appointmentId: r.id,
          patientName: apt?.patient?.fullName ?? "Paciente",
          paymentProvider: r.paymentProvider === "mercadopago" ? "mercadopago" : "transfer",
        });
      }

      setSelectedIds(new Set());
      onCancelled(pending);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cancelar turnos");
    } finally {
      setCancelling(false);
      setConfirmTarget(null);
    }
  }

  const allIds = appointments.map((a) => a.id);
  const dateLabel = date
    ? format(new Date(`${date}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })
    : "";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto px-6 sm:px-8">
          <SheetHeader className="px-0 pt-2">
            <SheetTitle className="capitalize">{dateLabel || "Turnos del día"}</SheetTitle>
            <SheetDescription>
              {appointments.length === 0
                ? "No hay turnos este día."
                : `${appointments.length} turno(s), ${groups.length} paciente(s).`}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-4 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setConfirmTarget({ ids: allIds, label: "todos los turnos del día" })}
              >
                Cancelar todos los turnos del día
              </Button>

              {groups.map((group) => {
                const groupIds = group.appointments.map((a) => a.id);
                const allSelected = groupIds.every((id) => selectedIds.has(id));

                return (
                  <div key={group.patientId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1.5"
                        checked={allSelected}
                        onChange={() => togglePatient(groupIds)}
                        aria-label={`Seleccionar turnos de ${group.patientName}`}
                      />
                      <UserAvatar name={group.patientName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {group.patientName}
                        </p>
                        <div className="mt-1 space-y-1">
                          {group.appointments.map((apt) => {
                            const payment = paymentStatusLabel(apt.payment_status);
                            return (
                              <div
                                key={apt.id}
                                className="flex items-center gap-2 text-xs text-slate-500"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(apt.id)}
                                  onChange={() => toggleAppointment(apt.id)}
                                  aria-label={`Seleccionar turno de las ${format(new Date(apt.scheduled_at), "HH:mm")}`}
                                />
                                <span>{format(new Date(apt.scheduled_at), "HH:mm")} hs</span>
                                <Badge variant={payment.variant} className="text-[10px]">
                                  {payment.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setConfirmTarget({
                            ids: groupIds,
                            label: `los turnos de ${group.patientName}`,
                          })
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    setConfirmTarget({
                      ids: Array.from(selectedIds),
                      label: `${selectedIds.size} turno(s) seleccionado(s)`,
                    })
                  }
                >
                  Cancelar seleccionados ({selectedIds.size})
                </Button>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmTarget(null);
        }}
        title="Cancelar turnos"
        description={`¿Confirmás cancelar ${confirmTarget?.label ?? ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar turnos"
        destructive
        loading={cancelling}
        onConfirm={() => confirmTarget && runCancel(confirmTarget.ids)}
      />
    </>
  );
}
