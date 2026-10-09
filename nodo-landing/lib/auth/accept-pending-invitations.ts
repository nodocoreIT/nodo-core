import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adds the signed-in user to org_members for any pending invite.
 * Must run on every login, not only `mode=activate-invite`, because after
 * setting a password the user often lands on the plain login form.
 */
export async function acceptPendingInvitations(supabase: SupabaseClient): Promise<void> {
  try {
    const { data: invitations } = await supabase.rpc("get_my_pending_invitations");
    if (!invitations?.length) return;
    for (const inv of invitations as { token: string }[]) {
      await supabase.functions.invoke("accept-invitation", {
        body: { token: inv.token, action: "accept" },
      });
    }
  } catch (e) {
    console.warn("accept-invitation:", e);
  }
}
