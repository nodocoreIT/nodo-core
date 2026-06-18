"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendContactEmail,
  sendRegistrationVerificationEmail,
  sendPatientVerificationEmail,
  sendPasswordResetEmail,
  sendInmoVerificationEmail,
  isMailConfigured,
} from "@/lib/mail";
import { submitNodeRegistration } from "@/app/actions/registration";
import { getNodeLoginPath, getNodeMailLabel } from "@/lib/nodes";
import { resolveRegistrationOrigin } from "@/lib/registration/origin";

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
  if (!email) {
    return { status: "error", message: "El correo electrónico es obligatorio." };
  }

  try {
    const admin = createAdminClient();
    const nodeLabel = getNodeMailLabel(nodeSlug);
    const loginPath = loginPathOverride?.trim() || getNodeLoginPath(nodeSlug);
    const baseOrigin = resolveRegistrationOrigin(origin);

    // Supabase PKCE recovery lands on /auth/confirm with token_hash, then we redirect to node login.
    const loginReturn = `${loginPath}?mode=reset-password`;
    const redirectToUrl = `${baseOrigin}/auth/confirm?next=${encodeURIComponent(loginReturn)}`;
    let { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim(),
      options: {
        redirectTo: redirectToUrl,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("Auth user not found or failed generating link. Checking clients database table...");
      // Check if user exists in our DB clients table
      const { data: existingClient } = await admin
        .from("clients")
        .select("id, name")
        .eq("email", email.trim())
        .maybeSingle();

      if (existingClient) {
        // Create their Auth user account on the fly
        const { error: createErr } = await admin.auth.admin.createUser({
          email: email.trim(),
          password: Math.random().toString(36).substring(2, 10), // random temp password
          email_confirm: true,
          user_metadata: {
            full_name: existingClient.name,
          },
        });

        if (!createErr) {
          // Retry generating the link
          const retry = await admin.auth.admin.generateLink({
            type: "recovery",
            email: email.trim(),
            options: {
              redirectTo: redirectToUrl,
            },
          });
          data = retry.data;
          error = retry.error;
        } else {
          console.error("Failed to auto-provision auth user:", createErr);
        }
      }
    }

    if (error || !data?.properties?.action_link) {
      console.error("Generate recovery link error:", error);
      return {
        status: "error",
        message: "No se pudo generar el enlace de recuperación. Verifique si el correo existe.",
      };
    }

    // 2. Send it using Zoho SMTP
    if (isMailConfigured()) {
      await sendPasswordResetEmail({
        email: email.trim(),
        recoveryUrl: data.properties.action_link,
        nodeLabel,
      });
    } else {
      console.warn(
        "Mail not configured. Recovery action link would be: ",
        data.properties.action_link,
      );
    }

    return {
      status: "success",
      message: "Te enviamos un correo con las instrucciones para restablecer tu contraseña. Revisá tu casilla.",
    };
  } catch (err) {
    console.error("Request password reset error:", err);
    return {
      status: "error",
      message: "Hubo un problema al procesar la solicitud. Intente nuevamente.",
    };
  }
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
