#!/usr/bin/env node
/** Print SQL files in FK-safe order (for MCP apply). */
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
for (const f of files) console.log(f);
