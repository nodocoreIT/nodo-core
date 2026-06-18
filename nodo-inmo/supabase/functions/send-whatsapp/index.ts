import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SendWhatsAppPayload {
  phone: string;
  tenantName: string;
  contractId: string;
  rentAmount: number;
  currency: string;
  adjustmentIndex: string;
  nextAdjustmentDate: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  try {
    // Verify caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth header" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as SendWhatsAppPayload;
    const { phone, tenantName, rentAmount, currency, adjustmentIndex, nextAdjustmentDate } = body;

    if (!phone) return json({ error: "phone is required" }, 400);

    // Normalize phone: strip spaces/dashes, ensure it starts with country code
    // Argentina: +54 9 XXXX XXXXXX → WhatsApp format: 549XXXXXXXXXX
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");

    const metaToken = Deno.env.get("META_WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID");

    if (!metaToken || !phoneNumberId) {
      return json({ error: "WhatsApp credentials not configured" }, 503);
    }

    const formattedAmount = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "ARS",
      minimumFractionDigits: 0,
    }).format(rentAmount);

    const formattedDate = nextAdjustmentDate
      ? new Date(nextAdjustmentDate).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "próximo mes";

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "template",
          template: {
            name: "aviso_aumento_alquiler",
            language: { code: "es_AR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: tenantName },
                  { type: "text", text: formattedDate },
                  { type: "text", text: adjustmentIndex },
                  { type: "text", text: formattedAmount },
                ],
              },
            ],
          },
        }),
      },
    );

    const result = await res.json();

    if (!res.ok) {
      return json({ error: "WhatsApp API error", detail: result }, 502);
    }

    return json({ success: true, messageId: result.messages?.[0]?.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
