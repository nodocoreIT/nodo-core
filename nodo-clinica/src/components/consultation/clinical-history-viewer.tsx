"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FileText, CalendarDays, Sparkles, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import type { ClinicalRecord } from "@/types";

interface ClinicalHistoryViewerProps {
  records: ClinicalRecord[];
  isLoading?: boolean;
  onGenerateReport?: () => void;
  /** Called after a record is successfully deleted, with the deleted id. */
  onDeleted?: (id: string) => void;
}

/** Record types the /api/clinic/clinical-records/pdf route knows how to render. */
const PDF_CAPABLE_TYPES = new Set(["receta", "estudio", "informe"]);

export function ClinicalHistoryViewer({
  records,
  isLoading,
  onGenerateReport,
  onDeleted,
}: ClinicalHistoryViewerProps) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<ClinicalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingRecord) return;
    setDeleting(true);
    try {
      await clinicApi.deleteClinicalRecord(deletingRecord.id);
      toast.success("Registro eliminado del historial");
      onDeleted?.(deletingRecord.id);
      setDeletingRecord(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Cargando historial...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onGenerateReport && (
        <Button
          size="sm"
          className="w-full bg-violet-700 hover:bg-violet-800"
          onClick={onGenerateReport}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Generar informe clínico
        </Button>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
          <FileText className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Sin registros previos</p>
          {onGenerateReport && (
            <p className="text-xs mt-1 text-center px-4">
              Usá el botón de arriba para crear un informe nuevo
            </p>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-sm font-medium text-slate-800 line-clamp-1">
                    {record.title}
                  </h4>
                  <div className="flex items-center gap-1 shrink-0">
                    {PDF_CAPABLE_TYPES.has(record.record_type) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                        title="Ver PDF"
                        onClick={() => setViewingId(record.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                      title="Eliminar"
                      onClick={() => setDeletingRecord(record)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(record.created_at), "dd MMM yyyy", {
                    locale: es,
                  })}
                  {record.doctor?.full_name && (
                    <span className="ml-2">· Dr/a. {record.doctor.full_name}</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-4 whitespace-pre-wrap">
                  {record.content}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={!!viewingId} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-2">
          <DialogTitle className="sr-only">Documento PDF</DialogTitle>
          {viewingId && (
            <iframe
              key={viewingId}
              src={`/api/clinic/clinical-records/pdf?id=${viewingId}`}
              title="Documento PDF"
              className="w-full flex-1 rounded-md border-0"
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingRecord}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
        title="¿Eliminar este registro?"
        description={
          deletingRecord
            ? `"${deletingRecord.title}" se va a borrar del historial del paciente. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
