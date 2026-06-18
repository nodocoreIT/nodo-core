import path from "path";

export function getObraDataDir(): string {
  if (process.env.OBRA_DATA_DIR) {
    return path.resolve(process.env.OBRA_DATA_DIR);
  }
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "obra-data");
  }
  return path.join(process.cwd(), "data");
}

export function getObraDbPath(): string {
  return path.join(getObraDataDir(), "obra.json");
}

export function getObraFotosDir(proyectoId: string): string {
  return path.join(getObraDataDir(), "fotos", proyectoId);
}
