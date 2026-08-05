import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { listFromClinicaProfiles } from "@/lib/panel/nodo-users-list";

// Feeds the "Clientes" panel table with médicos/pacientes de Nodo Clínica.
// nodo_clinica.professionals/patients live outside clients/client_units, so
// this mirrors what /api/admin/nodo-users already does for Usuarios de Nodo:
// read them server-side with the service role client and hand the caller
// plain rows to merge client-side. No existingKeys filtering here — the
// Clientes page wants every médico/paciente, not just the ones missing from
// client_units.
export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const rows = await listFromClinicaProfiles(new Set());
    return Response.json({ rows });
  } catch (err) {
    console.error("[admin/clients-clinica-rows] GET", err);
    return Response.json({ error: "Error al cargar usuarios de Clínica." }, { status: 500 });
  }
}
