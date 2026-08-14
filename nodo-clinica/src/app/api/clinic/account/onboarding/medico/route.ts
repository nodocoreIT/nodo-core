import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createNodoCoreServiceClient } from "@/lib/supabase/server";
import { normalizeArMobilePhone } from "@/lib/clinic/phone-utils";
import { CLINIC_ORG_ID, syncClinicaAuthClaims } from "@/lib/clinic/clinic-org";
import { upsertProfessionalOnboardingRecord } from "@/lib/clinic/db/professionals";
import { findSubscriptionPlan } from "@/lib/clinic/subscription-plans";
import { createNodoSubscriptionPreapproval } from "@/lib/mercadopago/nodo-subscription";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { TERMS_VERSION } from "@/lib/clinic/terms-content";
import { notifyOnboardingCompleted } from "@/lib/clinic/onboarding-notify";
import { uploadDniDocs } from "@/lib/clinic/dni-upload";

/** Must match nodo_core.client_units/planes.unit_code exactly (case/accent-sensitive). */
const UNIT_CODE = "Clínica";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const fullName = formData.get("fullName") as string | null;
    const specialty = formData.get("specialty") as string | null;
    const licenseNumber = formData.get("licenseNumber") as string | null;
    const dni = formData.get("dni") as string | null;
    const plan = formData.get("plan") as string | null;
    const billingCycle = formData.get("billingCycle") as string | null;
    const token = formData.get("token") as string | null;
    const phone = formData.get("phone") as string | null;
    const dniFront = formData.get("dniFront") as File | null;
    const dniBack = formData.get("dniBack") as File | null;

    if (!token) {
      return NextResponse.json(
        { error: "Token de onboarding requerido." },
        { status: 400 },
      );
    }

    if (!fullName || !specialty || !plan || !dni?.trim()) {
      return NextResponse.json(
        { error: "Se requieren fullName, specialty, dni y plan." },
        { status: 400 },
      );
    }

    if (!dniFront || dniFront.size === 0 || !dniBack || dniBack.size === 0) {
      return NextResponse.json(
        { error: "Subí las fotos del DNI (frente y dorso) para continuar." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    // Look up pending registration by onboarding_token
    const { data: pending, error: tokenError } = await serviceClient
      .from("pending_clinic_registrations")
      .select("id, email, verified_at")
      .eq("onboarding_token", token)
      .eq("role", "medico")
      .maybeSingle();

    if (tokenError || !pending) {
      return NextResponse.json(
        { error: "Token inválido o expirado." },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizeArMobilePhone((phone ?? "").trim());
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Ingresá un número de celular con formato válido." },
        { status: 400 },
      );
    }

    const email = pending.email as string;

    // Find auth user by email (admin-only, one-time onboarding operation)
    const { data: listData, error: listError } =
      await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
      console.error("[onboarding/medico] listUsers error", listError);
      return NextResponse.json(
        { error: "Error al obtener usuario." },
        { status: 500 },
      );
    }

    const authUser = listData.users.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!authUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado. Reintentá el registro." },
        { status: 404 },
      );
    }

    const userId = authUser.id;

    const nodoCoreClient = await createNodoCoreServiceClient();
    const { data: termsAcceptance, error: termsError } = await nodoCoreClient
      .from("terms_acceptances")
      .select("id")
      .eq("unit_code", UNIT_CODE)
      .eq("user_id", userId)
      .eq("terms_version", TERMS_VERSION)
      .maybeSingle();

    if (termsError || !termsAcceptance) {
      return NextResponse.json(
        { error: "Debés aceptar los términos y condiciones antes de continuar." },
        { status: 400 },
      );
    }

    // Upload DNI files before inserting the professional row
    const uploadResult = await uploadDniDocs(serviceClient, userId, dniFront, dniBack);
    if (!uploadResult.ok) {
      console.error(`[onboarding/medico] DNI ${uploadResult.side} upload error`, uploadResult.cause);
      return NextResponse.json({ error: uploadResult.error }, { status: 500 });
    }

    // Split fullName into first/last for the DB columns
    const profResult = await upsertProfessionalOnboardingRecord(serviceClient, {
      userId,
      orgId: CLINIC_ORG_ID,
      fullName,
      email,
      specialty,
      licenseNumber,
      dni: dni.trim(),
      plan,
      phone: normalizedPhone,
      phoneVerifiedAt: null,
      dniFrontPath: uploadResult.dniFrontPath,
      dniBackPath: uploadResult.dniBackPath,
    });

    if (!profResult.ok) {
      console.error("[onboarding/medico] professionals upsert error", profResult);
      return NextResponse.json(
        { error: "Error al crear perfil profesional." },
        { status: 500 },
      );
    }

    await syncClinicaAuthClaims(serviceClient, userId, "medico");

    // Fired once here (account created) rather than after the paid/free
    // branch below — the notification is about account creation, not payment.
    await notifyOnboardingCompleted({ type: "medico", nombre: fullName, email });

    // Paid plans go straight to MercadoPago checkout instead of being left
    // silently in "pending_payment" until someone activates them by hand.
    const paidPlan = findSubscriptionPlan(plan);
    if (paidPlan) {
      const result = await createNodoSubscriptionPreapproval({
        plan: paidPlan,
        payerEmail: email,
        externalReference: profResult.id,
        backUrl: `${appBaseUrl()}/login`,
        billingCycle: billingCycle === "annual" ? "annual" : "monthly",
      });

      if (!result.ok) {
        console.error("[onboarding/medico] checkout creation error", result.error);
        return NextResponse.json({ ok: true, checkoutFailed: true });
      }

      const { error: updateError } = await serviceClient
        .from("professionals")
        .update({ mercadopago_preapproval_id: result.preapprovalId })
        .eq("id", profResult.id);

      if (updateError) {
        console.error(
          "[onboarding/medico] failed to persist preapproval id",
          updateError,
        );
        return NextResponse.json({ ok: true, checkoutFailed: true });
      }

      return NextResponse.json({ ok: true, checkoutUrl: result.initPoint });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding/medico]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error en onboarding. Reintentá.",
      },
      { status: 500 },
    );
  }
}
