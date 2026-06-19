import { useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { autosDb } from "@/shared/lib/supabase";
import { useVehicleStore } from "@/store/vehicle-store";

export interface AutosStaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Pendiente";
}

const ROLE_DISPLAY: Record<string, string> = {
  administrador: "Administrador",
  vendedor: "Vendedor",
  marketing: "Marketing",
};

const ROLE_DB: Record<string, string> = {
  Administrador: "administrador",
  Vendedor: "vendedor",
  Marketing: "marketing",
};

interface AutosStaffStore {
  users: AutosStaffUser[];
  loading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  inviteUser: (name: string, email: string, role: string) => Promise<{ id: string; invited: boolean }>;
  updateMemberRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export const useAutosStaffStore = create<AutosStaffStore>((set) => ({
  users: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    const clienteId = useVehicleStore.getState().currentCliente?.id;
    if (!clienteId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await autosDb()
        .from("users")
        .select("id, email, name, role, is_activo")
        .eq("cliente_id", clienteId)
        .order("name", { ascending: true });

      if (error) throw error;

      const users: AutosStaffUser[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: ROLE_DISPLAY[row.role] ?? row.role,
        status: row.is_activo ? "Activo" : "Pendiente",
      }));

      set({ users, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "No se pudieron cargar los usuarios",
      });
    }
  },

  inviteUser: async (_name, _email, _role) => {
    throw new Error(
      "La invitación de usuarios en nodo Autos se habilitará próximamente. Contactá soporte para agregar miembros.",
    );
  },

  updateMemberRole: async (userId, role) => {
    const dbRole = ROLE_DB[role] ?? role.toLowerCase();
    const { error } = await autosDb().from("users").update({ role: dbRole }).eq("id", userId);
    if (error) throw new Error(error.message);

    set((state) => ({
      users: state.users.map((user) => (user.id === userId ? { ...user, role } : user)),
    }));
  },

  removeMember: async (userId) => {
    const { error } = await autosDb().from("users").delete().eq("id", userId);
    if (error) throw new Error(error.message);
    set((state) => ({ users: state.users.filter((user) => user.id !== userId) }));
  },
}));

export function useAutosStaff() {
  const { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember } =
    useAutosStaffStore();
  return { users, loading, error, fetchMembers, inviteUser, updateMemberRole, removeMember };
}

export function useSaveManualIpc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      throw new Error("Índices IPC no aplican en nodo Autos");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipc", "current"] });
    },
  });
}
