import { create } from "zustand";
import { supabase } from "@/shared/lib/supabase";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Pendiente";
}

const DEFAULT_USERS: MockUser[] = [
  {
    id: "1",
    name: "Ramiro Tule",
    email: "ramiro@nodoinmo.com",
    role: "Administrador",
    status: "Activo",
  },
  {
    id: "2",
    name: "Juan Colega",
    email: "juan@inmobiliaria.com",
    role: "Colega",
    status: "Activo",
  },
];

interface StaffStore {
  users: MockUser[];
  inviteUser: (name: string, email: string, role: string) => Promise<void>;
  resetUsers: () => void;
}

const getInitialUsers = (): MockUser[] => {
  try {
    const stored = localStorage.getItem("nodo-mock-users");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignored
  }
  return DEFAULT_USERS;
};

const persist = (users: MockUser[]) => {
  try {
    localStorage.setItem("nodo-mock-users", JSON.stringify(users));
  } catch {
    // Ignored
  }
};

export const useStaffStore = create<StaffStore>((set) => ({
  users: getInitialUsers(),

  inviteUser: async (name, email, role) => {
    // Optimistically add as Pendiente before the network call
    const tempId = `pending-${Date.now()}`;
    const pending: MockUser = { id: tempId, name, email, role, status: "Pendiente" };

    set((state) => {
      const next = [...state.users, pending];
      persist(next);
      return { users: next };
    });

    try {
      // redirectTo: where Supabase sends the user after clicking the invite link
      const redirectTo = `${window.location.origin}/inmo/auth/callback`;

      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { name, email, role, redirectTo },
      });

      if (error) {
        // Supabase wraps the real body in error.context — surface it
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {
          // ignore parse failures
        }
        throw new Error(detail);
      }

      // Replace the temp entry with the real user ID from Supabase
      const realId = (data as { id: string }).id;
      set((state) => {
        const next = state.users.map((u) =>
          u.id === tempId ? { ...u, id: realId } : u,
        );
        persist(next);
        return { users: next };
      });
    } catch (err) {
      // Rollback: remove the optimistic entry on failure
      set((state) => {
        const next = state.users.filter((u) => u.id !== tempId);
        persist(next);
        return { users: next };
      });
      throw err;
    }
  },

  resetUsers: () => {
    try {
      localStorage.removeItem("nodo-mock-users");
    } catch {
      // Ignored
    }
    set({ users: DEFAULT_USERS });
  },
}));

export function useStaff() {
  const { users, inviteUser, resetUsers } = useStaffStore();
  return { users, inviteUser, resetUsers };
}
