"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNodeRegistrationConfig,
  isSelfServicePlan,
  normalizeUnitCode,
} from "@/lib/registration/node-config";
import type { NodeRegistrationInput, RegistrationActionState } from "@/lib/registration/types";
import {
  isMailConfigured,
  sendRegistrationVerificationEmail,
  sendPatientVerificationEmail,
  sendInmoVerificationEmail,
  sendFinanzasVerificationEmail,
  sendEcommerceVerificationEmail,
  sendAdminNewRegistrationEmail,
} from "@/lib/mail";
import { resolveRegistrationOrigin } from "@/lib/registration/origin";
import {
  duplicateRegistrationMessage,
  isEmailRegisteredForNode,
} from "@/lib/registration/duplicate-check";

const VERIFICATION_TTL_HOURS = 24;

async function sendVerificationEmail(
  unitCode: string,
  plan: string,
  payload: { nombre: string; email: string; token: string; origin: string },
): Promise<void> {
  const planLower = plan.toLowerCase();
  if (planLower === "paciente") {
    await sendPatientVerificationEmail(payload);
    return;
  }
  if (planLower === "inmo" || unitCode === "Inmo") {
    await sendInmoVerificationEmail(payload);
    return;
  }
  if (planLower === "finanzas" || unitCode === "Finanzas") {
    await sendFinanzasVerificationEmail(payload);
    return;
  }
  if (planLower === "ecommerce" || unitCode === "Ecommerce") {
    await sendEcommerceVerificationEmail(payload);
    return;
  }
  await sendRegistrationVerificationEmail({
    ...payload,
    plan,
  });
}

/**
 * Unified registration entry point for all ecosystem nodes.
 * Same email can register on different nodes; duplicate blocked per (email, unit_code).
 */
export async function submitNodeRegistration(
  input: NodeRegistrationInput,
): Promise<RegistrationActionState> {
  const unitCode = normalizeUnitCode(input.unitCode);
  if (!unitCode) {
    return { status: "error", message: "Nodo no válido." };
  }

  const cfg = getNodeRegistrationConfig(unitCode);
  if (!cfg) {
    return { status: "error", message: "Nodo no configurado." };
  }

  const fullName = input.fullName?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const plan = input.plan?.trim();
  const origin = input.origin;

  if (!fullName || !email || !plan) {
    return { status: "error", message: "Todos los campos obligatorios deben completarse." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: "error", message: "El correo electrónico no es válido." };
  }

  const selfService = isSelfServicePlan(unitCode, plan);
  if (selfService && !input.password) {
    return { status: "error", message: "La contraseña es obligatoria." };
  }

  try {
    const admin = createAdminClient();

    const alreadyRegistered = await isEmailRegisteredForNode(admin, email, unitCode);
    if (alreadyRegistered) {
      return {
        status: "error",
        message: duplicateRegistrationMessage(cfg.label),
      };
    }

    // Remove stale pending for same email+node (only when no active registration exists)
    await admin
      .from("pending_registrations")
      .delete()
      .eq("email", email)
      .eq("unit_code", unitCode);

    const { data: pending, error: insertErr } = await admin
      .from("pending_registrations")
      .insert({
        full_name: fullName,
        email,
        phone,
        plan,
        unit_code: unitCode,
        password: input.password ?? null,
        expires_at: new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
      })
      .select("verification_token")
      .single();

    if (insertErr || !pending) {
      console.error("pending_registrations insert:", insertErr);
      const detail = insertErr?.message?.trim();
      return {
        status: "error",
        message: detail
          ? `Error al registrar la solicitud: ${detail}`
          : "Error al registrar la solicitud.",
      };
    }

    const emailOrigin = resolveRegistrationOrigin(origin);
    let mailSent = false;

    if (isMailConfigured()) {
      try {
        await sendVerificationEmail(unitCode, plan, {
          nombre: fullName,
          email,
          token: pending.verification_token,
          origin: emailOrigin,
        });
        mailSent = true;
      } catch (mailErr) {
        console.error("submitNodeRegistration mail:", mailErr);
      }
    } else {
      console.warn("Mail not configured. Token:", pending.verification_token);
    }

    return {
      status: "success",
      message: mailSent
        ? "Te enviamos un correo de verificación. Revisá tu casilla para continuar con el registro."
        : "Registro guardado. Si no recibís el correo de verificación en unos minutos, usá «Reenviar correo» o contactá soporte.",
    };
  } catch (err) {
    console.error("submitNodeRegistration:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      message:
        process.env.NODE_ENV === "development"
          ? `Hubo un problema al procesar el registro: ${detail}`
          : "Hubo un problema al procesar el registro. Intente nuevamente.",
    };
  }
}

/** Resend verification email for a pending (unverified) registration. */
export async function resendVerificationEmail(params: {
  email: string;
  unitCode: string;
  origin?: string;
}): Promise<RegistrationActionState> {
  const unitCode = normalizeUnitCode(params.unitCode);
  if (!unitCode) {
    return { status: "error", message: "Nodo no válido." };
  }

  const cfg = getNodeRegistrationConfig(unitCode);
  if (!cfg) {
    return { status: "error", message: "Nodo no configurado." };
  }

  const email = params.email.trim().toLowerCase();
  if (!email) {
    return { status: "error", message: "Ingresá tu correo electrónico." };
  }

  try {
    const admin = createAdminClient();

    if (await isEmailRegisteredForNode(admin, email, unitCode)) {
      return {
        status: "error",
        message: duplicateRegistrationMessage(cfg.label),
      };
    }

    const { data: pending } = await admin
      .from("pending_registrations")
      .select("*")
      .eq("email", email)
      .eq("unit_code", unitCode)
      .maybeSingle();

    if (!pending) {
      return {
        status: "error",
        message: "No hay un registro pendiente. Volvé a completar el formulario de registro.",
      };
    }

    if (pending.verified_at) {
      return {
        status: "success",
        message: "Tu correo ya fue verificado. Revisá tu casilla por el email de activación o iniciá sesión.",
      };
    }

    const expired = pending.expires_at && new Date(pending.expires_at) < new Date();
    let token = pending.verification_token as string;

    if (expired) {
      token = crypto.randomUUID();
      const { error: updateErr } = await admin
        .from("pending_registrations")
        .update({
          verification_token: token,
          expires_at: new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", pending.id);

      if (updateErr) {
        return { status: "error", message: "No se pudo renovar el enlace de verificación." };
      }
    }

    if (!isMailConfigured()) {
      console.warn("Mail not configured. Token:", token);
      return { status: "error", message: "El envío de correos no está configurado." };
    }

    const emailOrigin = resolveRegistrationOrigin(params.origin);
    await sendVerificationEmail(unitCode, pending.plan, {
      nombre: pending.full_name,
      email,
      token,
      origin: emailOrigin,
    });

    return {
      status: "success",
      message: "Te reenviamos el correo de verificación. Revisá tu casilla (válido por 24 horas).",
    };
  } catch (err) {
    console.error("resendVerificationEmail:", err);
    return { status: "error", message: "No se pudo reenviar el correo. Intentá de nuevo." };
  }
}

/** Notify Core Dashboard admins when a registration awaits review. */
export async function notifyAdminPendingRegistration(params: {
  clientName: string;
  email: string;
  unitCode: string;
  plan: string;
  origin: string;
}): Promise<void> {
  if (!isMailConfigured()) return;
  try {
    await sendAdminNewRegistrationEmail(params);
  } catch (err) {
    console.error("Admin notification email failed:", err);
  }
}
