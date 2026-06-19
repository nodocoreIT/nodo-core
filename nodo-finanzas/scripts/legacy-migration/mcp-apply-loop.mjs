#!/usr/bin/env node
/**
 * Apply generated SQL files via Supabase MCP (stdin JSON protocol for agent wrapper).
 * Usage: node mcp-apply-loop.mjs  → prints progress; agent should call execute_sql per file.
 * This script outputs one JSON object per line: {file, bytes}
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, 'generated-sql');
const ORDER = [
  'rubros', 'categorias', 'cuentas', 'sueldos', 'tarjetas', 'prestamos',
  'planes_ahorro', 'cuentas_bancarias', 'gastos_fijos', 'gastos_diarios',
  'tarjetas_consumos', 'movimientos_cuenta', 'cuotas_programadas',
  'cuotas_planes_ahorro', 'configuracion_usuario',
];

const manifest = existsSync(join(OUT, 'manifest.json'))
  ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'))
  : [];

const files = ORDER.flatMap(t => manifest.filter(f => f.startsWith(`${t}-`)).sort());
for (const f of files) {
  const sql = readFileSync(join(OUT, f), 'utf8');
  process.stdout.write(JSON.stringify({ file: f, sql }) + '\n');
}
