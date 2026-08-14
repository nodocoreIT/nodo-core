import "server-only";

/**
 * Best-effort notifier for the n8n automation webhook. Never throws — a
 * missing URL or a failed request must not break the caller (same
 * fire-and-forget contract as the email helpers in lib/mail.ts).
 */
export async function notifyN8nWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ sent: boolean; error?: string }> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    return { sent: false, error: "N8N_WEBHOOK_URL not configured" };
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
