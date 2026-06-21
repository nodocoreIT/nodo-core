import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-accept any pending org invitations for the current user.
 * Called after login (password or magic-link) so the user is added
 * to org_members before entering the panel.
 */
export async function acceptPendingInvitations(supabase: SupabaseClient) {
  const { data: invitations } = await supabase
    .schema("shared")
    .from("org_invitations")
    .select("token")
    .eq("status", "pending");

  if (!invitations?.length) return;

  for (const inv of invitations) {
    await supabase.functions.invoke("accept-invitation", {
      body: { token: inv.token, action: "accept" },
    });
  }
}
