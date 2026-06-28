import { create } from "zustand";
import { supabase } from "@/shared/lib/supabase";

// ─── EF invoker ──────────────────────────────────────────────────────────────

async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);

  if (error) {
    let detail = error.message;
    try {
      const responseBody = await (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      ).context?.json?.();
      if (responseBody?.error) detail = responseBody.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FinanzasStaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Pendiente";
}

interface FinanzasStaffStore {
  users: FinanzasStaffUser[];
  loading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  inviteUser: (
    name: string,
    email: string,
    role: string,
  ) => Promise<{ id: string; invited: boolean; emailSent?: boolean; emailWarning?: string }>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useFinanzasStaffStore = create<FinanzasStaffStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invokeFunction<{ members?: FinanzasStaffUser[] }>("list-org-members", {
        products: ["finanzas", "nodo-finanzas"],
      });
      const members = data.members ?? [];
      set({ users: members, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "No se pudieron cargar los usuarios",
      });
    }
  },

  inviteUser: async (name, email, role) => {
    const landingOrigin =
      import.meta.env.VITE_NODO_LANDING_URL?.replace(/\/$/, "") ||
      (typeof window !== "undefined" &&
      !/localhost|127\.0\.0\.1/i.test(window.location.origin)
        ? window.location.origin
        : "");

    const redirectTo = landingOrigin
      ? `${landingOrigin}/nodo-finanzas/login`
      : `${window.location.origin}/nodo-finanzas/login`;

    const {
      data: { user: callerUser },
    } = await supabase.auth.getUser();
    const inviterName =
      (callerUser?.user_metadata?.full_name as string | undefined)?.trim() ||
      callerUser?.email ||
      undefined;

    // Pass the DB role directly (e.g. "member") — not a display label.
    const data = await invokeFunction<{
      id: string;
      invited?: boolean;
      invitationToken?: string;
      emailSent?: boolean;
      emailWarning?: string;
    }>("invite-member", {
      name,
      email,
      role,
      redirectTo,
      inviterName,
      nodeLabel: "NODO | Finanzas",
      products: ["finanzas", "nodo-finanzas"],
    });

    await get().fetchMembers();
    return {
      id: data.id,
      invited: data.invited !== false,
      emailSent: data.emailSent,
      emailWarning: data.emailWarning,
    };
  },

  updateMemberRole: async (userId, role) => {
    await invokeFunction("update-org-member-role", {
      userId,
      role,
      products: ["finanzas", "nodo-finanzas"],
    });

    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, role } : u)),
    }));
  },

  removeMember: async (userId) => {
    await invokeFunction("remove-org-member", {
      userId,
      products: ["finanzas", "nodo-finanzas"],
    });

    set((state) => ({ users: state.users.filter((u) => u.id !== userId) }));
  },
}));

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFinanzasStaff() {
  const { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember } =
    useFinanzasStaffStore();
  return { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember };
}
