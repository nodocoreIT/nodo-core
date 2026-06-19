import { supabase } from "@/shared/lib/supabase";

/** Returns the logged-in Supabase Auth user id. Throws if there is no session. */
export async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Usuario no autenticado");
  return user.id;
}
