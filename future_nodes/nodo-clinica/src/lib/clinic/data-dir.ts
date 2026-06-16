import path from "path";

/**
 * Directorio persistente de datos clínicos (JSON + uploads).
 * - Local dev: `{proyecto}/data/` (persiste entre reinicios)
 * - Fly.io: `/data` vía CLINIC_DATA_DIR
 * - Vercel sin Blob: `/tmp/clinic-data` (efímero — configurar BLOB_READ_WRITE_TOKEN)
 */
export function getClinicDataDir(): string {
  if (process.env.CLINIC_DATA_DIR) {
    return path.resolve(process.env.CLINIC_DATA_DIR);
  }
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "clinic-data");
  }
  return path.join(process.cwd(), "data");
}

export function getClinicDbPath(): string {
  return path.join(getClinicDataDir(), "clinic.json");
}

export function getClinicUploadsDir(): string {
  return path.join(getClinicDataDir(), "uploads");
}
