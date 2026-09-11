const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Server-to-server proxy for the ICL (Índice para Contratos de Locación)
// public index. api.argly.com.ar doesn't send Access-Control-Allow-Origin,
// so a direct browser fetch gets blocked by CORS — this Edge Function calls
// it from the server side (no CORS restriction) and the browser calls us
// instead, same-origin from Supabase's perspective.
//
// Forwards `desde`/`hasta` query params through to the upstream API: with
// no params it returns today's single value, with a date range it returns
// the daily historical series for that range (same endpoint, different
// response shape upstream).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const incomingUrl = new URL(req.url);
    const upstreamUrl = new URL("https://api.argly.com.ar/v1/icl");
    upstreamUrl.search = incomingUrl.search;

    const res = await fetch(upstreamUrl);
    if (!res.ok) {
      return json({ error: `API error ${res.status}` }, 502);
    }

    const body = await res.json();
    return json(body, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "ICL fetch failed" }, 502);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
