import { useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import type { ContractWithRelations } from "./use-contracts";

export interface WhatsAppPayload {
  phone: string;
  tenantName: string;
  contractId: string;
  rentAmount: number;
  currency: string;
  adjustmentIndex: string;
  nextAdjustmentDate: string | null;
}

interface SendResult {
  success: boolean;
  error?: string;
}

async function callSendWhatsApp(payload: WhatsAppPayload): Promise<SendResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await res.json();
  if (!res.ok) return { success: false, error: result.error ?? "Error al enviar el mensaje." };
  return { success: true };
}

/** Hook for sending WhatsApp adjustment notices. Tracks loading state per contractId. */
export function useSendWhatsApp() {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function sendFromContract(contract: ContractWithRelations): Promise<SendResult> {
    const phone = contract.tenant?.phone;
    if (!phone) return { success: false, error: "El inquilino no tiene teléfono registrado." };

    setLoadingId(contract.id);
    try {
      return await callSendWhatsApp({
        phone,
        tenantName: contract.tenant?.name ?? "Inquilino",
        contractId: contract.id,
        rentAmount: contract.rent_amount,
        currency: contract.currency,
        adjustmentIndex: contract.adjustment_index,
        nextAdjustmentDate: contract.next_adjustment_date,
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function sendFromAdjustment(adj: {
    contractId: string;
    tenantName: string;
    tenantPhone: string | null;
    rentAmount: number;
    currency: string;
    adjustmentIndex: string;
    nextAdjustmentDate: string;
  }): Promise<SendResult> {
    if (!adj.tenantPhone) return { success: false, error: "El inquilino no tiene teléfono registrado." };

    setLoadingId(adj.contractId);
    try {
      return await callSendWhatsApp({
        phone: adj.tenantPhone,
        tenantName: adj.tenantName,
        contractId: adj.contractId,
        rentAmount: adj.rentAmount,
        currency: adj.currency,
        adjustmentIndex: adj.adjustmentIndex,
        nextAdjustmentDate: adj.nextAdjustmentDate,
      });
    } finally {
      setLoadingId(null);
    }
  }

  return { sendFromContract, sendFromAdjustment, loadingId };
}
