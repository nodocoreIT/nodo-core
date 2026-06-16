import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export type OwnerContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commission_rate: number | null;
};

export const MY_OWNER_CONTACT_QUERY_KEY = ["nodo_inmo", "my-owner-contact"] as const;

/**
 * Fetch the contact row linked to the currently authenticated portal user.
 * Uses `portal_user_id = auth.uid()` to identify the owner's contact.
 */
export function useMyOwnerContact() {
  return useQuery<OwnerContact | null>({
    queryKey: MY_OWNER_CONTACT_QUERY_KEY,
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) return null;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .select("id, name, email, phone, commission_rate")
        .eq("portal_user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as OwnerContact | null;
    },
  });
}
