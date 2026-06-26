import { createServiceClient } from "@/lib/supabase/server";

export interface PaymentCredentialsRow {
  id: string;
  org_id: string;
  access_token: string;
  refresh_token: string | null;
  public_key: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCredentialsUpsert {
  org_id: string;
  access_token: string;
  refresh_token?: string | null;
  public_key?: string | null;
  token_expires_at?: string | null;
}

/**
 * Reads MercadoPago OAuth credentials for an org.
 * ALWAYS uses service_role client — never the authenticated client.
 * (RLS blocks authenticated access to payment_credentials by design.)
 */
export async function getPaymentCredentials(
  orgId: string,
): Promise<PaymentCredentialsRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payment_credentials")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[payments] getPaymentCredentials error", error);
    return null;
  }
  return data as PaymentCredentialsRow | null;
}

/**
 * Upserts MercadoPago OAuth credentials for an org.
 * ALWAYS uses service_role client.
 */
export async function upsertPaymentCredentials(
  orgId: string,
  tokens: Omit<PaymentCredentialsUpsert, "org_id">,
): Promise<PaymentCredentialsRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payment_credentials")
    .upsert(
      { org_id: orgId, ...tokens, updated_at: new Date().toISOString() },
      { onConflict: "org_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[payments] upsertPaymentCredentials error", error);
    return null;
  }
  return data as PaymentCredentialsRow;
}

/**
 * Returns the MercadoPago access token for an org, using service_role only.
 * Falls back to env vars for legacy/test setups.
 */
export async function getOrgMercadoPagoAccessToken(
  orgId: string,
): Promise<string | undefined> {
  const creds = await getPaymentCredentials(orgId);
  if (creds?.access_token?.trim()) {
    return creds.access_token.trim();
  }
  // Env var fallback for legacy / test setups
  return (
    process.env.CLINIC_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    undefined
  );
}

/**
 * Returns true if the org has valid MercadoPago credentials stored.
 */
export async function orgHasMercadoPagoConnection(
  orgId: string,
): Promise<boolean> {
  const token = await getOrgMercadoPagoAccessToken(orgId);
  return !!token;
}

/**
 * Removes OAuth token fields from office_settings.payment JSONB.
 * Cleans: access_token, refresh_token, public_key, token_expires_at.
 * Called after tokens are migrated to payment_credentials table.
 */
export async function clearOAuthTokensFromOfficeSettings(
  orgId: string,
): Promise<void> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", orgId)
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
    .eq("org_id", orgId);

  if (updateError) {
    console.error("[payments] clearOAuthTokensFromOfficeSettings error", updateError);
  }
}
