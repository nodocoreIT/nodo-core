"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, QrCode } from "lucide-react";
import { currencySymbol } from "@/lib/clinic/currency";

interface PaymentInfo {
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  beneficiaryName?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
}

interface ConsultationPaymentPanelProps {
  doctorName: string;
  payment?: PaymentInfo | null;
}

export function ConsultationPaymentPanel({
  doctorName,
  payment,
}: ConsultationPaymentPanelProps) {
  if (
    !payment?.consultationFee &&
    !payment?.alias &&
    !payment?.cbu &&
    !payment?.beneficiaryName &&
    !payment?.qrImageData
  ) {
    return null;
  }

  const fee = payment.consultationFee
    ? `${currencySymbol(payment.currency)} ${payment.consultationFee.toLocaleString("es-AR")}`
    : null;

  return (
    <Card size="sm" className="border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 shadow-sm">
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium flex items-center gap-2 text-[var(--color-primary)]">
              <CreditCard className="h-4 w-4" />
              Pago de la consulta
            </p>
            <p className="text-xs text-slate-500">Dr/a. {doctorName}</p>
            {fee && (
              <Badge className="bg-[var(--color-primary)] text-white text-sm px-3 py-1 shrink-0 mt-1">
                Honorario: {fee}
              </Badge>
            )}
          </div>
          {(payment.alias || payment.cbu || payment.beneficiaryName) && (
            <div className="flex flex-col gap-1">
              {payment.alias && (
                <p className="text-sm">
                  <span className="text-slate-500">Alias:</span>{" "}
                  <strong className="font-mono">{payment.alias}</strong>
                </p>
              )}
              {payment.cbu && (
                <p className="text-sm">
                  <span className="text-slate-500">CBU/CVU:</span>{" "}
                  <strong className="font-mono text-xs">{payment.cbu}</strong>
                </p>
              )}
              {payment.beneficiaryName && (
                <p className="text-sm">
                  <span className="text-slate-500">Titular:</span>{" "}
                  <strong>{payment.beneficiaryName}</strong>
                </p>
              )}
            </div>
          )}
        </div>
        {payment.paymentInstructions && (
          <p className="text-xs text-slate-600 whitespace-pre-wrap">
            {payment.paymentInstructions}
          </p>
        )}
        {payment.qrImageData && (
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500 mb-2 flex items-center justify-center gap-1">
              <QrCode className="h-3.5 w-3.5" />
              Escaneá para pagar
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payment.qrImageData}
              alt="QR de pago"
              className="max-h-44 mx-auto rounded-lg border border-[var(--color-primary)]/30 bg-white p-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
