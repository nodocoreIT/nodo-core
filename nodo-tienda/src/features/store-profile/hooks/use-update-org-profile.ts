import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { OrgProfileRow } from "@/shared/types/database";
import { ensureStoreForOrg } from "@/shared/lib/ensure-store";
import { ORG_PROFILE_QUERY_KEY } from "./use-org-profile";

type UpdatePayload = Partial<Omit<OrgProfileRow, "id" | "org_id" | "created_at" | "updated_at">>;

export function useUpdateOrgProfile() {
  const { orgId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (values: UpdatePayload) => {
      if (!orgId) throw new Error("No org_id — not provisioned yet");

      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("org_profiles")
        .upsert({ org_id: orgId, ...values }, { onConflict: "org_id" })
        .select()
        .single();

      if (error) throw error;

      if (values.store_name) {
        await ensureStoreForOrg(orgId, values.store_name);
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ORG_PROFILE_QUERY_KEY] }),
  });
}
