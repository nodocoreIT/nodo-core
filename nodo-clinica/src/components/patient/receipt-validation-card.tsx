"use client";

import { CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import type { PaymentReceiptAudit } from "@/lib/clinic/local-db";

interface ReceiptValidationCardProps {
  audit: PaymentReceiptAudit | null;
  loading?: boolean;
  title?: string;
}

export function ReceiptValidationCard({
  audit,
  loading,
  title = "Lectura del comprobante (IA)",
}: ReceiptValidationCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        Analizando comprobante con IA…
      </div>
    );
  }

  if (!audit) return null;

  const currency = audit.currency ?? "ARS";

  const statusLabel =
    audit.valid
      ? "OK"
      : audit.checks && !audit.checks.amount.pass
        ? "No coincide"
        : "Revisar";

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 text-sm ${
        audit.valid
          ? "border-emerald-200 bg-emerald-50/60"
          : audit.checks && !audit.checks.amount.pass
            ? "border-red-200 bg-red-50/50"
            : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          {title}
        </p>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            audit.valid
              ? "bg-emerald-100 text-emerald-800"
              : audit.checks && !audit.checks.amount.pass
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-900"
          }`}
        >
          {statusLabel}
          {audit.confidence > 0 ? ` · ${audit.confidence}%` : ""}
        </span>
      </div>

      <div className="rounded-md bg-white/80 border border-slate-100 divide-y text-xs">
        {audit.payerName && (
          <Row label="Origen / quien transfirió" value={audit.payerName} />
        )}
        {audit.recipient && (
          <Row label="Destinatario detectado" value={audit.recipient} />
        )}
        {audit.amount != null && (
          <Row
            label="Importe leído"
            value={`${currency} ${audit.amount.toLocaleString("es-AR")}`}
          />
        )}
        {audit.expectedAmount != null && audit.expectedAmount > 0 && (
          <Row
            label="Honorario esperado"
            value={`${currency} ${audit.expectedAmount.toLocaleString("es-AR")}`}
          />
        )}
        {audit.transferDate && (
          <Row label="Fecha en comprobante" value={audit.transferDate} />
        )}
        {audit.operationId && (
          <Row label="Nº de operación" value={audit.operationId} />
        )}
        {audit.summary && !audit.payerName && (
          <Row label="Resumen" value={audit.summary} />
        )}
      </div>

      {audit.checks && (
        <ul className="space-y-1 text-xs">
          {Object.entries(audit.checks).map(([key, check]) => (
            <li
              key={key}
              className={`flex items-start gap-1.5 ${check.pass ? "text-emerald-800" : "text-amber-900"}`}
            >
              {check.pass ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              {check.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}
