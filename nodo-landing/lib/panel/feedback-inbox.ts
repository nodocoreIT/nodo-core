import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_NODE_LABELS } from "./build-panel-notifications";

export type FeedbackCategory = "bug" | "idea" | "bloat" | "unknown";

const KNOWN_FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = ["bug", "idea", "bloat"];

/**
 * shared.feedback.category is a free string, not a schema-enforced enum —
 * never trust it as FeedbackCategory via a blind cast. Falls back to
 * "unknown" the same way categoryLabel/sourceNodeLabel fall back for
 * unmapped values below.
 */
function normalizeFeedbackCategory(value: string): FeedbackCategory {
  return (KNOWN_FEEDBACK_CATEGORIES as readonly string[]).includes(value)
    ? (value as FeedbackCategory)
    : "unknown";
}

/**
 * Cap on cross-schema reads against shared.feedback — matches the
 * .limit(500) precedent already used for cross-schema queries in
 * lib/panel/nodo-users-list.ts.
 */
const FEEDBACK_FETCH_LIMIT = 500;

export type FeedbackReplyStatus =
  | "pendiente"
  | "en_proceso"
  | "respondido"
  | "resuelto";

export type FeedbackReply = {
  id: string;
  body: string;
  status: FeedbackReplyStatus;
  createdAt: string;
  authorLabel: string;
};

export type FeedbackInboxRow = {
  id: string;
  category: FeedbackCategory;
  categoryLabel: string;
  content: string | null;
  sourceNode: string;
  sourceNodeLabel: string;
  orgId: string | null;
  orgName: string;
  userId: string | null;
  createdAt: string;
  read: boolean;
  readAt: string | null;
  status: FeedbackReplyStatus;
  replies: FeedbackReply[];
};

/** Raw row shapes as they come back from Supabase — kept narrow on purpose. */
export type RawFeedbackRow = {
  id: string;
  org_id: string | null;
  user_id: string | null;
  category: string;
  content: string | null;
  metadata: {
    source_node?: string;
    status?: string;
    replies?: Array<{
      id?: string;
      body?: string;
      status?: string;
      created_at?: string;
      author_label?: string;
    }>;
  } | null;
  created_at: string;
};

export type RawOrganizationRow = {
  id: string;
  name: string | null;
};

export type RawReadStateRow = {
  feedback_id: string;
  read_at: string | null;
};

export const ORG_NAME_FALLBACK = "Sin organización";

const REPLY_STATUSES: readonly FeedbackReplyStatus[] = [
  "pendiente",
  "en_proceso",
  "respondido",
  "resuelto",
];

export function normalizeFeedbackStatus(value: string | null | undefined): FeedbackReplyStatus {
  if (value && (REPLY_STATUSES as readonly string[]).includes(value)) {
    return value as FeedbackReplyStatus;
  }
  return "pendiente";
}

function parseReplies(
  raw: RawFeedbackRow["metadata"],
): FeedbackReply[] {
  const list = raw?.replies;
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => typeof r?.body === "string" && r.body.trim())
    .map((r, index) => ({
      id: typeof r.id === "string" && r.id ? r.id : `reply-${index}`,
      body: String(r.body).trim(),
      status: normalizeFeedbackStatus(r.status),
      createdAt: typeof r.created_at === "string" ? r.created_at : new Date(0).toISOString(),
      authorLabel:
        typeof r.author_label === "string" && r.author_label.trim()
          ? r.author_label.trim()
          : "Equipo Nodo",
    }));
}

/**
 * Pure merge — no I/O — so it can be unit tested without a DB. Joins
 * shared.feedback with shared.organizations and nodo_core.feedback_read_state
 * in JS (D2): the panel's admin client is scoped per-schema and these three
 * sources live in different schemas without a declared FK between them.
 */
export function mergeFeedbackInbox(
  feedback: RawFeedbackRow[],
  organizations: RawOrganizationRow[],
  readState: RawReadStateRow[],
): FeedbackInboxRow[] {
  const orgNameById = new Map(
    organizations.map((org) => [org.id, org.name?.trim() || ORG_NAME_FALLBACK]),
  );
  const readAtByFeedbackId = new Map(readState.map((r) => [r.feedback_id, r.read_at]));

  return feedback.map((row) => {
    const sourceNode = row.metadata?.source_node ?? "unknown";
    const isRead = readAtByFeedbackId.has(row.id);
    const replies = parseReplies(row.metadata);
    const statusFromMeta = normalizeFeedbackStatus(row.metadata?.status);
    const status =
      statusFromMeta !== "pendiente"
        ? statusFromMeta
        : replies.length > 0
          ? replies[replies.length - 1]?.status ?? "respondido"
          : "pendiente";

    return {
      id: row.id,
      category: normalizeFeedbackCategory(row.category),
      categoryLabel: FEEDBACK_CATEGORY_LABELS[row.category] ?? "Feedback",
      content: row.content ?? null,
      sourceNode,
      sourceNodeLabel: FEEDBACK_NODE_LABELS[sourceNode] ?? `NODO | ${sourceNode}`,
      orgId: row.org_id ?? null,
      orgName: row.org_id ? orgNameById.get(row.org_id) ?? ORG_NAME_FALLBACK : ORG_NAME_FALLBACK,
      userId: row.user_id ?? null,
      createdAt: row.created_at,
      read: isRead,
      readAt: isRead ? readAtByFeedbackId.get(row.id) ?? null : null,
      status,
      replies,
    };
  });
}

/**
 * Server-only data access: reads shared.feedback (capped at
 * FEEDBACK_FETCH_LIMIT — see nodo-users-list.ts precedent for the same
 * cross-schema cap), shared.organizations, and nodo_core.feedback_read_state,
 * then merges them. Must run behind requirePanelTeamMember() —
 * shared.feedback has no RLS policy for the panel, so this relies on the
 * service-role client (D1).
 */
export async function fetchFeedbackInbox(): Promise<FeedbackInboxRow[]> {
  const admin = createAdminClient();

  const [feedbackRes, orgRes, readStateRes] = await Promise.all([
    admin
      .schema("shared")
      .from("feedback")
      .select("id, org_id, user_id, category, content, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(FEEDBACK_FETCH_LIMIT),
    admin.schema("shared").from("organizations").select("id, name"),
    admin.from("feedback_read_state").select("feedback_id, read_at"),
  ]);

  if (feedbackRes.error) throw feedbackRes.error;
  if (orgRes.error) throw orgRes.error;
  if (readStateRes.error) throw readStateRes.error;

  return mergeFeedbackInbox(
    (feedbackRes.data ?? []) as RawFeedbackRow[],
    (orgRes.data ?? []) as RawOrganizationRow[],
    (readStateRes.data ?? []) as RawReadStateRow[],
  );
}

/**
 * Deletes a shared.feedback row and its associated read-state row (if any)
 * in nodo_core.feedback_read_state — irreversible, only reachable from the
 * panel behind requirePanelAdmin().
 *
 * Order matters: read_state first, then feedback. If the process gets
 * interrupted between the two calls (network blip, differing RLS between
 * schemas), leaving feedback_read_state deleted but shared.feedback intact
 * just means that row goes back to "unread" — a normal, harmless state.
 * The reverse order would leave an orphaned feedback_read_state row
 * pointing at an id that no longer exists, which is exactly the case the
 * error message would then lie about ("no se pudo borrar" when the
 * feedback row actually was deleted already).
 */
export async function deleteFeedback(id: string): Promise<void> {
  const admin = createAdminClient();

  const { error: readStateError } = await admin.from("feedback_read_state").delete().eq("feedback_id", id);
  if (readStateError) throw readStateError;

  const { error: feedbackError } = await admin.schema("shared").from("feedback").delete().eq("id", id);
  if (feedbackError) throw feedbackError;
}

/**
 * Append a Nodo reply to shared.feedback.metadata.replies and bump status.
 * Also marks the item read in feedback_read_state (panel inbox semantics).
 */
export async function replyToFeedback(options: {
  feedbackId: string;
  body: string;
  status: FeedbackReplyStatus;
  authorLabel?: string;
  readBy?: string | null;
}): Promise<FeedbackReply> {
  const admin = createAdminClient();
  const body = options.body.trim();
  if (!body) throw new Error("EMPTY_REPLY");

  const { data: row, error: fetchError } = await admin
    .schema("shared")
    .from("feedback")
    .select("id, metadata")
    .eq("id", options.feedbackId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!row) throw new Error("NOT_FOUND");

  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};

  const existingReplies = Array.isArray(metadata.replies) ? [...metadata.replies] : [];
  const reply = {
    id: crypto.randomUUID(),
    body,
    status: options.status,
    created_at: new Date().toISOString(),
    author_label: options.authorLabel?.trim() || "Equipo Nodo",
  };
  existingReplies.push(reply);

  const nextMetadata = {
    ...metadata,
    status: options.status,
    replies: existingReplies,
  };

  const { error: updateError } = await admin
    .schema("shared")
    .from("feedback")
    .update({ metadata: nextMetadata })
    .eq("id", options.feedbackId);

  if (updateError) throw updateError;

  const { error: readError } = await admin.from("feedback_read_state").upsert(
    {
      feedback_id: options.feedbackId,
      read_by: options.readBy ?? null,
      read_at: new Date().toISOString(),
    },
    { onConflict: "feedback_id" },
  );
  if (readError) throw readError;

  return {
    id: reply.id,
    body: reply.body,
    status: reply.status,
    createdAt: reply.created_at,
    authorLabel: reply.author_label,
  };
}

/**
 * Pure anti-join — no I/O — so it can be unit tested without a DB. Counts
 * shared.feedback ids that have no matching row in feedback_read_state by
 * real set comparison, not by subtracting counts (D3 fix): a naive
 * count(feedback) - count(read_state) diverges as soon as read_state has an
 * orphaned feedback_id (one with no matching shared.feedback row, possible
 * today since POST /read doesn't validate the id exists before upserting).
 */
export function countUnreadFeedback(feedbackIds: string[], readFeedbackIds: string[]): number {
  const readSet = new Set(readFeedbackIds);
  return feedbackIds.reduce((count, id) => (readSet.has(id) ? count : count + 1), 0);
}

/**
 * Server-only data access for the unread badge — mirrors fetchFeedbackInbox's
 * cap (FEEDBACK_FETCH_LIMIT) so the count matches the same universe of rows
 * the inbox list would show, and only selects id columns (not full rows) to
 * keep the query light. Must run behind requirePanelTeamMember().
 */
export async function fetchUnreadFeedbackCount(): Promise<number> {
  const admin = createAdminClient();

  const [feedbackRes, readStateRes] = await Promise.all([
    admin
      .schema("shared")
      .from("feedback")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(FEEDBACK_FETCH_LIMIT),
    admin.from("feedback_read_state").select("feedback_id"),
  ]);

  if (feedbackRes.error) throw feedbackRes.error;
  if (readStateRes.error) throw readStateRes.error;

  const feedbackIds = (feedbackRes.data ?? []).map((row) => row.id as string);
  const readFeedbackIds = (readStateRes.data ?? []).map((row) => row.feedback_id as string);

  return countUnreadFeedback(feedbackIds, readFeedbackIds);
}
