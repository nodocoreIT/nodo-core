import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateContract } from "@/features/contracts/hooks/use-create-contract";
import { PROPERTIES_QUERY_KEY } from "@/features/properties/hooks/use-properties";
import { CONTACTS_QUERY_KEY } from "@/features/contacts/hooks/use-contacts";
import { ContractFormDialog } from "./contract-form-dialog";
import { GeneratePaymentsDialog } from "./generate-payments-dialog";

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateContractDialogProps) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useCreateContract();
  const [createdContract, setCreatedContract] = useState<{
    id: string;
    start_date: string;
    end_date: string;
    rent_amount: number;
    currency: string;
    status: string;
    expenses_amount: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    void queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
  }, [open, queryClient]);

  return (
    <>
      <ContractFormDialog
        open={open && !createdContract}
        onOpenChange={(isOpen) => {
          if (!isOpen && !createdContract) onOpenChange(false);
        }}
        onSubmit={async (payload) => {
          const contract = await mutateAsync(payload);
          setCreatedContract({
            id: contract.id,
            start_date: contract.start_date,
            end_date: contract.end_date,
            rent_amount: contract.rent_amount,
            currency: contract.currency,
            status: contract.status,
            expenses_amount: contract.expenses_amount ?? 0,
          });
        }}
        isPending={isPending}
      />
      <GeneratePaymentsDialog
        open={!!createdContract}
        contract={createdContract}
        onClose={() => {
          setCreatedContract(null);
          onOpenChange(false);
          onSuccess?.();
        }}
      />
    </>
  );
}
