import { createServiceClient } from "@/lib/supabase/server";

export interface PaymentCredentialsRow {
  id: string;
  professional_id: string;
  org_id: string;
  access_token: string;
  refresh_token: string | null;
  public_key: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCredentialsUpsert {
  professional_id: string;
  org_id: string;
  access_token: string;
  refresh_token?: string | null;
  public_key?: string | null;
  token_expires_at?: string | null;
}

/**
 * Reads MercadoPago OAuth credentials for a professional (each doctor links
 * their own account — this is NOT shared across an org).
 * ALWAYS uses service_role client — never the authenticated client.
 * (RLS blocks authenticated access to payment_credentials by design.)
 */
export async function getPaymentCredentials(
  professionalId: string,
): Promise<PaymentCredentialsRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payment_credentials")
    .select("*")
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (error) {
    console.error("[payments] getPaymentCredentials error", error);
    return null;
  }
  return data as PaymentCredentialsRow | null;
}

/**
 * Upserts MercadoPago OAuth credentials for a professional.
 * ALWAYS uses service_role client.
 */
export async function upsertPaymentCredentials(
  professionalId: string,
  tokens: Omit<PaymentCredentialsUpsert, "professional_id">,
): Promise<PaymentCredentialsRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payment_credentials")
    .upsert(
      { professional_id: professionalId, ...tokens, updated_at: new Date().toISOString() },
      { onConflict: "professional_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("[payments] upsertPaymentCredentials error", error);
    return null;
  }
  return (data as PaymentCredentialsRow | null) ?? null;
}

/**
 * Returns the MercadoPago access token for a professional, using service_role only.
 * No env-var fallback: MERCADOPAGO_ACCESS_TOKEN is Nodo's own platform token
 * (used to bill doctors' subscriptions to Nodo) and must never be reused to
 * collect a doctor's patient payments — each doctor's token comes only from
 * their own linked payment_credentials row.
 */
export async function getProfessionalMercadoPagoAccessToken(
  professionalId: string,
): Promise<string | undefined> {
  const creds = await getPaymentCredentials(professionalId);
  return creds?.access_token?.trim() || undefined;
}

/**
 * Returns true if the professional has valid MercadoPago credentials stored.
 */
export async function professionalHasMercadoPagoConnection(
  professionalId: string,
): Promise<boolean> {
  const token = await getProfessionalMercadoPagoAccessToken(professionalId);
  return !!token;
}

/**
 * Removes OAuth token fields from office_settings.payment JSONB.
 * Cleans: access_token, refresh_token, public_key, token_expires_at.
 * Called after tokens are migrated to payment_credentials table.
 */
export async function clearOAuthTokensFromOfficeSettings(
  professionalId: string,
): Promise<void> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (error || !data) return;

  const payment = (data.payment as Record<string, unknown>) ?? {};
  const cleaned: Record<string, unknown> = { ...payment };
  delete cleaned.mercadopagoAccessToken;
  delete cleaned.mercadopagoRefreshToken;
  delete cleaned.mercadopagoTokenExpiresAt;
  delete cleaned.mercadopagoPublicKey;

  const { error: updateError } = await supabase
    .from("office_settings")
    .update({ payment: cleaned })
    .eq("professional_id", professionalId);

  if (updateError) {
    console.error("[payments] clearOAuthTokensFromOfficeSettings error", updateError);
  }
}
