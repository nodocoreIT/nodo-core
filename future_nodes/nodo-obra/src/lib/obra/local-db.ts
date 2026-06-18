import { promises as fs } from "fs";
import { getObraDataDir, getObraDbPath } from "@/lib/obra/data-dir";
import { createDefaultRubrosProgreso } from "@/lib/obra/avance";
import {
  buildDefaultRubros,
  buildObraSeed,
  buildSeedPresupuestos,
  OBRA_SEED_VERSION,
} from "@/lib/obra/seed";
import type {
  LocalCliente,
  LocalProyecto,
  LocalStaff,
  ObraDatabase,
} from "@/lib/obra/types";

export function publicStaff(staff: LocalStaff) {
  const { password: _, ...rest } = staff;
  return rest;
}

export function publicCliente(cliente: LocalCliente) {
  const { portalPassword: _, ...rest } = cliente;
  return rest;
}

async function ensureDataDir() {
  await fs.mkdir(getObraDataDir(), { recursive: true });
}

export async function readDb(): Promise<ObraDatabase> {
  await ensureDataDir();
  const path = getObraDbPath();
  try {
    const raw = await fs.readFile(path, "utf8");
    const db = JSON.parse(raw) as ObraDatabase;
    if (db.version !== OBRA_SEED_VERSION) {
      if (db.version < OBRA_SEED_VERSION) {
        let migrated = normalizeDb({ ...db, version: OBRA_SEED_VERSION });
        if (!migrated.presupuestos.length) {
          migrated = {
            ...migrated,
            presupuestos: buildSeedPresupuestos(migrated),
          };
        }
        await writeDb(migrated);
        return migrated;
      }
      const seeded = buildObraSeed();
      await writeDb(seeded);
      return seeded;
    }
    const normalized = normalizeDb(db);
    const needsPersist =
      !db.rubrosProgreso ||
      !db.presupuestos ||
      !db.fotosAvance ||
      db.proyectos.some(
        (p) =>
          p.avanceProgreso === undefined ||
          p.origenPresupuestoId === undefined ||
          p.inmoPropertyId === undefined,
      );
    if (needsPersist) {
      await writeDb(normalized);
    }
    return normalized;
  } catch {
    const seeded = buildObraSeed();
    await writeDb(seeded);
    return seeded;
  }
}

export async function writeDb(db: ObraDatabase): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(getObraDbPath(), JSON.stringify(db, null, 2), "utf8");
}

export function getProyectoById(db: ObraDatabase, id: string) {
  return db.proyectos.find((p) => p.id === id) ?? null;
}

function normalizeDb(db: ObraDatabase): ObraDatabase {
  const rubros =
    db.rubros && db.rubros.length > 0 ? db.rubros : buildDefaultRubros();
  const gastos = db.gastos.map((g) => ({
    ...g,
    rubroId: g.rubroId ?? null,
  }));

  let rubrosProgreso = db.rubrosProgreso ?? [];
  const defaultRubroNames = ["Albañilería", "Electricidad", "Plomería", "Pintura"];

  for (const proyecto of db.proyectos) {
    const existing = rubrosProgreso.filter((r) => r.proyectoId === proyecto.id);
    if (existing.length === 0) {
      rubrosProgreso = [
        ...rubrosProgreso,
        ...createDefaultRubrosProgreso(proyecto.id, defaultRubroNames),
      ];
    }
  }

  const proyectos = db.proyectos.map((p) => ({
    ...p,
    avanceProgreso: p.avanceProgreso ?? 0,
    origenPresupuestoId: p.origenPresupuestoId ?? null,
    inmoPropertyId: p.inmoPropertyId ?? null,
    inmoPropertyLabel: p.inmoPropertyLabel ?? null,
  }));

  const presupuestos = (db.presupuestos ?? []).map((p) => ({
    ...p,
    inmoPropertyId: p.inmoPropertyId ?? null,
    inmoPropertyLabel: p.inmoPropertyLabel ?? null,
  }));

  const fotosAvance = db.fotosAvance ?? [];

  return {
    ...db,
    rubros,
    gastos,
    rubrosProgreso,
    proyectos,
    presupuestos,
    fotosAvance,
  };
}
