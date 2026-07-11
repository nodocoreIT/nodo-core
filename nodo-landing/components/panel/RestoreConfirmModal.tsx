"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import type { BackupSnapshot } from "./BackupSnapshotTable";

// ─── Props ───────────────────────────────────────────────────────────────────

interface RestoreConfirmModalProps {
  snapshot: BackupSnapshot | null;
  onConfirm: (snapshotId: string, dryRun: boolean) => Promise<void>;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

export function RestoreConfirmModal({ snapshot, onConfirm, onClose }: RestoreConfirmModalProps) {
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!snapshot) return null;

  async function handleConfirm() {
    if (!snapshot) return;
    setLoading(true);
    try {
      await onConfirm(snapshot.id, dryRun);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <div>
            <h2 className="text-base font-semibold">Confirmar restauración</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta acción reemplazará los datos actuales con los del snapshot seleccionado.
            </p>
          </div>
        </div>

        {/* Snapshot details */}
        <div className="mb-4 rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Org ID</span>
            <span className="font-mono text-xs">{snapshot.org_id.slice(0, 16)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nodo</span>
            <span>{snapshot.nodo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span>{formatDate(snapshot.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total de filas</span>
            <span>{totalRows(snapshot.row_counts).toLocaleString("es-AR")}</span>
          </div>
        </div>

        {/* Dry run checkbox */}
        <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-brand"
          />
          <span>
            Dry run{" "}
            <span className="text-muted-foreground">
              (simular sin modificar datos)
            </span>
          </span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-sm border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-sm bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {dryRun ? "Simular restauración" : "Restaurar"}
          </button>
        </div>
      </div>
    </div>
  );
}
