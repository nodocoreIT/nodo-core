import path from "path";
import { promises as fs } from "fs";

export function getDataDir(): string {
  return process.env.CLINIC_DATA_DIR
    ? path.resolve(process.env.CLINIC_DATA_DIR)
    : process.env.VERCEL === "1"
      ? "/tmp"
      : path.join(process.cwd(), "data");
}

export function getUploadsDir(): string {
  return path.join(getDataDir(), "uploads");
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
