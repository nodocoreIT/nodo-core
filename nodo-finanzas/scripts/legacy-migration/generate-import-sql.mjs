#!/usr/bin/env node
/** Generate INSERT SQL files from legacy (PAT = legacy project only). */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LEGACY_REF = 'bmncptoplxfjahdorbny';
const USER_ID = '6edaed45-1cd7-45d6-a731-66412b398724';
const BATCH = 50;
const OUT = join(import.meta.dirname, 'generated-sql');

/** Columns in nodo_finanzas_personales (dest); user_id added at insert time. */
const DEST_COLS = {
  rubros: ['id', 'codigo', 'nombre', 'emoji', 'color', 'descripcion', 'activo', 'es_sistema', 'orden', 'created_at', 'updated_at'],
  categorias: ['id', 'nombre', 'codigo', 'activa', 'created_at'],
  cuentas: ['id', 'nombre', 'tipo', 'saldo_actual', 'moneda', 'activa', 'fecha_actualizacion', 'orden', 'created_at'],
  sueldos: ['id', 'nombre', 'monto', 'moneda', 'activo', 'updated_at', 'created_at'],
  tarjetas: ['id', 'nombre', 'banco', 'tipo', 'titular', 'dia_cierre', 'dia_vencimiento', 'limite_credito', 'limite_recomendado', 'fecha_vencimiento', 'pagada', 'ultimo_pago_mes', 'activa', 'created_at'],
  prestamos: ['id', 'concepto', 'monto_original', 'moneda', 'saldo_pendiente', 'tasa_interes', 'fecha_inicio', 'fecha_vencimiento', 'cuotas_totales', 'cuotas_pagas', 'importe_cuota', 'saldo_cancelacion', 'cuota_abonada', 'pagado', 'activo', 'prestamista', 'color', 'no_cobrar_cuota', 'notas', 'comprobante_url', 'ultimo_pago_mes', 'created_at'],
  planes_ahorro: ['id', 'detalle', 'grupo', 'orden', 'valor_movil', 'saldo_cancelacion', 'fecha_inicio', 'cuotas_totales', 'cuotas_pagas', 'cuotas_adelantadas', 'importe_cuota', 'moneda', 'fecha_vencimiento', 'activa', 'link_pago', 'modelo_referencia', 'created_at'],
  cuentas_bancarias: ['id', 'nombre', 'banco', 'titular', 'tipo', 'cuenta_saldo_id', 'activa', 'created_at'],
  gastos_fijos: ['id', 'rubro_id', 'etiqueta', 'descripcion', 'monto', 'moneda', 'forma_de_pago', 'tarjeta_id', 'cuenta_bancaria_id', 'plan_id', 'prestamo_id', 'pago_tarjeta_id', 'activo', 'fecha_creacion', 'created_at'],
  gastos_diarios: ['id', 'descripcion', 'detalle', 'monto', 'monto_usd', 'fecha', 'rubro', 'rubro_id', 'forma_de_pago', 'tarjeta_id', 'cuenta_id', 'cuotas', 'codigo_operacion', 'gasto_fijo_id', 'plan_id', 'prestamo_id', 'pago_tarjeta_id', 'pago_parcial', 'pago_tarjeta_mes', 'es_silencioso', 'created_at'],
  tarjetas_consumos: ['id', 'tarjeta_id', 'fecha', 'lugar', 'rubro', 'rubro_id', 'detalle', 'importe_ars', 'importe_usd', 'cuotas', 'cuota_actual', 'total_cuotas', 'gasto_fijo', 'codigo_operacion', 'fecha_compra', 'created_at'],
  movimientos_cuenta: ['id', 'cuenta_id', 'fecha', 'descripcion', 'monto', 'tipo', 'origen', 'referencia_id', 'detalle', 'updated_at', 'created_at'],
  cuotas_programadas: ['id', 'prestamo_id', 'numero_cuota', 'fecha_vencimiento', 'importe_total', 'pagada', 'fecha_pago', 'updated_at', 'created_at'],
  cuotas_planes_ahorro: ['id', 'plan_id', 'numero_cuota', 'fecha_vencimiento', 'importe', 'pagada', 'fecha_pago', 'gasto_diario_id', 'updated_at', 'created_at'],
  configuracion_usuario: ['id', 'clave', 'valor', 'created_at'],
};

const TABLES = Object.keys(DEST_COLS);

function normalizeSql(sql) {
  return sql.trim().split(/\n(?=INSERT INTO)/)
    .map(c => c.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(line => line.endsWith(';') ? line : `${line};`)
    .join('\n') + '\n';
}

function token() {
  const mcp = JSON.parse(readFileSync(join(homedir(), '.cursor/mcp.json'), 'utf8'));
  const srv = mcp.mcpServers?.['user-supabase-legacy'] ?? mcp.mcpServers?.['user-user-supabase-legacy'];
  return (srv?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '').trim();
}

async function sql(projectRef, query, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (res.status === 504 && i < retries) {
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${projectRef} ${res.status}: ${text.slice(0, 400)}`);
    const p = JSON.parse(text);
    return Array.isArray(p) ? p : p.result ?? p;
  }
}

function existingBatches(table) {
  if (!existsSync(OUT)) return 0;
  return readdirSync(OUT).filter(f => f.startsWith(`${table}-`) && f.endsWith('.sql')).length;
}

function sqlLiteral(val, col, table) {
  if (val === null || val === undefined) return null;
  if (col === 'valor' && table === 'configuracion_usuario') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function insertForRow(table, cols, row) {
  const dst = `nodo_finanzas_personales.${table}`;
  const present = cols.filter(c => row[c] !== null && row[c] !== undefined);
  const colList = [...present.map(c => `"${c}"`), 'user_id'].join(', ');
  const vals = [...present.map(c => sqlLiteral(row[c], c, table)), `'${USER_ID}'::uuid`].join(', ');
  return `INSERT INTO ${dst} (${colList}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--force');
  const fromTable = args[0] ?? null;
  const skipExisting = !process.argv.includes('--force');
  mkdirSync(OUT, { recursive: true });
  const manifest = existsSync(join(OUT, 'manifest.json'))
    ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'))
    : [];

  let started = !fromTable;
  for (const table of TABLES) {
    if (!started) {
      if (table === fromTable) started = true;
      else continue;
    }

    const destCols = DEST_COLS[table];
    const legacyCols = (await sql(LEGACY_REF,
      `select column_name from information_schema.columns where table_schema='public' and table_name='${table}' order by ordinal_position`
    )).map(r => r.column_name);
    const cols = destCols.filter(c => legacyCols.includes(c));
    if (!cols.length) {
      console.log(`${table}: skip (no matching columns)`);
      continue;
    }

    const total = (await sql(LEGACY_REF, `select count(*)::int as n from public.${table}`))[0].n;
    if (!total) {
      console.log(`${table}: 0 rows`);
      continue;
    }

    const expectedBatches = Math.ceil(total / BATCH);
    if (skipExisting && existingBatches(table) >= expectedBatches) {
      console.log(`${table}: skip (${expectedBatches} batch file(s) already exist)`);
      continue;
    }

    const colList = cols.map(c => `"${c}"`).join(', ');
    const orderCol = cols.includes('created_at') ? 'created_at' : cols[0];

    let batchIdx = skipExisting ? existingBatches(table) : 0;
    for (let offset = batchIdx * BATCH; offset < total; offset += BATCH) {
      const rows = await sql(LEGACY_REF,
        `select ${colList} from public.${table} order by "${orderCol}" limit ${BATCH} offset ${offset}`
      );
      const body = rows.map(row => insertForRow(table, cols, row)).join('\n');
      if (!body.trim()) continue;
      const file = `${table}-${String(batchIdx).padStart(3, '0')}.sql`;
      writeFileSync(join(OUT, file), body + '\n');
      if (!manifest.includes(file)) manifest.push(file);
      batchIdx++;
      process.stdout.write('.');
    }
    console.log(`\n${table}: ${total} rows → ${batchIdx} file(s)`);
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(
    TABLES.flatMap(t => manifest.filter(f => f.startsWith(`${t}-`)).sort()),
    null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
