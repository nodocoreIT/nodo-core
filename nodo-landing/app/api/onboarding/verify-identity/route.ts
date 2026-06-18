import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getIdentityVerificationProvider,
  isIdentityVerificationEnabled,
  requiresIdentityVerification,
} from "@/lib/identity-verification";

async function validateToken(token: string) {
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("activation_tokens")
    .select("client_unit_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) return { ok: false as const, error: "Enlace inválido." };
  if (tokenRow.used_at) return { ok: false as const, error: "Este enlace ya fue utilizado." };
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false as const, error: "El enlace expiró." };
  }

  const { data: unitRow } = await admin
    .from("client_units")
    .select("id, unit_code, plan, status")
    .eq("id", tokenRow.client_unit_id)
    .single();

  if (!unitRow || unitRow.status !== "pending_onboarding") {
    return { ok: false as const, error: "La solicitud no está disponible." };
  }

  return {
    ok: true as const,
    clientUnitId: unitRow.id,
    unitCode: unitRow.unit_code,
    plan: unitRow.plan,
  };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();
  const holdingPhoto = formData.get("holdingIdPhoto") as File | null;

  if (!token) {
    return NextResponse.json({ error: "Token faltante." }, { status: 400 });
  }

  if (!holdingPhoto || holdingPhoto.size === 0) {
    return NextResponse.json(
      { error: "Subí una foto sosteniendo tu DNI junto a tu rostro." },
      { status: 400 },
    );
  }

  const tokenCheck = await validateToken(token);
  if (!tokenCheck.ok) {
    return NextResponse.json({ error: tokenCheck.error }, { status: 400 });
  }

  if (!requiresIdentityVerification(tokenCheck.unitCode, tokenCheck.plan)) {
    return NextResponse.json({ error: "Este registro no requiere verificación de identidad." }, { status: 400 });
  }

  if (!isIdentityVerificationEnabled()) {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      message: "Verificación de identidad deshabilitada.",
    });
  }

  const photoBuffer = Buffer.from(await holdingPhoto.arrayBuffer());
  const provider = getIdentityVerificationProvider();
  const result = await provider.verify({
    firstName,
    lastName,
    holdingIdPhoto: photoBuffer,
    photoMimeType: holdingPhoto.type || "image/jpeg",
    documentNumber: documentNumber || undefined,
    vendorData: tokenCheck.clientUnitId,
  });

  const admin = createAdminClient();
  await admin.from("identity_verification_checks").insert({
    client_unit_id: tokenCheck.clientUnitId,
    provider: result.provider,
    status: result.status,
    outcome_code: result.outcomeCode,
    request_id: result.requestId ?? null,
    face_match_score: result.faceMatchScore ?? null,
    message: result.message,
    raw_response: result.raw ?? null,
  });

  const canProceed = result.status === "approved" || result.status === "review";

  return NextResponse.json(
    {
      ok: canProceed,
      status: result.status,
      outcomeCode: result.outcomeCode,
      faceMatchScore: result.faceMatchScore,
      message: result.message,
      provider: result.provider,
    },
    { status: canProceed ? 200 : 422 },
  );
}
