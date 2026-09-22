import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import type { ContractWithRelations } from "./use-contracts";
import {
  buildRentIncreaseWhatsAppMessage,
  openRentIncreaseWhatsApp,
} from "@/features/contracts/lib/rent-increase-whatsapp";

export interface AdjustmentWhatsAppInput {
  contractId: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyAddress: string;
  rentAmount: number;
  currency: string;
  adjustmentIndex: string;
  nextAdjustmentDate: string;
}

interface SendResult {
  success: boolean;
  error?: string;
}

export function useSendWhatsApp() {
  const { data: agency } = useOrgProfile();
  const agencyName = agency?.legal_name?.trim() || "la inmobiliaria";

  function sendFromContract(contract: ContractWithRelations): SendResult {
    const phone = contract.tenant?.phone;
    if (!phone) return { success: false, error: "El inquilino no tiene teléfono registrado." };

    const ok = openRentIncreaseWhatsApp(
      phone,
      buildRentIncreaseWhatsAppMessage({
        tenantName: contract.tenant?.name ?? "Inquilino",
        agencyName,
        propertyAddress: contract.property?.address ?? "la propiedad",
        adjustmentIndex: contract.adjustment_index,
        nextAdjustmentDate: contract.next_adjustment_date,
        rentAmount: contract.rent_amount,
        currency: contract.currency,
      }),
    );
    return ok
      ? { success: true }
      : { success: false, error: "El teléfono del inquilino no es válido." };
  }

  function sendFromAdjustment(adj: AdjustmentWhatsAppInput): SendResult {
    if (!adj.tenantPhone) {
      return { success: false, error: "El inquilino no tiene teléfono registrado." };
    }

    const ok = openRentIncreaseWhatsApp(
      adj.tenantPhone,
      buildRentIncreaseWhatsAppMessage({
        tenantName: adj.tenantName,
        agencyName,
        propertyAddress: adj.propertyAddress,
        adjustmentIndex: adj.adjustmentIndex,
        nextAdjustmentDate: adj.nextAdjustmentDate,
        rentAmount: adj.rentAmount,
        currency: adj.currency,
      }),
    );
    return ok
      ? { success: true }
      : { success: false, error: "El teléfono del inquilino no es válido." };
  }

  return { sendFromContract, sendFromAdjustment };
}
