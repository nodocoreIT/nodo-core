"use client";

import { useState } from "react";
import { Loader2, RotateCcw, DatabaseBackup } from "lucide-react";
import { RestoreConfirmModal } from "./RestoreConfirmModal";
import type { RestoreReport } from "@/lib/backup/snapshot-restorer";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackupSnapshot {
  id: string;
  org_id: string;
  nodo: string;
  snapshot_path: string;
  row_counts: Record<string, number>;
  size_bytes: number;
  status: "completed" | "failed";
  triggered_by: "cron" | "manual";
  created_by: string | null;
  created_at: string;
  restored_at: string | null;
  restored_by: string | null;
}

interface BackupSnapshotTableProps {
  snapshots: BackupSnapshot[];
  onRefresh?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function totalRows(rowCounts: Record<string, number>): number {
  return Object.values(rowCounts).reduce((sum, n) => sum + n, 0);
}

function truncateId(id: string): string {
  return id.slice(0, 8) + "…";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BackupSnapshotTable({ snapshots, onRefresh }: BackupSnapshotTableProps) {
  const [backingUp, setBackingUp] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ id: string; report: RestoreReport } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBackupNow(snapshot: BackupSnapshot) {
    setBackingUp(snapshot.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/backups/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: snapshot.org_id, nodo: snapshot.nodo }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Backup fallido.");
      } else {
        onRefresh?.();
      }
    } catch {
      setError("Error de red al iniciar el backup.");
    } finally {
      setBackingUp(null);
    }
  }

  async function handleConfirmRestore(snapshotId: string, dryRun: boolean) {
    const res = await fetch("/api/admin/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot_id: snapshotId, dry_run: dryRun }),
    });
    const json = await res.json();
    setRestoreTarget(null);
    setRestoreResult({ id: snapshotId, report: json as RestoreReport });
    if (json.status === "success") {
      onRefresh?.();
    }
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay snapshots registrados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Org ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nodo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Filas</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tamaño</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Restaurado</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {snapshots.map((snap) => (
              <>
                <tr key={snap.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={snap.org_id}>
                    {truncateId(snap.org_id)}
                  </td>
                  <td className="px-4 py-3">{snap.nodo}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(snap.created_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalRows(snap.row_counts).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBytes(snap.size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {snap.restored_at ? formatDate(snap.restored_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        snap.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {snap.status === "completed" ? "Completado" : "Fallido"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleBackupNow(snap)}
                        disabled={backingUp === snap.id}
                        className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs font-medium transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand disabled:opacity-50"
                        title="Backup ahora"
                      >
                        {backingUp === snap.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <DatabaseBackup className="h-3 w-3" />
                        )}
                        Backup
                      </button>
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(snap)}
                        className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs font-medium transition-colors hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700"
                        title="Restaurar este snapshot"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restaurar
                      </button>
                    </div>
                  </td>
                </tr>

                {restoreResult?.id === snap.id && (
                  <tr key={`${snap.id}-result`}>
                    <td colSpan={8} className="px-4 py-3">
                      <RestoreResultInline report={restoreResult.report} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {restoreTarget && (
        <RestoreConfirmModal
          snapshot={restoreTarget}
          onConfirm={handleConfirmRestore}
          onClose={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Inline restore result ────────────────────────────────────────────────────

function RestoreResultInline({ report }: { report: RestoreReport }) {
  const isSuccess = report.status === "success";
  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <p className="mb-1 font-semibold">
        Restauración {report.dry_run ? "(dry run) " : ""}— {isSuccess ? "exitosa" : "fallida"}
        {" "}· {report.duration_ms}ms
      </p>
      {report.error && <p className="mb-1">Error: {report.error}</p>}
      <ul className="list-disc pl-4 space-y-0.5">
        {Object.entries(report.tables ?? {}).map(([table, r]) => (
          <li key={table}>
            <span className="font-mono">{table}</span>: {r.inserted} insertados,{" "}
            {r.skipped} omitidos
            {r.errors.length > 0 && (
              <span className="ml-1 text-red-600">({r.errors.join("; ")})</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1">
        Usuarios auth: {report.auth_users.created} creados,{" "}
        {report.auth_users.skipped} ya existían
      </p>
    </div>
  );
}
