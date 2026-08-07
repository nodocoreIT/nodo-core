"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/panel/Topbar";
import KanbanBoard, { Task, Profile } from "@/components/panel/KanbanBoard";
import { createClient } from "@/lib/supabase/client";

/**
 * Unidades activas del tablero (crear / filtrar). Orden alfabético (es).
 * El resto de nodos queda fuera hasta que se reactiven.
 */
const ACTIVE_TASK_UNITS = ["Clínica", "Dashboard", "Inmo", "Landing"] as const;

export default function TareasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [units, setUnits] = useState<string[]>([...ACTIVE_TASK_UNITS]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: tasksData }, { data: profilesData }] = await Promise.all([
        supabase.from("tasks").select("*").order("position"),
        supabase.from("profiles").select("*"),
      ]);

      // profiles.avatar_url is a storage PATH in the private "panel-branding"
      // bucket, not a directly-usable URL — resolve to signed URLs here,
      // same reason as app/panel/layout.tsx and the Equipo page. Without
      // this, AssigneeAvatar's <img src> just 404s instead of falling back
      // to the initials circle.
      const rawProfiles = (profilesData ?? []) as Profile[];
      const avatarPaths = rawProfiles
        .map((p) => p.avatar_url)
        .filter((path): path is string => !!path);

      let resolvedProfiles = rawProfiles;
      if (avatarPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from("panel-branding")
          .createSignedUrls(avatarPaths, 3600);
        const urlByPath = new Map<string, string>();
        for (const item of signedUrls ?? []) {
          if (item.path && item.signedUrl && !item.error) urlByPath.set(item.path, item.signedUrl);
        }
        resolvedProfiles = rawProfiles.map((p) => ({
          ...p,
          avatar_url: p.avatar_url ? urlByPath.get(p.avatar_url) ?? null : null,
        }));
      }

      setTasks((tasksData ?? []) as Task[]);
      setProfiles(resolvedProfiles);
      setUnits([...ACTIVE_TASK_UNITS]);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Desarrollo del Core"
        title="Tareas del equipo"
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "var(--color-slate2)", fontSize: 14 }}>Cargando tareas...</p>
          </div>
        ) : (
          <KanbanBoard
            initialTasks={tasks}
            profiles={profiles}
            units={units}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}
      </div>
    </>
  );
}
