"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import {
  BackupSnapshotTable,
  type BackupSnapshot,
} from "@/components/panel/BackupSnapshotTable";

export default function BackupsPage() {
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backups");
      const json = await res.json();
      if (json.ok) {
        setSnapshots(json.data as BackupSnapshot[]);
      } else {
        setError(json.error ?? "Error al cargar backups.");
      }
    } catch {
      setError("Error de red al cargar backups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Backups" breadcrumb="Nodo Core · Gestión" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Backups por organización</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshots de datos operativos por org. Los backups automáticos se ejecutan a las 02:00 UTC.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <BackupSnapshotTable snapshots={snapshots} onRefresh={loadSnapshots} />
        )}
      </div>
    </div>
  );
}
