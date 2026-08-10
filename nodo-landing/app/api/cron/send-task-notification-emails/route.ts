import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTaskNotificationEmail } from "@/lib/mail";
import { collectAssigneeIds, describeTaskNotification, type TaskNotificationRow } from "@/lib/panel/task-notification-copy";

/**
 * GET /api/cron/send-task-notification-emails
 *
 * Vercel Cron handler — sends the email leg of the Jira-style task
 * notifications (see nodo_core.task_notifications, populated by the
 * tasks_notify_participants trigger on nodo_core.tasks). The in-app bell +
 * realtime toast (hooks/use-panel-notifications.ts) is instant; this cron
 * just sweeps whatever hasn't been emailed yet, so a slower cron interval is
 * an acceptable tradeoff — it's a backup channel, not the primary one.
 *
 * Claims rows atomically (UPDATE ... WHERE email_sent_at IS NULL, then only
 * acts on whatever the UPDATE actually returned) before sending anything, so
 * an overlapping/slow run can't double-email the same row. If a send fails
 * after a row is claimed, that row is accepted as a rare drop rather than
 * retried — duplicate emails are worse UX than an occasional missed one for
 * a backup channel.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */

const TASK_NOTIFICATION_SELECT =
  "id, type, old_value, new_value, recipient_id, task:tasks!task_notifications_task_id_fkey(title), actor:profiles!task_notifications_actor_id_fkey(full_name)";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const db = createAdminClient("nodo_core");
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nodocore.com.ar").replace(/\/$/, "");

  const { data: pendingIds, error: pendingError } = await db
    .from("task_notifications")
    .select("id")
    .is("email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (pendingError) {
    return NextResponse.json({ ok: false, error: pendingError.message }, { status: 500 });
  }
  if (!pendingIds || pendingIds.length === 0) {
    return NextResponse.json({ ok: true, pending: 0, sent: 0, skippedDismissed: 0, errors: [] });
  }

  const { data: claimedRaw, error: claimError } = await db
    .from("task_notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .in("id", pendingIds.map((r) => r.id))
    .is("email_sent_at", null)
    .select(TASK_NOTIFICATION_SELECT);

  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 });
  }

  const claimed = (claimedRaw ?? []) as unknown as TaskNotificationRow[];

  // Don't email something the recipient already saw and dismissed in-app
  // within the cron's window — for a "Jira-style" feature, that reads as
  // noise, not polish.
  const { data: dismissedRows } = await db
    .from("dismissed_panel_notifications")
    .select("notification_id")
    .in(
      "notification_id",
      claimed.map((row) => `task-event-${row.id}`),
    )
    .eq("deleted", false);
  const dismissedIds = new Set((dismissedRows ?? []).map((d) => d.notification_id as string));

  const toSend = claimed.filter((row) => !dismissedIds.has(`task-event-${row.id}`));
  const skippedDismissed = claimed.length - toSend.length;

  const assigneeIds = collectAssigneeIds(toSend);
  let profileNameById = new Map<string, string>();
  if (assigneeIds.size > 0) {
    const { data: assigneeProfiles } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(assigneeIds));
    profileNameById = new Map(
      (assigneeProfiles ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Alguien"]),
    );
  }

  // Batch-resolve recipient emails once instead of one admin API call per
  // row — auth.users isn't exposed via the regular schema client, so
  // listUsers() (paginated) is the bulk alternative to getUserById().
  const recipientIds = new Set(toSend.map((row) => row.recipient_id));
  const emailByUserId = new Map<string, string>();
  let page = 1;
  while (emailByUserId.size < recipientIds.size) {
    const { data: usersPage, error: usersError } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (usersError || !usersPage || usersPage.users.length === 0) break;
    for (const u of usersPage.users) {
      if (u.email && recipientIds.has(u.id)) emailByUserId.set(u.id, u.email);
    }
    if (usersPage.users.length < 200) break;
    page++;
  }

  let sent = 0;
  const errors: Array<{ notification_id: string; error: string }> = [];

  for (const row of toSend) {
    try {
      const email = emailByUserId.get(row.recipient_id);
      if (!email) throw new Error("recipient has no email on auth.users");

      const { description } = describeTaskNotification(row, profileNameById);

      await sendTaskNotificationEmail({
        to: email,
        taskTitle: row.task?.title ?? "una tarea",
        type: row.type,
        description,
        origin,
      });

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ notification_id: row.id, error: message });
      console.error(`[cron/send-task-notification-emails] notification ${row.id} failed:`, message);
    }
  }

  const summary = { ok: true, pending: claimed.length, sent, skippedDismissed, errors };
  console.log("[cron/send-task-notification-emails] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
