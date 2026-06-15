"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Users, Circle } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Peer = {
  id: string;
  fullName: string;
  specialty: string;
  online: boolean;
};

type ChatMessage = {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  toDoctorId: string | null;
  content: string;
  createdAt: string;
};

interface InterconsultPanelProps {
  currentDoctorId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InterconsultPanel({ currentDoctorId }: InterconsultPanelProps) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [{ doctors }, { messages: msgs }] = await Promise.all([
        clinicApi.getInterconsultPresence(),
        clinicApi.getInterconsultMessages(activePeerId),
      ]);
      setPeers(doctors);
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }, [activePeerId]);

  useEffect(() => {
    load();
    clinicApi.pingInterconsultPresence();
    const interval = setInterval(() => {
      clinicApi.pingInterconsultPresence();
      load();
    }, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await clinicApi.sendInterconsultMessage(text, activePeerId);
      setDraft("");
      await load();
    } finally {
      setSending(false);
    }
  };

  const onlineCount = peers.filter((p) => p.online).length;
  const channelLabel = activePeerId
    ? peers.find((p) => p.id === activePeerId)?.fullName ?? "Colega"
    : "Sala general";

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] rounded-md border border-border bg-white shadow-sm overflow-hidden">
      {/* Sidebar — colegas */}
      <aside className="hidden sm:flex w-56 lg:w-64 flex-col border-r border-border bg-paper shrink-0">
        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Colegas · {onlineCount} en línea
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActivePeerId(null)}
          className={cn(
            "mx-2 mt-2 flex items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm font-medium transition-colors",
            activePeerId === null
              ? "bg-brand text-white"
              : "text-navy hover:bg-mist",
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          Sala general
        </button>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {peers.map((peer) => (
            <button
              key={peer.id}
              type="button"
              onClick={() => setActivePeerId(peer.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-sm px-3 py-2.5 text-left transition-colors",
                activePeerId === peer.id
                  ? "bg-brand/10 text-brand"
                  : "text-navy hover:bg-mist",
              )}
            >
              <span className="relative shrink-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-[11px] font-bold text-white">
                  {peer.fullName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <Circle
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current stroke-white stroke-2",
                    peer.online ? "text-emerald-500" : "text-slate2/40",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">
                  {peer.fullName}
                </span>
                <span className="block text-[11px] text-slate2 truncate">
                  {peer.specialty}
                  {peer.online ? " · En línea" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat principal */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 bg-[#EEF3F8]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate2">
              Interconsultas
            </p>
            <h2 className="font-display font-bold text-navy">{channelLabel}</h2>
          </div>
          {/* Mobile channel picker */}
          <select
            className="sm:hidden text-sm border border-mist rounded-md px-2 py-1.5 bg-white text-navy"
            value={activePeerId ?? ""}
            onChange={(e) =>
              setActivePeerId(e.target.value ? e.target.value : null)
            }
          >
            <option value="">Sala general</option>
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} {p.online ? "●" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/50">
          {loading ? (
            <p className="text-sm text-slate2 text-center py-8">Cargando chat…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate2 text-center py-8">
              {activePeerId
                ? "Iniciá una consulta privada con tu colega."
                : "La sala general está lista. Escribí tu primera interconsulta."}
            </p>
          ) : (
            messages.map((msg) => {
              const mine = msg.fromDoctorId === currentDoctorId;
              return (
                <div
                  key={msg.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[70%] rounded-lg px-4 py-2.5 shadow-sm",
                      mine
                        ? "bg-brand text-white rounded-br-sm"
                        : "bg-white border border-mist text-ink rounded-bl-sm",
                    )}
                  >
                    {!mine && (
                      <p className="text-[11px] font-bold text-brand mb-0.5">
                        {msg.fromDoctorName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        mine ? "text-white/70" : "text-slate2",
                      )}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                activePeerId
                  ? "Consulta clínica a tu colega…"
                  : "Publicar en sala general de interconsultas…"
              }
              className="flex-1 rounded-md border border-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(218,90,14,.12)]"
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="bg-brand hover:bg-brand-600 text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate2 mt-2">
            Solo visible para médicos de la clínica. No reemplaza la historia clínica del paciente.
          </p>
        </div>
      </div>
    </div>
  );
}
