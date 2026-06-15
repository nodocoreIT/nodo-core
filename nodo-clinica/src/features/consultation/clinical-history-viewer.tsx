import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@nodocore/shared-components";
import { FileText, CalendarDays, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ClinicalRecord } from "@/types";

interface ClinicalHistoryViewerProps {
  records: ClinicalRecord[];
  isLoading?: boolean;
  onGenerateReport?: () => void;
}

export function ClinicalHistoryViewer({
  records,
  isLoading,
  onGenerateReport,
}: ClinicalHistoryViewerProps) {
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
                  <Badge variant="outline" className="text-xs shrink-0 border-slate-200">
                    {record.record_type}
                  </Badge>
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
    </div>
  );
}
