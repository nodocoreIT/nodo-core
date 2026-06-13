import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const SupabaseContext = createContext<SupabaseClient<any, any> | null>(null);

export function SupabaseProvider({
  client,
  children,
}: {
  client: SupabaseClient<any, any>;
  children: ReactNode;
}) {
  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseClient<any, any> {
  const client = useContext(SupabaseContext);
  if (!client) throw new Error("useSupabase must be used inside <SupabaseProvider>");
  return client;
}
