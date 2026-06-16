import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContactRow = Database["nodo_inmo"]["Tables"]["contacts"]["Row"];

export const MY_CONTACT_QUERY_KEY = ["nodo_inmo", "my-contact"] as const;

/**
 * Fetch the authenticated tenant's contact row by matching portal_user_id
 * to the currently logged-in Supabase auth user's uid.
 * RLS scopes the result to a single org; we additionally filter by uid.
 */
export function useMyContact() {
  return useQuery<ContactRow | null>({
    queryKey: MY_CONTACT_QUERY_KEY,
    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return null;

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contacts")
        .select("*")
        .eq("portal_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
