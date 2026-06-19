import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StaffUser } from "@nodocore/nodo-modules/settings";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dev: "Desarrollador",
  designer: "Diseñador",
  manager: "Gerente",
};

function toDisplayRole(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function usePanelStaff() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("created_at");
      if (queryError) throw queryError;
      setUsers(
        (data ?? []).map((row) => ({
          id: row.id,
          name: row.full_name ?? "Sin nombre",
          email: "",
          role: toDisplayRole(row.role ?? "dev"),
          status: "Activo" as const,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const inviteUser = useCallback(
    async (name: string, email: string, role: string, password?: string) => {
      if (!password?.trim()) throw new Error("La contraseña inicial es obligatoria.");
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Error al crear el usuario.");
      await fetchMembers();
      return { id: String(result.id), invited: false };
    },
    [fetchMembers],
  );

  const updateMemberRole = useCallback(
    async (userId: string, displayRole: string) => {
      const roleKey =
        Object.entries(ROLE_LABELS).find(([, label]) => label === displayRole)?.[0] ?? displayRole;
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: roleKey })
        .eq("id", userId);
      if (updateError) throw updateError;
      await fetchMembers();
    },
    [fetchMembers],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("profiles").delete().eq("id", userId);
      if (deleteError) throw deleteError;
      await fetchMembers();
    },
    [fetchMembers],
  );

  return {
    users,
    loading,
    error,
    fetchMembers,
    inviteUser,
    updateMemberRole,
    removeMember,
  };
}
