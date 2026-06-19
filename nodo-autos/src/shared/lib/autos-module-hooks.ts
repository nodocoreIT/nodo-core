import { createTasksHooks } from "@nodocore/nodo-modules/agenda";
import { createCajaHooks } from "@nodocore/nodo-modules/caja";
import { supabase } from "@/shared/lib/supabase";
import { useVehicleStore } from "@/store/vehicle-store";

function getClienteId() {
  return useVehicleStore.getState().currentCliente?.id;
}

export const autosTasksHooks = createTasksHooks({
  queryKey: ["nodo-autos", "tasks"],
  table: "tasks",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
});

export const autosCajaHooks = createCajaHooks({
  queryKey: ["nodo-autos", "cash-movements"],
  table: "cash_movements",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
});
