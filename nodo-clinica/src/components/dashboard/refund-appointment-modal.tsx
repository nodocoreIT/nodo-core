"use client";

import { useState } from "react";
import { CheckCircle, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PendingRefundItem } from "@/components/dashboard/day-appointments-panel";

type ItemStatus = "idle" | "processing" | "done" | "error";

interface RefundRowState {
  status: ItemStatus;
  errorMessage?: string;
}

interface RefundAppointmentModalProps {
  open: boolean;
  items: PendingRefundItem[];
  onClose: () => void;
}

export function RefundAppointmentModal({ open, items, onClose }: RefundAppointmentModalProps) {
  const [rowState, setRowState] = useState<Record<string, RefundRowState>>({});

  function stateFor(id: string): RefundRowState {
    return rowState[id] ?? { status: "idle" };
  }

  async function processMercadoPago(appointmentId: string) {
    setRowState((prev) => ({ ...prev, [appointmentId]: { status: "processing" } }));
    try {
      await clinicApi.refundAppointmentMercadoPago(appointmentId);
      setRowState((prev) => ({ ...prev, [appointmentId]: { status: "done" } }));
    } catch (e) {
      setRowState((prev) => ({
        ...prev,
        [appointmentId]: {
          status: "error",
          errorMessage: e instanceof Error ? e.message : "Error al reembolsar",
        },
      }));
    }
  }

  async function markTransferRefunded(appointmentId: string, checked: boolean) {
    if (!checked) return;
    setRowState((prev) => ({ ...prev, [appointmentId]: { status: "processing" } }));
    try {
      await clinicApi.markAppointmentRefundedManually(appointmentId);
      setRowState((prev) => ({ ...prev, [appointmentId]: { status: "done" } }));
    } catch (e) {
      setRowState((prev) => ({
        ...prev,
        [appointmentId]: {
          status: "error",
          errorMessage: e instanceof Error ? e.message : "Error al registrar la devolución",
        },
      }));
    }
  }

  const allResolved = items.every((item) => stateFor(item.appointmentId).status === "done");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Devolución de pago</DialogTitle>
          <DialogDescription>
            {items.length === 1
              ? "Este turno tenía un pago confirmado. Procesá la devolución al paciente."
              : `${items.length} turnos cancelados tenían pago confirmado. Procesá la devolución de cada uno.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {items.map((item) => {
            const state = stateFor(item.appointmentId);
            return (
              <div
                key={item.appointmentId}
                className="rounded-lg border border-slate-200 p-3 space-y-2"
              >
                <p className="text-sm font-medium text-slate-800">{item.patientName}</p>

                {item.paymentProvider === "mercadopago" ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">Pagado con Mercado Pago</p>
                    {state.status === "done" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" /> Reembolsado
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={state.status === "processing"}
                        onClick={() => processMercadoPago(item.appointmentId)}
                        className="h-7 text-xs gap-1"
                      >
                        {state.status === "processing" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : state.status === "error" ? (
                          <RotateCcw className="h-3 w-3" />
                        ) : null}
                        {state.status === "error" ? "Reintentar" : "Procesar reembolso"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.status === "done"}
                      disabled={state.status === "processing"}
                      onChange={(e) => markTransferRefunded(item.appointmentId, e.target.checked)}
                    />
                    Ya devolví este pago por transferencia
                    {state.status === "processing" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </label>
                )}

                {state.status === "error" && (
                  <p className="text-[11px] text-red-600">{state.errorMessage}</p>
                )}
              </div>
            );
          })}
        </div>

        {!allResolved && (
          <p className="text-[11px] text-slate-400">
            Podés cerrar y completar la devolución más tarde — los turnos ya quedaron cancelados.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
