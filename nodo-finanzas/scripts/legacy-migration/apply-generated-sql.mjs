#!/usr/bin/env node
/**
 * Apply generated-sql/*.sql to nodocore via Management API.
 * Requires a PAT with access to project iprrlgmhpsxzyrejabtu (supabase MCP OAuth scope).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NODOCORE_REF = 'iprrlgmhpsxzyrejabtu';
const OUT = join(import.meta.dirname, 'generated-sql');

function token() {
  const mcp = JSON.parse(readFileSync(join(homedir(), '.cursor/mcp.json'), 'utf8'));
  const srv = mcp.mcpServers?.supabase ?? mcp.mcpServers?.['user-supabase'];
  const auth = srv?.headers?.Authorization ?? process.env.SUPABASE_ACCESS_TOKEN ?? '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

async function execSql(query, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${NODOCORE_REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if ((res.status === 504 || res.status === 403) && i < retries) {
      if (res.status === 403) throw new Error(`403 Forbidden — use MCP execute_sql instead: ${text.slice(0, 200)}`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text);
  }
}

async function main() {
  const manifest = existsSync(join(OUT, 'manifest.json'))
    ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'))
    : readdirSync(OUT).filter(f => f.endsWith('.sql')).sort();

  for (const file of manifest) {
    const sql = readFileSync(join(OUT, file), 'utf8').trim();
    if (!sql) continue;
    process.stdout.write(`Applying ${file}... `);
    await execSql(sql);
    console.log('ok');
  }
  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
