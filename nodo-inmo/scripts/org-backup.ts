/**
 * org-backup.ts — Export / restore all data for one Nodo Inmo tenant (org).
 *
 * Resolves the org from an admin email, dumps every nodo_inmo row scoped to
 * that org_id, plus shared tenant metadata and Storage objects (logos, fotos,
 * documentos, comprobantes).
 *
 * Usage — export (run BEFORE deleting / purging):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
 *   DATABASE_URL=postgresql://postgres:<pass>@db.<ref>.supabase.co:5432/postgres \
 *   npx tsx scripts/org-backup.ts export --email juanmendia@gmail.com \
 *     --output ./backups/juanmendia-2026-06-22
 *
 * Usage — restore (run AFTER purge or empty org):
 *   ...same env vars... \
 *   npx tsx scripts/org-backup.ts restore --input ./backups/juanmendia-2026-06-22
 *
 * Usage — inspect backup without touching DB:
 *   npx tsx scripts/org-backup.ts info --input ./backups/juanmendia-2026-06-22
 *
 * NEVER commit service role keys or backup folders (see .gitignore).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

// Insert / export order (children after parents).
const INMO_TABLES = [
  "org_profiles",
  "conceptos",
  "cash_accounts",
  "contacts",
  "properties",
  "contracts",
  "contract_guarantors",
  "payments",
  "owner_settlements",
  "property_expenses",
  "cash_movements",
  "documents",
  "reclamos",
  "tasks",
] as const;

const STORAGE_BUCKETS = [
  "org-branding",
  "org-documents",
  "property-expense-receipts",
  "property-photos",
] as const;

type InmoTable = (typeof INMO_TABLES)[number];

type Manifest = {
  version: 1;
  exported_at: string;
  email: string;
  user_id: string;
  org_id: string;
  org_name: string;
  org_tier: string;
  row_counts: Record<string, number>;
  storage_files: number;
  member_user_ids: string[];
};

type CliArgs = {
  command: "export" | "restore" | "info";
  email?: string;
  orgId?: string;
  output?: string;
  input?: string;
  skipStorage: boolean;
  noPurge: boolean;
  force: boolean;
};

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: required env var ${name} is not set.`);
    process.exit(1);
  }
  return val;
}

function parseArgs(argv: string[]): CliArgs {
  const [, , commandRaw, ...rest] = argv;
  const command = commandRaw as CliArgs["command"];
  if (!["export", "restore", "info"].includes(command)) {
    console.error(`Usage:
  npx tsx scripts/org-backup.ts export --email <email> [--org-id <uuid>] --output <dir> [--skip-storage]
  npx tsx scripts/org-backup.ts restore --input <dir> [--org-id <uuid>] [--no-purge] [--skip-storage] [--force]
  npx tsx scripts/org-backup.ts info --input <dir>`);
    process.exit(1);
  }

  const args: CliArgs = {
    command,
    skipStorage: false,
    noPurge: false,
    force: false,
  };

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    switch (token) {
      case "--email":
        args.email = rest[++i];
        break;
      case "--org-id":
        args.orgId = rest[++i];
        break;
      case "--output":
        args.output = rest[++i];
        break;
      case "--input":
        args.input = rest[++i];
        break;
      case "--skip-storage":
        args.skipStorage = true;
        break;
      case "--no-purge":
        args.noPurge = true;
        break;
      case "--force":
        args.force = true;
        break;
      default:
        console.error(`Unknown argument: ${token}`);
        process.exit(1);
    }
  }

  if (command === "export") {
    if (!args.email) {
      console.error("export requires --email");
      process.exit(1);
    }
    if (!args.output) {
      console.error("export requires --output <directory>");
      process.exit(1);
    }
  }

  if (command === "restore" || command === "info") {
    if (!args.input) {
      console.error(`${command} requires --input <directory>`);
      process.exit(1);
    }
  }

  return args;
}

async function resolveOrg(
  sql: postgres.Sql,
  email: string,
  orgId?: string,
): Promise<{
  user_id: string;
  org_id: string;
  org_name: string;
  org_tier: string;
  member_user_ids: string[];
}> {
  const [user] = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = lower(${email}) limit 1
  `;
  if (!user) {
    throw new Error(`No auth user found for email: ${email}`);
  }

  const memberships = await sql<
    { org_id: string; org_name: string; org_tier: string; role: string; created_at: string }[]
  >`
    select o.id as org_id, o.name as org_name, o.tier as org_tier, om.role, o.created_at
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = ${user.id}
      and o.product = 'inmo'
    order by (om.role = 'admin') desc, o.created_at asc
  `;

  if (memberships.length === 0) {
    throw new Error(`User ${email} has no inmo organization membership.`);
  }

  let chosen = memberships[0];
  if (orgId) {
    const match = memberships.find((m) => m.org_id === orgId);
    if (!match) {
      throw new Error(`User ${email} is not a member of org ${orgId}.`);
    }
    chosen = match;
  } else if (memberships.length > 1) {
    console.warn(
      `User belongs to ${memberships.length} inmo orgs; using admin org "${chosen.org_name}" (${chosen.org_id}).`,
    );
    console.warn("Pass --org-id to target a different org.");
  }

  const members = await sql<{ user_id: string }[]>`
    select user_id from shared.org_members where org_id = ${chosen.org_id}
  `;

  return {
    user_id: user.id,
    org_id: chosen.org_id,
    org_name: chosen.org_name,
    org_tier: chosen.org_tier,
    member_user_ids: members.map((m) => m.user_id),
  };
}

async function tableExists(sql: postgres.Sql, schema: string, table: string): Promise<boolean> {
  const [row] = await sql<{ reg: string | null }[]>`
    select to_regclass(${`${schema}.${table}`})::text as reg
  `;
  return row?.reg != null;
}

async function exportTableRows(
  sql: postgres.Sql,
  schema: string,
  table: string,
  orgId: string,
): Promise<Record<string, unknown>[]> {
  if (!(await tableExists(sql, schema, table))) {
    return [];
  }
  const rows = await sql.unsafe(
    `select * from ${schema}.${table} where org_id = $1`,
    [orgId],
  );
  return rows as Record<string, unknown>[];
}

async function exportSharedTenant(
  sql: postgres.Sql,
  orgId: string,
  memberUserIds: string[],
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};

  const [org] = await sql`
    select * from shared.organizations where id = ${orgId}
  `;
  out.organizations = org ? [org as Record<string, unknown>] : [];

  out.org_members = (await sql`
    select * from shared.org_members where org_id = ${orgId}
  `) as Record<string, unknown>[];

  if (await tableExists(sql, "shared", "nodo_id")) {
    out.nodo_id = (await sql`
      select * from shared.nodo_id where org_id = ${orgId}
    `) as Record<string, unknown>[];
  }

  if (memberUserIds.length > 0) {
    out.user_profiles = (await sql`
      select * from shared.user_profiles where id = any(${memberUserIds}::uuid[])
    `) as Record<string, unknown>[];
  } else {
    out.user_profiles = [];
  }

  if (await tableExists(sql, "shared", "feedback")) {
    out.feedback = await exportTableRows(sql, "shared", "feedback", orgId);
  }

  return out;
}

async function listStorageRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const stack = [prefix.replace(/\/$/, "")];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let offset = 0;
    const limit = 1000;

    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(current, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`Storage list failed (${bucket}/${current}): ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        const fullPath = current ? `${current}/${item.name}` : item.name;
        if (item.id == null) {
          stack.push(fullPath);
        } else {
          paths.push(fullPath);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  return paths;
}

async function collectStoragePaths(
  sql: postgres.Sql,
  supabase: SupabaseClient,
  orgId: string,
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {
    "org-branding": [],
    "org-documents": [],
    "property-expense-receipts": [],
    "property-photos": [],
  };

  result["org-branding"] = await listStorageRecursive(supabase, "org-branding", orgId);
  result["org-documents"] = await listStorageRecursive(supabase, "org-documents", orgId);
  result["property-expense-receipts"] = await listStorageRecursive(
    supabase,
    "property-expense-receipts",
    orgId,
  );

  const properties = await sql<{ id: string }[]>`
    select id::text as id from nodo_inmo.properties where org_id = ${orgId}
  `;
  const photoPaths = new Set<string>();
  for (const property of properties) {
    const files = await listStorageRecursive(supabase, "property-photos", property.id);
    for (const file of files) photoPaths.add(file);
  }
  result["property-photos"] = [...photoPaths];

  return result;
}

async function downloadStorageFiles(
  supabase: SupabaseClient,
  bucket: string,
  objectPaths: string[],
  baseDir: string,
): Promise<number> {
  let count = 0;
  for (const objectPath of objectPaths) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      throw new Error(`Download failed (${bucket}/${objectPath}): ${error?.message}`);
    }
    const dest = path.join(baseDir, "storage", bucket, objectPath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await data.arrayBuffer()));
    count++;
  }
  return count;
}

async function purgeOrgOperational(sql: postgres.Sql, orgId: string): Promise<void> {
  const deleteOrder: InmoTable[] = [...INMO_TABLES].reverse();
  for (const table of deleteOrder) {
    if (await tableExists(sql, "nodo_inmo", table)) {
      await sql.unsafe(`delete from nodo_inmo.${table} where org_id = $1`, [orgId]);
    }
  }
  if (await tableExists(sql, "shared", "feedback")) {
    await sql`delete from shared.feedback where org_id = ${orgId}`;
  }
}

async function insertRows(
  sql: postgres.Sql,
  schema: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  if (!(await tableExists(sql, schema, table))) return 0;

  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sql.unsafe(
      `insert into ${schema}.${table} select * from json_populate_recordset(null::${schema}.${table}, $1::json)`,
      [JSON.stringify(chunk)],
    );
    inserted += chunk.length;
  }
  return inserted;
}

async function restoreSharedTenant(
  sql: postgres.Sql,
  shared: Record<string, Record<string, unknown>[]>,
  targetOrgId: string,
): Promise<void> {
  const orgRows = shared.organizations ?? [];
  if (orgRows.length > 0) {
    const org = { ...orgRows[0], id: targetOrgId };
    await sql`
      insert into shared.organizations (id, name, tier, product, created_at)
      values (
        ${org.id as string},
        ${org.name as string},
        ${org.tier as string},
        ${(org.product as string) ?? "inmo"},
        ${org.created_at as string}
      )
      on conflict (id) do update set
        name = excluded.name,
        tier = excluded.tier,
        product = excluded.product
    `;
  }

  const orgScopedTables = ["org_members", "nodo_id", "feedback"] as const;
  for (const table of orgScopedTables) {
    const rows = shared[table];
    if (!rows?.length) continue;
    if (!(await tableExists(sql, "shared", table))) continue;

    await sql.unsafe(`delete from shared.${table} where org_id = $1`, [targetOrgId]);
    await insertRows(
      sql,
      "shared",
      table,
      rows.map((row) => ({ ...row, org_id: targetOrgId })),
    );
  }

  const profiles = shared.user_profiles ?? [];
  for (const profile of profiles) {
    await sql`
      insert into shared.user_profiles (id, full_name, avatar_url, created_at)
      values (
        ${profile.id as string},
        ${(profile.full_name as string | null) ?? null},
        ${(profile.avatar_url as string | null) ?? null},
        ${profile.created_at as string}
      )
      on conflict (id) do update set
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url
    `;
  }
}

async function uploadStorageDir(
  supabase: SupabaseClient,
  backupDir: string,
): Promise<number> {
  const storageRoot = path.join(backupDir, "storage");
  let uploaded = 0;

  for (const bucket of STORAGE_BUCKETS) {
    const bucketDir = path.join(storageRoot, bucket);
    let entries: string[] = [];
    try {
      entries = await readdir(bucketDir);
    } catch {
      continue;
    }
    if (entries.length === 0) continue;

    const files = await walkFiles(bucketDir);
    for (const absPath of files) {
      const rel = path.relative(bucketDir, absPath).split(path.sep).join("/");
      const body = await readFile(absPath);
      const { error } = await supabase.storage.from(bucket).upload(rel, body, {
        upsert: true,
        contentType: guessContentType(rel),
      });
      if (error) {
        throw new Error(`Upload failed (${bucket}/${rel}): ${error.message}`);
      }
      uploaded++;
    }
  }

  return uploaded;
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function guessContentType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return undefined;
  }
}

async function commandExport(
  sql: postgres.Sql,
  supabase: SupabaseClient,
  args: CliArgs,
): Promise<void> {
  const tenant = await resolveOrg(sql, args.email!, args.orgId);
  const outDir = path.resolve(args.output!);
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(outDir, "data"), { recursive: true });

  console.log(`Exporting org "${tenant.org_name}" (${tenant.org_id}) for ${args.email}`);

  const rowCounts: Record<string, number> = {};
  for (const table of INMO_TABLES) {
    const rows = await exportTableRows(sql, "nodo_inmo", table, tenant.org_id);
    rowCounts[`nodo_inmo.${table}`] = rows.length;
    await writeFile(
      path.join(outDir, "data", `nodo_inmo.${table}.json`),
      JSON.stringify(rows, null, 2),
    );
    console.log(`  nodo_inmo.${table}: ${rows.length} rows`);
  }

  const shared = await exportSharedTenant(sql, tenant.org_id, tenant.member_user_ids);
  for (const [table, rows] of Object.entries(shared)) {
    rowCounts[`shared.${table}`] = rows.length;
    await writeFile(
      path.join(outDir, "data", `shared.${table}.json`),
      JSON.stringify(rows, null, 2),
    );
    console.log(`  shared.${table}: ${rows.length} rows`);
  }

  let storageFiles = 0;
  if (!args.skipStorage) {
    console.log("Exporting Storage objects...");
    const pathsByBucket = await collectStoragePaths(sql, supabase, tenant.org_id);
    await writeFile(
      path.join(outDir, "storage-manifest.json"),
      JSON.stringify(pathsByBucket, null, 2),
    );
    for (const bucket of STORAGE_BUCKETS) {
      const paths = pathsByBucket[bucket] ?? [];
      if (paths.length === 0) continue;
      console.log(`  ${bucket}: ${paths.length} files`);
      storageFiles += await downloadStorageFiles(supabase, bucket, paths, outDir);
    }
  } else {
    console.log("Skipping Storage (--skip-storage).");
  }

  const manifest: Manifest = {
    version: 1,
    exported_at: new Date().toISOString(),
    email: args.email!,
    user_id: tenant.user_id,
    org_id: tenant.org_id,
    org_name: tenant.org_name,
    org_tier: tenant.org_tier,
    row_counts: rowCounts,
    storage_files: storageFiles,
    member_user_ids: tenant.member_user_ids,
  };

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nBackup written to ${outDir}`);
  console.log(`Total DB rows: ${Object.values(rowCounts).reduce((a, b) => a + b, 0)}`);
  console.log(`Storage files: ${storageFiles}`);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function commandInfo(args: CliArgs): Promise<void> {
  const inDir = path.resolve(args.input!);
  const manifest = await readJsonFile<Manifest>(path.join(inDir, "manifest.json"));
  console.log(JSON.stringify(manifest, null, 2));
}

async function commandRestore(
  sql: postgres.Sql,
  supabase: SupabaseClient,
  args: CliArgs,
): Promise<void> {
  const inDir = path.resolve(args.input!);
  const manifest = await readJsonFile<Manifest>(path.join(inDir, "manifest.json"));
  const targetOrgId = args.orgId ?? manifest.org_id;

  if (targetOrgId !== manifest.org_id) {
    console.warn(`Restoring into org ${targetOrgId} (backup source org was ${manifest.org_id}).`);
  }

  const [orgExists] = await sql`
    select 1 from shared.organizations where id = ${targetOrgId}
  `;
  if (!orgExists && !args.force) {
    throw new Error(
      `Organization ${targetOrgId} does not exist. Create the user/org first or pass --force to upsert organization row.`,
    );
  }

  console.log(`Restoring backup from ${manifest.exported_at}`);
  console.log(`Target org: ${targetOrgId} (${manifest.org_name})`);

  if (!args.noPurge) {
    console.log("Purging current operational data for target org...");
    await purgeOrgOperational(sql, targetOrgId);
  } else {
    console.log("Skipping purge (--no-purge). Inserts may fail if rows already exist.");
  }

  const shared: Record<string, Record<string, unknown>[]> = {};
  for (const table of ["organizations", "org_members", "nodo_id", "user_profiles", "feedback"]) {
    const file = path.join(inDir, "data", `shared.${table}.json`);
    try {
      shared[table] = await readJsonFile(file);
    } catch {
      shared[table] = [];
    }
  }

  if (args.force || !orgExists) {
    await restoreSharedTenant(sql, shared, targetOrgId);
  } else {
    for (const table of ["org_members", "nodo_id"] as const) {
      const rows = shared[table] ?? [];
      if (rows.length > 0 && (await tableExists(sql, "shared", table))) {
        await sql.unsafe(`delete from shared.${table} where org_id = $1`, [targetOrgId]);
        await insertRows(
          sql,
          "shared",
          table,
          rows.map((row) => ({ ...row, org_id: targetOrgId })),
        );
      }
    }
  }

  for (const table of INMO_TABLES) {
    const file = path.join(inDir, "data", `nodo_inmo.${table}.json`);
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await readJsonFile(file);
    } catch {
      rows = [];
    }
    const normalized = rows.map((row) => ({ ...row, org_id: targetOrgId }));
    const n = await insertRows(sql, "nodo_inmo", table, normalized);
    console.log(`  nodo_inmo.${table}: ${n} rows inserted`);
  }

  if (!args.skipStorage) {
    console.log("Uploading Storage objects...");
    const uploaded = await uploadStorageDir(supabase, inDir);
    console.log(`  ${uploaded} files uploaded`);
  } else {
    console.log("Skipping Storage (--skip-storage).");
  }

  console.log("\nRestore complete.");
  console.log("If the user was deleted from auth, recreate them and re-link org_members before logging in.");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === "info") {
    await commandInfo(args);
    return;
  }

  const DATABASE_URL = requireEnv("DATABASE_URL");
  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const sql = postgres(DATABASE_URL, { max: 1 });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (args.command === "export") {
      await commandExport(sql, supabase, args);
    } else {
      await commandRestore(sql, supabase, args);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
