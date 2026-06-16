import { getClinicDataDir, getClinicUploadsDir } from "@/lib/clinic/data-dir";
import { promises as fs } from "fs";

export function getDataDir(): string {
  return getClinicDataDir();
}

export function getUploadsDir(): string {
  return getClinicUploadsDir();
}

export async function ensureUploadsDir(): Promise<string> {
  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
