import { NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";

export const dynamic = "force-dynamic";

/** Diagnóstico de persistencia (sin exponer secretos). */
export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const hasStoreId = !!process.env.BLOB_STORE_ID?.trim();
  const onVercel = !!process.env.VERCEL;

  let blobMode: "token" | "oidc" | "missing" = "missing";
  if (hasToken) blobMode = "token";
  else if (hasStoreId && onVercel) blobMode = "oidc";

  const configured = blobMode !== "missing";

  let dbReadOk = false;
  let doctorCount = 0;
  let dbError: string | undefined;

  if (configured) {
    try {
      const db = await readDb();
      dbReadOk = true;
      doctorCount = db.doctors.length;
    } catch (err) {
      dbError = err instanceof Error ? err.message : "readDb failed";
    }
  }

  const ok = configured && dbReadOk;

  return NextResponse.json({
    ok,
    blobMode,
    vercel: onVercel,
    dbReadOk,
    doctorCount,
    dbError,
    hint: ok
      ? "Blob y lectura OK."
      : dbError?.includes("suspended")
        ? "El Blob store está suspendido en Vercel → Storage → reactivar o crear uno nuevo y redeploy."
        : dbError
          ? "Blob conectado pero no se pudo leer clinic.json — redeploy tras el fix."
          : "Conectá nodo-salud-blob al proyecto y redeploy.",
  });
}
