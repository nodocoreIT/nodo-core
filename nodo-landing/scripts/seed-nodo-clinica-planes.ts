/**
 * Reemplaza el catálogo de planes de la unidad "Nodo Clínica" en el panel de
 * Unidades por la nueva segmentación por audiencia (paciente / institución /
 * profesional). Desactiva los planes existentes (Starter/Pro) y los grupos de
 * funcionalidades asociados, y crea los 4 planes nuevos con sus features.
 *
 * Uso:
 *   cd nodo-landing
 *   npx tsx --env-file=.env.local scripts/seed-nodo-clinica-planes.ts
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: "nodo_core" },
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const UNIT_CODE = "Clínica";

type PlanSeed = {
  code: string;
  label: string;
  price_monthly: number;
  currency: string;
  sort_order: number;
};

const PLANS: PlanSeed[] = [
  { code: "paciente_libre_clinica", label: "Paciente Libre", price_monthly: 0, currency: "USD", sort_order: 1 },
  { code: "nodo_salud_clinica", label: "Nodo Salud", price_monthly: 4.99, currency: "USD", sort_order: 2 },
  { code: "turnero_institucional_clinica", label: "Turnero Institucional", price_monthly: 49, currency: "USD", sort_order: 3 },
  { code: "medico_pro_clinica", label: "Médico Pro", price_monthly: 100, currency: "USD", sort_order: 4 },
];

function annualTotalFromMonthly(monthly: number): number {
  return Math.round(monthly * 10 * 100) / 100;
}

type GroupSeed = {
  label: string;
  sort_order: number;
  features: { label: string; plans: string[] }[];
};

const GROUPS: GroupSeed[] = [
  {
    label: "Pacientes",
    sort_order: 1,
    features: [
      { label: "Búsqueda de especialistas y reserva de turnos", plans: ["paciente_libre_clinica", "nodo_salud_clinica"] },
      { label: "Pasarela de pagos integrada", plans: ["paciente_libre_clinica", "nodo_salud_clinica"] },
      { label: "Acceso a sala de telemedicina", plans: ["paciente_libre_clinica", "nodo_salud_clinica"] },
      { label: "Descarga de receta / indicación médica", plans: ["paciente_libre_clinica", "nodo_salud_clinica"] },
      { label: "Repositorio médico ilimitado", plans: ["nodo_salud_clinica"] },
      { label: "Historial y hoja de ruta unificada", plans: ["nodo_salud_clinica"] },
      { label: "Evolución y seguimiento", plans: ["nodo_salud_clinica"] },
      { label: "Recordatorios inteligentes", plans: ["nodo_salud_clinica"] },
    ],
  },
  {
    label: "Instituciones",
    sort_order: 2,
    features: [
      { label: "Sistema de gestión de turnos multiagenda", plans: ["turnero_institucional_clinica"] },
      { label: "Portal de pacientes personalizado", plans: ["turnero_institucional_clinica"] },
      { label: "Gestión de recepción y salas de espera", plans: ["turnero_institucional_clinica"] },
      { label: "Recordatorios automáticos (WhatsApp / Email)", plans: ["turnero_institucional_clinica"] },
    ],
  },
  {
    label: "Profesionales",
    sort_order: 3,
    features: [
      { label: "Agenda y consultorio propio", plans: ["medico_pro_clinica"] },
      { label: "Plataforma de telemedicina ilimitada", plans: ["medico_pro_clinica"] },
      { label: "Asistente clínico de IA avanzado", plans: ["medico_pro_clinica"] },
      { label: "Acceso al historial del paciente", plans: ["medico_pro_clinica"] },
    ],
  },
];

async function main() {
  console.log(`Desactivando planes existentes de "${UNIT_CODE}"...`);
  const { error: deactivateError } = await supabase
    .from("planes")
    .update({ is_active: false })
    .eq("unit_code", UNIT_CODE);
  if (deactivateError) throw deactivateError;

  console.log("Limpiando grupos de funcionalidades existentes...");
  const { data: oldGroups, error: oldGroupsError } = await supabase
    .from("plan_feature_groups")
    .select("id")
    .eq("unit_code", UNIT_CODE);
  if (oldGroupsError) throw oldGroupsError;

  for (const group of oldGroups ?? []) {
    const { data: oldFeatures } = await supabase
      .from("plan_features")
      .select("id")
      .eq("group_id", group.id);
    for (const feature of oldFeatures ?? []) {
      await supabase.from("plan_feature_inclusions").delete().eq("feature_id", feature.id);
    }
    await supabase.from("plan_features").delete().eq("group_id", group.id);
  }
  await supabase.from("plan_feature_groups").delete().eq("unit_code", UNIT_CODE);

  console.log("Creando planes nuevos...");
  const planIds: Record<string, string> = {};
  for (const plan of PLANS) {
    const { data, error } = await supabase
      .from("planes")
      .insert({
        unit_code: UNIT_CODE,
        code: plan.code,
        label: plan.label,
        price_monthly: plan.price_monthly,
        price_annual_monthly: annualTotalFromMonthly(plan.price_monthly),
        currency: plan.currency,
        sort_order: plan.sort_order,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    planIds[plan.code] = data.id;
    console.log(`  - ${plan.label} (${plan.code}) → ${data.id}`);
  }

  console.log("Creando grupos y funcionalidades...");
  for (const group of GROUPS) {
    const { data: groupData, error: groupError } = await supabase
      .from("plan_feature_groups")
      .insert({ unit_code: UNIT_CODE, label: group.label, sort_order: group.sort_order })
      .select("id")
      .single();
    if (groupError) throw groupError;

    let featureOrder = 1;
    for (const feature of group.features) {
      const { data: featureData, error: featureError } = await supabase
        .from("plan_features")
        .insert({ group_id: groupData.id, label: feature.label, sort_order: featureOrder++ })
        .select("id")
        .single();
      if (featureError) throw featureError;

      const inclusionRows = feature.plans
        .map((code) => planIds[code])
        .filter(Boolean)
        .map((planId) => ({ feature_id: featureData.id, plan_id: planId }));

      if (inclusionRows.length > 0) {
        const { error: inclusionError } = await supabase
          .from("plan_feature_inclusions")
          .insert(inclusionRows);
        if (inclusionError) throw inclusionError;
      }
    }
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
