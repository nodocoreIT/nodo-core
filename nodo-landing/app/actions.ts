"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_COOKIE_MAX_AGE,
  RECOVERY_PROJECT_COOKIE,
  RECOVERY_RETURN_COOKIE,
} from "@/lib/auth/recovery-cookies";
import {
  sendContactEmail,
  sendRegistrationVerificationEmail,
  sendPatientVerificationEmail,
  sendInmoVerificationEmail,
  isMailConfigured,
} from "@/lib/mail";
import { submitNodeRegistration } from "@/app/actions/registration";
import { sendRecoveryEmail } from "@/lib/auth/send-recovery-email";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const nombre = (formData.get("nombre") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const mensaje = (formData.get("mensaje") as string)?.trim();

  if (!nombre || !email || !mensaje) {
    return { status: "error", message: "Por favor complete todos los campos." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: "error", message: "El correo electrónico no es válido." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("contact_leads").insert({
      name: nombre,
      email,
      message: mensaje,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return {
        status: "error",
        message: "Hubo un problema al enviar. Por favor intente nuevamente.",
      };
    }

    // Notify by email (best-effort): the lead is already saved, so a mail
    // hiccup shouldn't fail the user's submission.
    if (isMailConfigured()) {
      try {
        await sendContactEmail({ nombre, email, mensaje });
      } catch (mailErr) {
        console.error("Contact email error:", mailErr);
      }
    } else {
      console.warn(
        "Contact email skipped: SMTP env vars not configured (ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD).",
      );
    }

    return { status: "success", message: "" };
  } catch (err) {
    console.error("Contact form error:", err);
    return {
      status: "error",
      message: "Hubo un problema al enviar. Por favor intente nuevamente.",
    };
  }
}

export type DoctorRegState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function submitDoctorRegistration(
  fullName: string,
  email: string,
  plan: string,
  origin: string,
): Promise<DoctorRegState> {
  const result = await submitNodeRegistration({
    unitCode: "Salud",
    fullName,
    email,
    plan,
    origin,
  });
  return { status: result.status === "idle" ? "error" : result.status, message: result.message };
}

export async function submitPatientRegistration(
  fullName: string,
  email: string,
  password: string,
  origin: string,
): Promise<DoctorRegState> {
  const result = await submitNodeRegistration({
    unitCode: "Salud",
    fullName,
    email,
    plan: "paciente",
    origin,
    password,
  });
  return { status: result.status === "idle" ? "error" : result.status, message: result.message };
}

export async function requestPasswordReset(
  email: string,
  nodeSlug: string,
  origin: string,
  loginPathOverride?: string,
): Promise<{ status: "success" | "error"; message: string }> {
  const result = await sendRecoveryEmail({
    email,
    nodeSlug,
    origin,
    loginPathOverride,
  });

  // Set fallback cookies so RecoveryHashRedirect can recover if Supabase
  // ignores the redirect_to and sends the user to the Site URL root.
  if (result.status === "success" && result.loginReturn) {
    try {
      const cookieStore = await cookies();
      cookieStore.set(RECOVERY_RETURN_COOKIE, result.loginReturn, {
        path: "/",
        maxAge: RECOVERY_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
      if (result.project) {
        cookieStore.set(RECOVERY_PROJECT_COOKIE, result.project, {
          path: "/",
          maxAge: RECOVERY_COOKIE_MAX_AGE,
          sameSite: "lax",
        });
      }
    } catch {
      // Cookie setting may fail in non-action contexts — not critical.
    }
  }

  return { status: result.status, message: result.message };
}

export async function submitInmoRegistration(
  fullName: string,
  email: string,
  origin: string,
): Promise<{ status: "success" | "error"; message: string }> {
  const result = await submitNodeRegistration({
    unitCode: "Inmo",
    fullName,
    email,
    plan: "inmo",
    origin,
  });
  return { status: result.status === "idle" ? "error" : result.status, message: result.message };
}
