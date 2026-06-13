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
  password: string,
  plan: string,
  origin: string,
): Promise<DoctorRegState> {
  if (!fullName || !email || !password || !plan) {
    return { status: "error", message: "Todos los campos son obligatorios." };
  }

  try {
    const admin = createAdminClient();

    // 1. Check if email is already in clients and has Salud unit
    const { data: existingClient, error: clientErr } = await admin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (clientErr) {
      console.error("Supabase select client error:", clientErr);
      return { status: "error", message: "Error al verificar el correo." };
    }

    if (existingClient) {
      const { data: existingUnit, error: unitErr } = await admin
        .from("client_units")
        .select("id")
        .eq("client_id", existingClient.id)
        .eq("unit_code", "salud")
        .maybeSingle();

      if (unitErr) {
        console.error("Supabase select unit error:", unitErr);
        return {
          status: "error",
          message: "Error al verificar las unidades del cliente.",
        };
      }

      if (existingUnit) {
        return {
          status: "error",
          message:
            "Este correo electrónico ya tiene registrado NODO | Clinica Virtual.",
        };
      }
    }

    // 2. Delete any existing pending registrations for this email
    await admin.from("pending_registrations").delete().eq("email", email);

    // 3. Insert into pending_registrations
    const { data: pending, error: insertErr } = await admin
      .from("pending_registrations")
      .insert({
        full_name: fullName,
        email,
        password,
        plan,
      })
      .select("verification_token")
      .single();

    if (insertErr || !pending) {
      console.error("Supabase insert pending error:", insertErr);
      return { status: "error", message: "Error al registrar la solicitud." };
    }

    // 4. Send verification email
    if (isMailConfigured()) {
      await sendRegistrationVerificationEmail({
        nombre: fullName,
        email,
        plan,
        token: pending.verification_token,
        origin,
      });
    } else {
      console.warn(
        "Mail not configured. Verification URL token would be: ",
        pending.verification_token,
      );
    }

    return {
      status: "success",
      message:
        "Te enviamos un correo de verificación. Por favor revisá tu casilla para activar tu cuenta.",
    };
  } catch (err) {
    console.error("Doctor registration error:", err);
    return {
      status: "error",
      message: "Hubo un problema al procesar el registro. Intente nuevamente.",
    };
  }
}

export async function submitPatientRegistration(
  fullName: string,
  email: string,
  password: string,
  origin: string,
): Promise<DoctorRegState> {
  if (!fullName || !email || !password) {
    return { status: "error", message: "Todos los campos son obligatorios." };
  }

  try {
    const admin = createAdminClient();

    // 1. Check if email is already in clients
    const { data: existingClient, error: clientErr } = await admin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (clientErr) {
      console.error("Supabase select client error:", clientErr);
      return { status: "error", message: "Error al verificar el correo." };
    }

    if (existingClient) {
      const { data: existingUnit, error: unitErr } = await admin
        .from("client_units")
        .select("id")
        .eq("client_id", existingClient.id)
        .eq("unit_code", "salud")
        .eq("plan", "paciente")
        .maybeSingle();

      if (unitErr) {
        console.error("Supabase select unit error:", unitErr);
        return {
          status: "error",
          message: "Error al verificar las unidades del paciente.",
        };
      }

      if (existingUnit) {
        return {
          status: "error",
          message: "Este correo electrónico ya está registrado como paciente.",
        };
      }
    }

    // 2. Delete any existing pending registrations for this email
    await admin.from("pending_registrations").delete().eq("email", email);

    // 3. Insert into pending_registrations with plan = 'paciente'
    const { data: pending, error: insertErr } = await admin
      .from("pending_registrations")
      .insert({
        full_name: fullName,
        email,
        password,
        plan: "paciente",
      })
      .select("verification_token")
      .single();

    if (insertErr || !pending) {
      console.error("Supabase insert pending error:", insertErr);
      return { status: "error", message: "Error al registrar la solicitud." };
    }

    // 4. Send verification email for patient
    if (isMailConfigured()) {
      await sendPatientVerificationEmail({
        nombre: fullName,
        email,
        token: pending.verification_token,
        origin,
      });
    } else {
      console.warn(
        "Mail not configured. Verification URL token would be: ",
        pending.verification_token,
      );
    }

    return {
      status: "success",
      message:
        "Te enviamos un correo de verificación. Por favor revisá tu casilla para activar tu cuenta de paciente.",
    };
  } catch (err) {
    console.error("Patient registration error:", err);
    return {
      status: "error",
      message: "Hubo un problema al procesar el registro. Intente nuevamente.",
    };
  }
}

export async function requestPasswordReset(
  email: string,
  nodeSlug: string,
  origin: string,
): Promise<{ status: "success" | "error"; message: string }> {
  if (!email) {
    return { status: "error", message: "El correo electrónico es obligatorio." };
  }

  try {
    const admin = createAdminClient();

    // 1. Generate the recovery link
    const redirectToUrl = `${origin}/login?node=${nodeSlug}&mode=reset-password`;
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
  password: string,
  origin: string,
): Promise<{ status: "success" | "error"; message: string }> {
  if (!fullName || !email || !password) {
    return { status: "error", message: "Todos los campos son obligatorios." };
  }

  try {
    const admin = createAdminClient();

    // 1. Check if email is already in clients and has Inmo unit
    const { data: existingClient, error: clientErr } = await admin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (clientErr) {
      console.error("Supabase select client error:", clientErr);
      return { status: "error", message: "Error al verificar el correo." };
    }

    if (existingClient) {
      const { data: existingUnit, error: unitErr } = await admin
        .from("client_units")
        .select("id")
        .eq("client_id", existingClient.id)
        .eq("unit_code", "inmo")
        .maybeSingle();

      if (unitErr) {
        console.error("Supabase select unit error:", unitErr);
        return {
          status: "error",
          message: "Error al verificar las unidades del cliente.",
        };
      }

      if (existingUnit) {
        return {
          status: "error",
          message: "Este correo electrónico ya tiene registrado NODO | Inmo.",
        };
      }
    }

    // 2. Delete any existing pending registrations for this email
    await admin.from("pending_registrations").delete().eq("email", email);

    // 3. Insert into pending_registrations with plan = 'inmo'
    const { data: pending, error: insertErr } = await admin
      .from("pending_registrations")
      .insert({
        full_name: fullName,
        email,
        password,
        plan: "inmo",
      })
      .select("verification_token")
      .single();

    if (insertErr || !pending) {
      console.error("Supabase insert pending error:", insertErr);
      return { status: "error", message: "Error al registrar la solicitud." };
    }

    // 4. Send verification email using Zoho SMTP
    if (isMailConfigured()) {
      await sendInmoVerificationEmail({
        nombre: fullName,
        email,
        token: pending.verification_token,
        origin,
      });
    } else {
      console.warn(
        "Mail not configured. Verification URL token would be: ",
        pending.verification_token,
      );
    }

    return {
      status: "success",
      message:
        "Te enviamos un correo de verificación. Por favor revisá tu casilla para activar tu cuenta de inmobiliaria.",
    };
  } catch (err) {
    console.error("Inmo registration error:", err);
    return {
      status: "error",
      message: "Hubo un problema al procesar el registro. Intente nuevamente.",
    };
  }
}
