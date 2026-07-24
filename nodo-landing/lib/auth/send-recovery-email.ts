import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import {
  getNodoAuthCode,
  nodoAuthProjectParam,
} from "@/lib/supabase/nodo-auth-config";
import { getNodeLoginPath, getNodeMailLabel } from "@/lib/nodes";
import { resolvePublicOriginFromRequest, isLocalOrigin } from "@/lib/auth/public-origin";
import { sendPasswordResetEmail, isMailConfigured } from "@/lib/mail";

export type RecoveryResult = {
  status: "success" | "error";
  message: string;
  loginReturn?: string;
  project?: string;
};

/**
 * Core recovery email logic — generates a Supabase recovery link and sends
 * the branded email via SMTP. Shared by the "forgot password" server action
 * and the dashboard "recover password" API route.
 */
export async function sendRecoveryEmail(params: {
  email: string;
  nodeSlug: string;
  origin?: string;
  loginPathOverride?: string;
}): Promise<RecoveryResult> {
  const { email, nodeSlug, loginPathOverride } = params;

  if (!email) {
    return { status: "error", message: "El correo electrónico es obligatorio." };
  }

  try {
    const authCode = getNodoAuthCode(nodeSlug);
    const nodoAdmin = authCode ? createNodoAdminClient(authCode) : null;
    const admin = nodoAdmin ?? createAdminClient();
    const nodeLabel = getNodeMailLabel(nodeSlug);
    const loginPath = loginPathOverride?.trim() || getNodeLoginPath(nodeSlug);
    const baseOrigin = await resolvePublicOriginFromRequest(params.origin);

    if (isLocalOrigin(baseOrigin) && process.env.NODE_ENV === "production") {
      console.error(
        "[sendRecoveryEmail] Production reset link would use localhost. Set NEXT_PUBLIC_APP_URL on Vercel and Supabase Site URL to https://www.nodocore.com.ar",
        { nodeSlug, clientOrigin: params.origin, baseOrigin },
      );
    }

    const loginReturn = `${loginPath}?mode=reset-password`;
    const project = nodoAuthProjectParam(authCode);
    const confirmQuery = project
      ? `project=${encodeURIComponent(project)}&next=${encodeURIComponent(loginReturn)}`
      : `next=${encodeURIComponent(loginReturn)}`;
    const redirectToUrl = `${baseOrigin}/auth/confirm?${confirmQuery}`;

    let { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim(),
      options: { redirectTo: redirectToUrl },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("Auth user not found or failed generating link. Checking clients database table...");
      const { data: existingClient } = await admin
        .from("clients")
        .select("id, name")
        .eq("email", email.trim())
        .maybeSingle();

      if (existingClient) {
        const { error: createErr } = await admin.auth.admin.createUser({
          email: email.trim(),
          password: Math.random().toString(36).substring(2, 10),
          email_confirm: true,
          user_metadata: { full_name: existingClient.name },
        });

        if (!createErr) {
          const retry = await admin.auth.admin.generateLink({
            type: "recovery",
            email: email.trim(),
            options: { redirectTo: redirectToUrl },
          });
          data = retry.data;
          error = retry.error;
        } else {
          console.error("Failed to auto-provision auth user:", createErr);
        }
      }
    }

    const hashedToken = data?.properties?.hashed_token;
    if (error || !hashedToken) {
      console.error("Generate recovery link error:", error);
      return {
        status: "error",
        message: "No se pudo generar el enlace de recuperación. Verifique si el correo existe.",
      };
    }

    // Build our own URL that goes directly to /auth/confirm on our domain.
    // This avoids relying on Supabase's redirect_to allowlist — the user
    // always arrives at our server first, which verifies the token and
    // redirects to the SPA auth callback with the session in the hash.
    const confirmParams = new URLSearchParams({
      token_hash: hashedToken,
      type: "recovery",
      ...(project ? { project } : {}),
      next: loginReturn,
    });
    const recoveryUrl = `${baseOrigin}/auth/confirm?${confirmParams.toString()}`;

    if (isMailConfigured()) {
      await sendPasswordResetEmail({
        email: email.trim(),
        recoveryUrl,
        nodeLabel,
        nodeSlug,
      });
    } else {
      console.warn("Mail not configured. Recovery link:", recoveryUrl);
    }

    return {
      status: "success",
      message: "Te enviamos un correo con las instrucciones para restablecer tu contraseña. Revisá tu casilla.",
      loginReturn,
      project,
    };
  } catch (err) {
    console.error("Send recovery email error:", err);
    return {
      status: "error",
      message: "Hubo un problema al procesar la solicitud. Intente nuevamente.",
    };
  }
}
