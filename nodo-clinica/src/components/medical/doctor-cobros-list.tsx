"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { clinicApi } from "@/lib/clinic/client-api";
import { formatReceiptDateDisplay } from "@/lib/clinic/cobros-receipt";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DoctorCobrosListProps {
  doctorId: string;
}

type CobroEntry = {
  id: string;
  patientName: string;
  paidAt: string;
  bookedAt: string;
  scheduledAt: string;
  paymentProvider?: "transfer" | "mercadopago";
  amount: number;
  currency: "ARS";
  receiptTransferDate?: string;
  receiptTransferTime?: string;
  operationId?: string;
  mercadopagoPaymentId?: string;
  receiptOlderThanBooking?: boolean;
  documents?: Array<{ id: string; fileName: string; downloadUrl: string }>;
};

function formatMoney(amount: number) {
  return `ARS ${amount.toLocaleString("es-AR")}`;
}

function providerLabel(provider?: CobroEntry["paymentProvider"]) {
  if (provider === "mercadopago") return "Mercado Pago";
  if (provider === "transfer") return "Transferencia";
  return "Pago";
}

export function DoctorCobrosList({ doctorId }: DoctorCobrosListProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CobroEntry[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    clinicApi
      .getCobrosReceived(doctorId)
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 20_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-lg border border-dashed p-6 text-center">
        Todavía no hay cobros registrados. Cuando un paciente pague (Mercado Pago
        o transferencia aprobada), aparecerá acá con la fecha del comprobante, la
        confirmación y el turno.
      </p>
    );
  }

  const total = entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-slate-700">
          {entries.length} cobro{entries.length === 1 ? "" : "s"}
        </span>
        {total > 0 && (
          <span className="font-semibold text-emerald-800">
            {formatMoney(total)} acumulados
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2.5 font-medium">Paciente</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                Fecha en comprobante
              </th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                Confirmado
              </th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                Turno
              </th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                Referencia
              </th>
              <th className="px-3 py-2.5 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => {
              const receiptLabel = formatReceiptDateDisplay(
                entry.receiptTransferDate,
                entry.receiptTransferTime,
              );
              const suspicious = !!entry.receiptOlderThanBooking;

              return (
                <tr key={entry.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-slate-800">
                      {entry.patientName}
                    </div>
                    <Badge
                      variant="outline"
                      className="mt-1 text-[10px] font-normal gap-1"
                    >
                      {entry.paymentProvider === "mercadopago" ? (
                        <CreditCard className="h-3 w-3" />
                      ) : (
                        <Receipt className="h-3 w-3" />
                      )}
                      {providerLabel(entry.paymentProvider)}
                    </Badge>
                    {entry.documents && entry.documents.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {entry.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            Ver comprobante
                            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 whitespace-nowrap align-top",
                      suspicious
                        ? "text-red-700 font-semibold bg-red-50/80"
                        : "text-slate-600",
                    )}
                  >
                    {receiptLabel ?? (
                      <span className="text-slate-400">—</span>
                    )}
                    {suspicious && (
                      <p className="text-[10px] font-normal text-red-600 mt-0.5 max-w-[9rem] leading-snug">
                        Anterior al día que reservó el turno
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap align-top">
                    {format(new Date(entry.paidAt), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap align-top">
                    {format(new Date(entry.scheduledAt), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </td>
                  <td className="px-3 py-3 text-slate-600 align-top">
                    {entry.operationId ? (
                      <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded break-all">
                        {entry.operationId}
                      </code>
                    ) : entry.mercadopagoPaymentId ? (
                      <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded break-all">
                        MP {entry.mercadopagoPaymentId.slice(-8)}
                      </code>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-emerald-800 whitespace-nowrap align-top">
                    {entry.amount > 0 ? formatMoney(entry.amount) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
