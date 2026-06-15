"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { format } from "date-fns";

export function TranscriptionPanel() {
  const { transcriptionSegments, isTranscribing } = useConsultationStore();

  return (
    <div className="flex flex-col h-[320px]">
      <div className="flex items-center justify-between mb-3">
        <Badge
          variant="outline"
          className={
            isTranscribing
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 text-slate-500"
          }
        >
          {isTranscribing ? (
            <>
              <Mic className="h-3 w-3 mr-1 animate-pulse" />
              Transcribiendo
            </>
          ) : (
            <>
              <MicOff className="h-3 w-3 mr-1" />
              Inactivo
            </>
          )}
        </Badge>
      </div>

      <ScrollArea className="flex-1 pr-3">
        {transcriptionSegments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            La transcripción aparecerá aquí en tiempo real durante la consulta
          </p>
        ) : (
          <div className="space-y-2">
            {transcriptionSegments.map((segment, i) => (
              <div key={i} className="text-sm">
                <span className="text-xs text-slate-400 mr-2">
                  {format(new Date(segment.timestamp), "HH:mm:ss")}
                </span>
                <span className="text-slate-700">{segment.text}</span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
