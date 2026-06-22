import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateContract } from "@/features/contracts/hooks/use-create-contract";
import { PROPERTIES_QUERY_KEY } from "@/features/properties/hooks/use-properties";
import { CONTACTS_QUERY_KEY } from "@/features/contacts/hooks/use-contacts";
import { ContractFormDialog } from "./contract-form-dialog";

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

  useEffect(() => {
    if (!open) return;
    void queryClient.invalidateQueries({ queryKey: PROPERTIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
  }, [open, queryClient]);

  return (
    <ContractFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onSubmit={(payload) => mutateAsync(payload).then(() => undefined)}
      isPending={isPending}
    />
  );
}
