import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Diagnóstico de conectividad Supabase (sin exponer secretos). */
export async function GET() {
  let dbReadOk = false;
  let professionalCount = 0;
  let dbError: string | undefined;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("professionals")
      .select("*", { count: "exact", head: true });

    if (error) {
      dbError = error.message;
    } else {
      dbReadOk = true;
      professionalCount = count ?? 0;
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Supabase client error";
  }

  const ok = dbReadOk;

  return NextResponse.json({
    ok,
    backend: "supabase",
    dbReadOk,
    professionalCount,
    dbError,
    hint: ok ? "Supabase OK." : `Error: ${dbError}`,
  });
}
