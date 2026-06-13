"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/panel/Topbar";
import KanbanBoard, { Task, Profile } from "@/components/panel/KanbanBoard";
import { createClient } from "@/lib/supabase/client";

export default function TareasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: tasksData }, { data: profilesData }, { data: unitsData }] = await Promise.all([
        supabase.from("tasks").select("*").order("position"),
        supabase.from("profiles").select("*"),
        supabase.from("units").select("code, name").order("sort"),
      ]);

      setTasks((tasksData ?? []) as Task[]);
      setProfiles((profilesData ?? []) as Profile[]);
      setUnits((unitsData ?? []).map((u: { code: string; name: string }) => u.code));
      setLoading(false);
    }

    load();
  }, []);

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Desarrollo del Core"
        title="Tareas del equipo"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar tareas..."
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
          />
        )}
      </div>
    </>
  );
}
