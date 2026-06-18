import { create } from "zustand";
import { supabase } from "@/shared/lib/supabase";
import { dbRoleFromDisplay } from "@/shared/lib/org-member-roles";
import { readJwtClaims } from "@/shared/lib/jwt-claims";

async function resolveOrgId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const orgId = readJwtClaims(session).orgId;
  if (!orgId) throw new Error("No se pudo determinar la organización");
  return orgId;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Pendiente";
}

interface StaffStore {
  users: StaffUser[];
  loading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  inviteUser: (name: string, email: string, role: string) => Promise<{ id: string; invited: boolean }>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export const useStaffStore = create<StaffStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("list-org-members");
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      const members = (data as { members?: StaffUser[] })?.members ?? [];
      set({ users: members, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "No se pudieron cargar los usuarios",
      });
    }
  },

  inviteUser: async (name, email, role) => {
    const redirectTo = `${window.location.origin}/inmo/auth/callback`;

    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { name, email, role, redirectTo },
    });

    if (error) {
      let detail = error.message;
      try {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
        if (body?.error) detail = body.error;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    await get().fetchMembers();
    const payload = data as { id: string; invited?: boolean };
    return { id: payload.id, invited: payload.invited !== false };
  },

  updateMemberRole: async (userId, role) => {
    const orgId = await resolveOrgId();

    const dbRole = dbRoleFromDisplay(role);
    const { error } = await supabase
      .schema("shared")
      .from("org_members")
      .update({ role: dbRole })
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, role } : u)),
    }));
  },

  removeMember: async (userId) => {
    const orgId = await resolveOrgId();

    const { error } = await supabase
      .schema("shared")
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
    }));
  },
}));

export function useStaff() {
  const { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember } =
    useStaffStore();
  return { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember };
}
