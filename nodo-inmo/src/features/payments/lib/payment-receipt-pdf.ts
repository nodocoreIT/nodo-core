import React from "react";
import { supabase } from "@/shared/lib/supabase";
import { createLogoSignedUrl } from "@/features/agency-profile/hooks/use-logo-url";
import type { PaymentReceiptData } from "../components/payment-receipt-document";
import type { PaymentWithRelations } from "../hooks/use-payments";
import { buildCobroBreakdown } from "./cobro-breakdown";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").slice(0, 30);
}

type AgencyForReceipt = {
  legal_name?: string | null;
  address?: string | null;
  pdf_logo_path?: string | null;
} | null;

export async function buildReceiptData(
  payment: PaymentWithRelations,
  agency: AgencyForReceipt,
  logoUrl?: string | null,
): Promise<PaymentReceiptData> {
  let accountLabel: string | null = null;

  if (payment.status === "paid") {
    const { data } = await supabase
      .schema("nodo_inmo")
      .from("cash_movements")
      .select("category")
      .eq("payment_id", payment.id)
      .eq("source", "commission")
      .limit(1)
      .maybeSingle();

    accountLabel = data?.category ?? null;
  }

  const breakdown = buildCobroBreakdown(payment);
  const resolvedLogoUrl =
    logoUrl !== undefined
      ? logoUrl
      : agency?.pdf_logo_path
        ? await createLogoSignedUrl(agency.pdf_logo_path)
        : null;

  return {
    agencyName: agency?.legal_name ?? "NODO INMO",
    address: agency?.address ?? "",
    receiptNumber: payment.id.slice(0, 4).toUpperCase(),
    paidDate: payment.paid_date ?? new Date().toISOString().slice(0, 10),
    tenantName: payment.contract?.tenant?.name ?? "—",
    propertyAddress: payment.contract?.property?.address ?? "—",
    period: payment.period,
    paymentMethod: accountLabel ?? payment.payment_method ?? "Transferencia",
    currency: payment.currency,
    rentAmount: breakdown.rentAmount,
    expensesAmount: breakdown.expensesAmount,
    grossAmount: breakdown.grossAmount,
    logoUrl: resolvedLogoUrl,
  };
}

export async function downloadPaymentReceipt(
  payment: PaymentWithRelations,
  agency: AgencyForReceipt,
): Promise<void> {
  const data = await buildReceiptData(payment, agency);
  const [{ pdf }, { PaymentReceiptDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/features/payments/components/payment-receipt-document"),
  ]);

  const blob = await (pdf as (doc: React.ReactElement) => { toBlob: () => Promise<Blob> })(
    React.createElement(PaymentReceiptDocument, data),
  ).toBlob();

  const tenant = slugify(data.tenantName);
  const periodTag = data.period.slice(0, 7).replace("-", "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recibo_${tenant}_${periodTag}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
