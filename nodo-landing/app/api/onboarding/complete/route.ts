import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNodeRegistrationConfig,
  requiresIdentityVerification,
} from "@/lib/registration/node-config";
import { notifyAdminPendingRegistration } from "@/app/actions/registration";
import {
  isIdentityVerificationEnabled,
  isValidArgentineDni,
  normalizeDocumentNumber,
} from "@/lib/identity-verification";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const token = String(formData.get("token") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const planChoice = String(formData.get("planChoice") ?? "starter").trim();
  const demoDays = formData.get("demoDays") ? Number(formData.get("demoDays")) : null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const cardHolder = String(formData.get("cardHolder") ?? "").trim();
  const cardLastFour = String(formData.get("cardLastFour") ?? "").trim();
  const cardExpiry = String(formData.get("cardExpiry") ?? "").trim();
  const idPhoto = formData.get("idPhoto") as File | null;
  const holdingIdPhoto = formData.get("holdingIdPhoto") as File | null;
  const cardPhoto = formData.get("cardPhoto") as File | null;
  const documentNumber = normalizeDocumentNumber(String(formData.get("documentNumber") ?? ""));
  const identityVerified = String(formData.get("identityVerified") ?? "") === "true";

  if (!token || !firstName || !lastName || !phone || !email) {
    return NextResponse.json({ error: "Complete todos los campos obligatorios." }, { status: 400 });
  }

  if (!cardHolder || !cardLastFour || !cardExpiry) {
    return NextResponse.json(
      { error: "Complete los datos de la tarjeta para el débito." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("activation_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "Enlace de onboarding inválido." }, { status: 400 });
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ error: "Este enlace ya fue utilizado." }, { status: 400 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "El enlace expiró. Contactá a NODO Core." }, { status: 400 });
  }

  const { data: unitRow } = await admin
    .from("client_units")
    .select("id, unit_code, plan, status, client_id")
    .eq("id", tokenRow.client_unit_id)
    .single();

  if (!unitRow || unitRow.status !== "pending_onboarding") {
    return NextResponse.json({ error: "La solicitud no está disponible." }, { status: 400 });
  }

  const nodeRequiresIdentity = requiresIdentityVerification(unitRow.unit_code, unitRow.plan);

  if (nodeRequiresIdentity) {
    if (!holdingIdPhoto || holdingIdPhoto.size === 0) {
      return NextResponse.json(
        { error: "Subí una foto sosteniendo tu DNI junto a tu rostro." },
        { status: 400 },
      );
    }

    if (documentNumber && !isValidArgentineDni(documentNumber)) {
      return NextResponse.json({ error: "Ingresá un DNI válido (7 u 8 dígitos)." }, { status: 400 });
    }

    if (isIdentityVerificationEnabled()) {
      if (!identityVerified) {
        return NextResponse.json(
          { error: "Completá la verificación de identidad antes de enviar." },
          { status: 400 },
        );
      }

      const { data: latestCheck } = await admin
        .from("identity_verification_checks")
        .select("status, message")
        .eq("client_unit_id", unitRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestCheck || latestCheck.status === "declined" || latestCheck.status === "error") {
        return NextResponse.json(
          {
            error:
              latestCheck?.message ??
              "La verificación de identidad no fue aprobada. Volvé a intentarlo.",
          },
          { status: 422 },
        );
      }
    }
  } else if (!idPhoto || idPhoto.size === 0) {
    return NextResponse.json({ error: "Subí la foto de tu documento de identidad." }, { status: 400 });
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const cfg = getNodeRegistrationConfig(unitRow.unit_code);
  const planLabel =
    planChoice === "demo"
      ? `demo-${demoDays ?? 14}d`
      : planChoice === "pro"
        ? "pro"
        : "starter";

  let identityStatus: "approved" | "declined" | "review" | "error" | "skipped" = "skipped";
  if (nodeRequiresIdentity && isIdentityVerificationEnabled()) {
    const { data: latestCheck } = await admin
      .from("identity_verification_checks")
      .select("status")
      .eq("client_unit_id", unitRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    identityStatus = (latestCheck?.status as typeof identityStatus) ?? "skipped";
  }

  async function uploadDoc(file: File, docType: string, suffix: string) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${unitRow!.id}/${docType}_${suffix}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("registration-docs").upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    await admin.from("registration_verification_docs").insert({
      client_unit_id: unitRow!.id,
      doc_type: docType,
      storage_path: path,
      file_name: file.name,
      status: "pending",
    });
  }

  try {
    if (nodeRequiresIdentity && holdingIdPhoto) {
      await uploadDoc(holdingIdPhoto, "id_holding_selfie", Date.now().toString());
    } else if (idPhoto) {
      await uploadDoc(idPhoto, "id_photo", Date.now().toString());
    }
    if (cardPhoto && cardPhoto.size > 0) {
      await uploadDoc(cardPhoto, "credit_card", Date.now().toString());
    }
  } catch (uploadErr) {
    console.error("doc upload:", uploadErr);
    return NextResponse.json({ error: "Error al subir documentos." }, { status: 500 });
  }

  await admin.from("onboarding_profiles").upsert({
    client_unit_id: unitRow.id,
    first_name: firstName,
    last_name: lastName,
    address,
    city,
    province,
    phone,
    plan_choice: planChoice,
    demo_days: planChoice === "demo" ? demoDays ?? 14 : null,
    username: email,
    document_number: documentNumber || null,
    gender: null,
    card_holder: cardHolder,
    card_last_four: cardLastFour,
    card_expiry: cardExpiry,
    completed_at: new Date().toISOString(),
  });

  await admin
    .from("clients")
    .update({ name: fullName, phone, email })
    .eq("id", unitRow.client_id);

  await admin
    .from("client_units")
    .update({
      status: "pending_review",
      progress: 25,
      plan: planLabel,
      access_user: email,
      access_url: cfg?.accessUrl ?? null,
    })
    .eq("id", unitRow.id);

  await admin
    .from("node_email_access")
    .update({ status: "pending_review" })
    .eq("client_unit_id", unitRow.id);

  await admin
    .from("activation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const origin = request.nextUrl.origin;
  await notifyAdminPendingRegistration({
    clientName: fullName,
    email,
    unitCode: unitRow.unit_code,
    plan: planLabel,
    origin,
  });

  return NextResponse.json({
    ok: true,
    nodeSlug: cfg?.slug,
    identityStatus,
  });
}
