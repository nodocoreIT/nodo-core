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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://api.argly.com.ar/v1/icl");
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
