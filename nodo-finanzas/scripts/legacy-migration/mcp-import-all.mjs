#!/usr/bin/env node
/**
 * Import legacy public.* → nodocore nodo_finanzas_personales.*
 *
 * export SUPABASE_ACCESS_TOKEN='sbp_...'  (or uses ~/.cursor/mcp.json PAT)
 * node mcp-import-all.mjs
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LEGACY_REF = 'bmncptoplxfjahdorbny';
const TARGET_REF = 'iprrlgmhpsxzyrejabtu';
const USER_ID = '6edaed45-1cd7-45d6-a731-66412b398724';
const BATCH = 50;

const TABLES = [
  'rubros',
  'categorias',
  'cuentas',
  'sueldos',
  'tarjetas',
  'prestamos',
  'planes_ahorro',
  'cuentas_bancarias',
  'gastos_fijos',
  'gastos_diarios',
  'tarjetas_consumos',
  'movimientos_cuenta',
  'cuotas_programadas',
  'cuotas_planes_ahorro',
  'configuracion_usuario',
];

function getToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const mcp = JSON.parse(readFileSync(join(homedir(), '.cursor/mcp.json'), 'utf8'));
  const auth = mcp.mcpServers?.['user-supabase-legacy']?.headers?.Authorization ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  return token;
}

async function runSql(projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${projectRef}] HTTP ${res.status}: ${text.slice(0, 800)}`);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed?.result ?? parsed;
}

async function getColumns(table) {
  const rows = await runSql(
    LEGACY_REF,
    `select column_name from information_schema.columns where table_schema='public' and table_name='${table}' order by ordinal_position`,
  );
  return rows.map((r) => r.column_name);
}

async function countRows(projectRef, schema, table) {
  const rows = await runSql(projectRef, `select count(*)::int as n from ${schema}.${table}`);
  return rows[0]?.n ?? 0;
}

async function importTable(table) {
  const dst = `nodo_finanzas_personales.${table}`;
  const total = await countRows(LEGACY_REF, 'public', table);
  if (total === 0) {
    console.log(`⊘ ${table}: vacío`);
    return;
  }

  const columns = await getColumns(table);
  const colList = columns.map((c) => `"${c}"`).join(', ');
  const valuePlaceholders = columns.map(() => '%L').join(', ');
  const formatArgs = columns.map((c) => `r."${c}"`).join(', ');
  const orderCol = columns.includes('created_at') ? 'created_at' : columns.includes('id') ? 'id' : columns[0];

  console.log(`→ ${table}: ${total} filas`);

  for (let offset = 0; offset < total; offset += BATCH) {
    const genSql = `
select coalesce(string_agg(stmt, E'\\n'), '') as sql
from (
  select format(
    'INSERT INTO ${dst} (${colList}, user_id) VALUES (${valuePlaceholders}, %L::uuid) ON CONFLICT (id) DO NOTHING',
    ${formatArgs},
    '${USER_ID}'
  ) as stmt
  from (
    select ${colList}
    from public.${table}
    order by "${orderCol}"
    limit ${BATCH} offset ${offset}
  ) r
) s;`;

    const genRows = await runSql(LEGACY_REF, genSql);
    const sql = genRows[0]?.sql ?? '';
    if (!sql.trim()) continue;

    await runSql(TARGET_REF, sql);
    process.stdout.write(`  ${Math.min(offset + BATCH, total)}/${total}\n`);
  }

  const imported = await countRows(TARGET_REF, 'nodo_finanzas_personales', table);
  console.log(`  ✓ ${table} en destino: ${imported}`);
}

async function main() {
  console.log(`Import → user_id ${USER_ID}\n`);
  for (const table of TABLES) {
    await importTable(table);
  }
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
