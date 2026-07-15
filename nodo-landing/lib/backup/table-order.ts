/**
 * FK dependency order constants for nodo_inmo backup and restore.
 *
 * Derived from the reverse of `purge_org_operational_data` delete order.
 * Parent tables must appear before their dependent children so that:
 *   - SELECT (backup): parents are serialized first → snapshot is self-consistent.
 *   - INSERT (restore): parents are inserted first → no FK violations.
 *
 * Purge delete order (leaf → root):
 *   cash_movements → property_expenses → owner_settlements → payments →
 *   contract_guarantors → documents → reclamos → tasks → contracts →
 *   properties → contacts → cash_accounts → conceptos → org_profiles →
 *   shared.feedback → shared.org_members (non-admin only)
 *
 * Backup/restore order (root → leaf, i.e. reverse of purge):
 *   shared.organizations → shared.org_members → nodo_inmo.org_profiles →
 *   nodo_inmo.conceptos → nodo_inmo.cash_accounts → nodo_inmo.contacts →
 *   nodo_inmo.properties → nodo_inmo.contracts → nodo_inmo.tasks →
 *   nodo_inmo.reclamos → nodo_inmo.documents → nodo_inmo.contract_guarantors →
 *   nodo_inmo.payments → nodo_inmo.owner_settlements →
 *   nodo_inmo.property_expenses → nodo_inmo.cash_movements → shared.feedback
 */

export interface TableEntry {
  schema: string;
  table: string;
  /** Column used to filter rows by org. Usually "org_id". */
  orgIdColumn: string;
}

/**
 * Ordered array of tables to SELECT during backup (and INSERT during restore).
 * Index 0 is the anchor/root table; index N is the most dependent leaf.
 *
 * shared.feedback is intentionally last: purge deletes it, so restore must
 * include it. It has an org_id FK via the user/org relationship.
 *
 * NOTE: shared.user_profiles does NOT exist in this DB. Org-member profile data
 * lives in nodo_core.profiles (not org-scoped, not backed up) and
 * nodo_inmo.org_profiles (included below). Do NOT add shared.user_profiles.
 */
export const NODO_INMO_BACKUP_ORDER: readonly TableEntry[] = [
  { schema: "shared",     table: "organizations",      orgIdColumn: "id" },
  { schema: "shared",     table: "org_members",         orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "org_profiles",        orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "conceptos",           orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "cash_accounts",       orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "contacts",            orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "properties",          orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "contracts",           orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "tasks",               orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "reclamos",            orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "documents",           orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "contract_guarantors", orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "payments",            orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "owner_settlements",   orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "property_expenses",   orgIdColumn: "org_id" },
  { schema: "nodo_inmo",  table: "cash_movements",      orgIdColumn: "org_id" },
  { schema: "shared",     table: "feedback",            orgIdColumn: "org_id" },
] as const;

/**
 * Restore order: identical to backup order.
 * Parents-first ordering guarantees no FK RESTRICT violations on INSERT.
 */
export const NODO_INMO_RESTORE_ORDER: readonly TableEntry[] = NODO_INMO_BACKUP_ORDER;

/**
 * Flag: shared.feedback is included in the backup because purge_org_operational_data
 * deletes feedback rows linked to org members. Restore must re-insert them.
 * Set to false and remove the shared.feedback entry from the arrays above if the
 * team decides feedback should NOT be backed up per org.
 */
export const PURGE_COVERS_SHARED_FEEDBACK = true;
