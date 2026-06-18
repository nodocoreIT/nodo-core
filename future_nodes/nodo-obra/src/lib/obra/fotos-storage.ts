import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getObraFotosDir } from "@/lib/obra/data-dir";
import type { LocalFotoAvance } from "@/lib/obra/types";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function saveFotoAvance(
  proyectoId: string,
  file: File,
  descripcion: string,
  fechaAvance: string,
): Promise<LocalFotoAvance> {
  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("Formato no soportado");
  }

  const fotoId = randomUUID();
  const fileName = `${fotoId}${ext}`;
  const dir = getObraFotosDir(proyectoId);
  await fs.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, fileName), buffer);

  return {
    id: fotoId,
    proyectoId,
    fechaAvance,
    descripcion,
    fileName,
    createdAt: new Date().toISOString(),
  };
}

export async function readFotoAvanceFile(
  proyectoId: string,
  fileName: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const filePath = path.join(getObraFotosDir(proyectoId), fileName);
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(fileName).toLowerCase();
  return { buffer, contentType: MIME[ext] ?? "application/octet-stream" };
}

export async function deleteFotoAvanceFile(
  proyectoId: string,
  fileName: string,
): Promise<void> {
  try {
    await fs.unlink(path.join(getObraFotosDir(proyectoId), fileName));
  } catch {
    /* ignore missing file */
  }
}
