import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { parsePrescriptionRecordContent } from "@/lib/clinic/medication-catalog";
import {
  getPrescriptionExpiresAt,
  isPrescriptionExpired,
} from "@/lib/clinic/prescription-expiration";
import type { Medication } from "@/types";

export const dynamic = "force-dynamic";

type UnifiedPrescription = {
  id: string;
  source: "standalone" | "consultation";
  doctorName: string;
  issuedAt: string;
  expiresAt: string;
  isExpired: boolean;
  medicationsSummary: string;
};

function summarizeMedications(
  medications: Array<{ name?: string | null }>,
): string {
  const names = medications.map((m) => m.name).filter((n): n is string => Boolean(n));
  return names.length ? names.join(", ") : "Sin medicamentos";
}

/**
 * "Mis recetas" (patient portal) — unifies two independent sources:
 *
 * 1. Standalone recetas (`prescriptions`, Fases 1-5 of "Recetas"): only rows
 *    the patient actually received count — `payment_status` confirmed/waived
 *    AND `sent_at` not null (a draft or unpaid-and-unsent receta must never
 *    show up here). `issuedAt` is `sent_at`, matching the date already
 *    printed on the regenerated PDF (see `[accessToken]/pdf/route.ts`).
 *
 * 2. Live-consultation recetas (`clinical_records`, record_type "receta",
 *    pre-existing feature): `issuedAt` is `created_at` since these are
 *    handed to the patient directly during the consultation, no separate
 *    "send" step.
 *
 * DEDUPLICATION GOTCHA: `POST /api/clinic/prescriptions` (shared by both the
 * standalone form and the live-consultation form) mirrors *every*
 * registered-patient receta into `clinical_records` as a `record_type:
 * "receta"` row at draft-creation time — see that route's `if (patientId)`
 * block. That mirror always has `appointment_id: null` (the standalone UI,
 * `receta-form.tsx`, never sends an appointmentId), while genuine
 * live-consultation recetas (`prescription-form.tsx`) always carry a
 * non-null `appointmentId`. Filtering `clinical_records` to
 * `appointment_id IS NOT NULL` is what keeps a paid standalone receta from
 * appearing twice here with two different expiration dates (once correctly
 * via `sent_at`, once incorrectly via the mirror's draft-time `created_at`).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!patientRow?.id) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }
  const patientId = patientRow.id;

  const [standaloneResult, consultationResult] = await Promise.all([
    supabase
      .from("prescriptions")
      .select("id, medications, sent_at, professionals(full_name)")
      .eq("patient_id", patientId)
      .in("payment_status", ["confirmed", "waived"])
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false }),
    supabase
      .from("clinical_records")
      .select("id, content, created_at, professionals(full_name)")
      .eq("patient_id", patientId)
      .eq("record_type", "receta")
      .not("appointment_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (standaloneResult.error || consultationResult.error) {
    return NextResponse.json(
      {
        error:
          standaloneResult.error?.message ??
          consultationResult.error?.message ??
          "Error al cargar recetas",
      },
      { status: 500 },
    );
  }

  const items: UnifiedPrescription[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (standaloneResult.data ?? []) as any[]) {
    const issuedAt = row.sent_at as string;
    const medications = (
      Array.isArray(row.medications) ? row.medications : []
    ) as Medication[];
    items.push({
      id: row.id,
      source: "standalone",
      doctorName: row.professionals?.full_name ?? "Médico",
      issuedAt,
      expiresAt: getPrescriptionExpiresAt(issuedAt).toISOString(),
      isExpired: isPrescriptionExpired(issuedAt),
      medicationsSummary: summarizeMedications(medications),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (consultationResult.data ?? []) as any[]) {
    const issuedAt = row.created_at as string;
    const medications = parsePrescriptionRecordContent(row.content ?? "");
    items.push({
      id: row.id,
      source: "consultation",
      doctorName: row.professionals?.full_name ?? "Médico",
      issuedAt,
      expiresAt: getPrescriptionExpiresAt(issuedAt).toISOString(),
      isExpired: isPrescriptionExpired(issuedAt),
      medicationsSummary: summarizeMedications(medications),
    });
  }

  items.sort(
    (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
  );

  return NextResponse.json(items);
}
