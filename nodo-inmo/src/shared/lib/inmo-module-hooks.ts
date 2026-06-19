import { createTasksHooks } from "@nodocore/nodo-modules/agenda";
import { supabase } from "@/shared/lib/supabase";

export function createInmoTasksHooks(getOrgId: () => string | null | undefined) {
  return createTasksHooks({
    queryKey: ["nodo_inmo", "tasks"],
    table: "tasks",
    tenantColumn: "org_id",
    getTenantId: getOrgId,
    supabase,
    schema: "nodo_inmo",
  });
}
