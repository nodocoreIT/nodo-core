import { createTasksHooks } from "@nodocore/nodo-modules/agenda";
import {
  createCajaHooks,
  createConceptosHooks,
  createCashAccountsHooks,
} from "@nodocore/nodo-modules/caja";
import {
  createTenantProfileHooks,
  createLogoHooks,
} from "@nodocore/nodo-modules/settings";
import { supabase, AUTOS_SCHEMA } from "@/shared/lib/supabase";
import { useVehicleStore } from "@/store/vehicle-store";

function getClienteId() {
  return useVehicleStore.getState().currentCliente?.id;
}

export const autosTenantProfileHooks = createTenantProfileHooks({
  queryKey: ["nodo-autos", "clientes-profile"],
  table: "clientes",
  tenantColumn: "id",
  getTenantId: getClienteId,
  supabase,
  schema: AUTOS_SCHEMA,
  mapRow: (row) => ({
    legal_name: (row.legal_name as string | null) ?? (row.nombre as string | null),
    address: (row.direccion as string | null) ?? null,
    cuit: (row.cuit as string | null) ?? null,
    phone: (row.telefono as string | null) ?? null,
    email: (row.email_contacto as string | null) ?? null,
    logo_path: (row.logo_path as string | null) ?? null,
    pdf_logo_path: (row.pdf_logo_path as string | null) ?? null,
    theme_settings: row.theme_settings,
    alert_settings: row.alert_settings,
    ai_settings: row.ai_settings,
  }),
  mapUpdate: (input) => {
    const out: Record<string, unknown> = {};
    if (input.legal_name !== undefined) out.legal_name = input.legal_name;
    if (input.address !== undefined) out.direccion = input.address;
    if (input.phone !== undefined) out.telefono = input.phone;
    if (input.email !== undefined) out.email_contacto = input.email;
    if (input.cuit !== undefined) out.cuit = input.cuit;
    if (input.logo_path !== undefined) out.logo_path = input.logo_path;
    if (input.pdf_logo_path !== undefined) out.pdf_logo_path = input.pdf_logo_path;
    if (input.theme_settings !== undefined) out.theme_settings = input.theme_settings;
    if (input.alert_settings !== undefined) out.alert_settings = input.alert_settings;
    if (input.ai_settings !== undefined) out.ai_settings = input.ai_settings;
    return out;
  },
});

export const autosLogoHooks = createLogoHooks({
  bucket: "cliente-branding",
  getFolderId: getClienteId,
  supabase,
});

export const autosTasksHooks = createTasksHooks({
  queryKey: ["nodo-autos", "tasks"],
  table: "tasks",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
  schema: AUTOS_SCHEMA,
});

export const autosCajaHooks = createCajaHooks({
  queryKey: ["nodo-autos", "cash-movements"],
  table: "cash_movements",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
  schema: AUTOS_SCHEMA,
});

export const autosConceptosHooks = createConceptosHooks({
  queryKey: ["nodo-autos", "conceptos"],
  table: "conceptos",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
  schema: AUTOS_SCHEMA,
});

export const autosCashAccountsHooks = createCashAccountsHooks({
  queryKey: ["nodo-autos", "cash-accounts"],
  table: "cash_accounts",
  tenantColumn: "cliente_id",
  getTenantId: getClienteId,
  supabase,
  schema: AUTOS_SCHEMA,
});
