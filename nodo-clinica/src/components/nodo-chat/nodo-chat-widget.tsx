"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  Search,
  Minus,
  X,
  Users,
  Inbox,
  Circle,
  Lock,
} from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { cn } from "@/lib/utils";
import type { NodoChatContact, NodoChatMessage } from "@/lib/nodo-chat/types";

type View = "menu" | "search" | "chat";

interface NodoChatWidgetProps {
  doctorId: string;
  doctorName: string;
  isPro: boolean;
  /** Pantalla completa (página /medico/interconsultas) vs popup flotante */
  embedded?: boolean;
  /** Control externo del popup (desde campanita del header) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMarkRead?: () => void;
  /** Abre directamente el chat con este colega (desde la campanita de notificaciones) */
  initialPeerId?: string | null;
  initialPeerName?: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const NODE_BADGE: Record<string, string> = {
  salud: "bg-brand/10 text-brand",
  inmo: "bg-navy/10 text-navy",
  legal: "bg-violet-100 text-violet-800",
  contable: "bg-slate-100 text-slate-700",
  obra: "bg-amber-100 text-amber-800",
};

export function NodoChatWidget({
  doctorId,
  doctorName,
  isPro,
  embedded = false,
  open: controlledOpen,
  onOpenChange,
  onMarkRead,
  initialPeerId,
  initialPeerName,
}: NodoChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(embedded);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) onOpenChange(value);
      else setInternalOpen(value);
    },
    [onOpenChange],
  );
  const [view, setView] = useState<View>("menu");
  const [searchSectionTitle, setSearchSectionTitle] = useState("Buscar colega Pro");
  const [contacts, setContacts] = useState<NodoChatContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeContact, setActiveContact] = useState<NodoChatContact | null>(
    null,
  );
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NodoChatMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const firstName = (doctorName ?? "").trim().split(/\s+/)[0] || "Colega";

  const loadMessages = useCallback(async () => {
    if (!isPro) return;
    try {
      const { messages: msgs, meId: id } = await clinicApi.getInterconsultMessages(
        activePeerId,
      );
      setMessages(msgs);
      setMeId(id);
    } finally {
      setLoading(false);
    }
  }, [activePeerId, isPro]);

  const loadContacts = useCallback(
    async (q = "") => {
      if (!isPro) return;
      try {
        const { contacts: list } = await clinicApi.searchNodoChatDirectory(q);
        setContacts(list as NodoChatContact[]);
      } catch {
        setContacts([]);
      }
    },
    [isPro],
  );

  useEffect(() => {
    if (!isPro || (!open && !embedded)) return;
    clinicApi.pingInterconsultPresence();
    loadContacts();
    const interval = setInterval(() => {
      clinicApi.pingInterconsultPresence();
      if (view === "search" || (view === "chat" && !activeContact)) {
        loadContacts(view === "search" ? searchQuery : "");
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [isPro, open, embedded, view, activeContact, searchQuery, loadContacts]);

  useEffect(() => {
    if (view === "chat") {
      setLoading(true);
      loadMessages();
      const interval = setInterval(loadMessages, 10_000);
      return () => clearInterval(interval);
    }
  }, [view, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const markConversationRead = useCallback(async () => {
    try {
      await clinicApi.markNodoChatRead();
      onMarkRead?.();
      window.dispatchEvent(new CustomEvent("nodo-chat-read"));
    } catch {
      /* ignore */
    }
  }, [onMarkRead]);

  useEffect(() => {
    if (!isPro || embedded) return;
    if (open && view === "chat") {
      void markConversationRead();
    }
  }, [isPro, embedded, open, view, markConversationRead]);

  useEffect(() => {
    if (!isPro || !embedded) return;
    void markConversationRead();
  }, [isPro, embedded, markConversationRead]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await clinicApi.sendInterconsultMessage(text, activePeerId);
      setDraft("");
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const openChatWith = (contact: NodoChatContact | null) => {
    if (contact) {
      setActiveContact(contact);
      setActivePeerId(contact.id);
    } else {
      setActiveContact(null);
      setActivePeerId(null);
    }
    setView("chat");
  };

  const goMenu = () => {
    setView("menu");
    setActiveContact(null);
    setActivePeerId(null);
  };

  const appliedInitialPeerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialPeerId || appliedInitialPeerRef.current === initialPeerId) return;
    appliedInitialPeerRef.current = initialPeerId;
    const match = contacts.find((c) => c.id === initialPeerId);
    openChatWith(
      match ?? {
        id: initialPeerId,
        fullName: initialPeerName ?? "Colega",
        role: "Médico",
        nodeSlug: "salud",
        nodeLabel: "Nodo Salud",
        plan: "pro",
        online: false,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeerId, initialPeerName, contacts]);

  if (!isPro) {
    if (embedded) {
      return (
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <Lock className="h-10 w-10 text-slate2 mx-auto mb-3" />
          <p className="font-display font-bold text-navy">Nodo Chat — Plan Pro</p>
          <p className="text-sm text-slate2 mt-2 max-w-md mx-auto">
            El chat interno del ecosistema está disponible para usuarios Pro de
            Nodo Clínica, Inmo y otros nodos. Actualizá tu plan para chatear con
            colegas de todo el ecosistema.
          </p>
        </div>
      );
    }
    return null;
  }

  const panel = (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-white shadow-2xl border border-mist",
        embedded
          ? "h-[calc(100vh-8rem)] min-h-[520px] rounded-md"
          : "fixed bottom-20 right-4 z-[100] w-[min(100vw-2rem,380px)] h-[min(78vh,560px)] rounded-xl",
      )}
    >
      {/* Header estilo Santander / Nodo */}
      <div className="flex items-center gap-3 bg-navy-900 text-white px-4 py-3 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold shrink-0">
          {initials("Nodo Chat")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm leading-tight">Nodo Chat</p>
          <p className="text-[11px] text-white/70 flex items-center gap-1">
            <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
            Ecosistema Pro · en línea
          </p>
        </div>
        {!embedded && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Minimizar"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                goMenu();
              }}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Sub-header (volver + título de sección) */}
      {(view === "chat" || view === "search") && (
        <div className="flex flex-col gap-1 px-3 py-2 border-b border-mist bg-paper shrink-0">
          <button
            type="button"
            onClick={goMenu}
            className="self-start text-xs text-brand font-semibold hover:underline"
          >
            ← Volver al menú
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">
              {view === "chat" ? (activeContact?.fullName ?? "Sala general") : searchSectionTitle}
            </p>
            {view === "chat" && activeContact && (
              <p className="text-[10px] text-slate2 flex items-center gap-1">
                <Circle
                  className={cn(
                    "h-2 w-2 fill-current",
                    activeContact.online ? "text-emerald-500" : "text-slate2/50",
                  )}
                />
                {activeContact.online
                  ? "Disponible ahora"
                  : "No disponible — mensaje quedará guardado"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Colegas del nodo — visible en la sala general */}
      {view === "chat" && !activeContact && contacts.length > 0 && (
        <div className="border-b border-mist bg-white px-3 py-2 shrink-0">
          <p className="text-[10px] font-semibold text-slate2 uppercase tracking-wide mb-1.5">
            Colegas de tu nodo ({contacts.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openChatWith(c)}
                className="flex flex-col items-center gap-1 shrink-0 w-14"
                title={c.fullName}
              >
                <span className="relative">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-white">
                    {initials(c.fullName)}
                  </span>
                  <Circle
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current stroke-white stroke-[2]",
                      c.online ? "text-emerald-500" : "text-slate2/40",
                    )}
                  />
                </span>
                <span className="text-[9px] text-slate2 truncate w-full text-center">
                  {c.fullName.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto bg-paper/30">
        {view === "menu" && (
          <div className="p-4">
            <div className="rounded-lg bg-navy-900 text-white p-4 mb-4">
              <p className="text-sm leading-relaxed">
                ¡Hola, {firstName}! Soy tu chat interno del ecosistema Nodo. 👋
              </p>
              <p className="text-[11px] text-white/70 mt-2">
                Conectá con colegas Pro de Salud, Inmo y más nodos.
              </p>
            </div>

            <div className="space-y-1">
              {[
                {
                  icon: Search,
                  label: "Buscar colega Pro",
                  sub: "Inmo, Salud, Legal…",
                  action: () => {
                    setSearchSectionTitle("Buscar colega Pro");
                    setView("search");
                    loadContacts("");
                  },
                },
                {
                  icon: Users,
                  label: "Sala general Salud",
                  sub: "Interconsultas del nodo",
                  action: () => openChatWith(null),
                },
                {
                  icon: Inbox,
                  label: "Mensajes dejados",
                  sub: "Para cuando no estén online",
                  action: () => {
                    setSearchSectionTitle("Mensajes dejados");
                    setView("search");
                    loadContacts("");
                  },
                },
              ].map(({ icon: Icon, label, sub, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="w-full flex items-center gap-3 rounded-md border border-mist bg-white px-4 py-3 text-left hover:border-brand/40 hover:shadow-sm transition-all"
                >
                  <Icon className="h-5 w-5 text-brand shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-navy">
                      {label}
                    </span>
                    <span className="block text-[11px] text-slate2">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "search" && (
          <div className="p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
              <input
                type="search"
                placeholder="Buscar por nombre, nodo o especialidad…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadContacts(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-2.5 rounded-md border border-mist text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              {contacts.length === 0 ? (
                <p className="text-sm text-slate2 text-center py-6">
                  No se encontraron colegas Pro.
                </p>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openChatWith(c)}
                    className="w-full flex items-center gap-2.5 rounded-md border border-mist bg-white p-2.5 text-left hover:border-brand/40 transition-all"
                  >
                    <span className="relative shrink-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-white">
                        {initials(c.fullName)}
                      </span>
                      <Circle
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current stroke-white stroke-[2]",
                          c.online ? "text-emerald-500" : "text-slate2/40",
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-navy truncate">
                          {c.fullName}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0",
                            NODE_BADGE[c.nodeSlug] ?? "bg-mist text-slate2",
                          )}
                        >
                          {c.nodeSlug}
                        </span>
                      </span>
                      <span className="block text-[10px] text-slate2 truncate">
                        {c.specialty ?? c.role}
                        {c.online ? " · En línea" : " · Dejar mensaje"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {view === "chat" && (
          <div className="p-3 space-y-2 min-h-[200px]">
            {!activeContact?.online && activeContact && (
              <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-900">
                {activeContact.fullName} no está conectado. Tu mensaje se
                entregará cuando ingrese al panel.
              </div>
            )}
            {loading ? (
              <p className="text-sm text-slate2 text-center py-8">Cargando…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate2 text-center py-8">
                {activeContact
                  ? `Iniciá la conversación con ${activeContact.fullName}.`
                  : "Sala general del nodo Salud. Escribí tu interconsulta."}
              </p>
            ) : (
              messages.map((msg) => {
                const mine = msg.fromDoctorId === meId;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-lg px-3 py-2 shadow-sm text-sm",
                        mine
                          ? "bg-brand text-white rounded-br-sm"
                          : "bg-white border border-mist text-ink rounded-bl-sm",
                      )}
                    >
                      {!mine && (
                        <p className="text-[10px] font-bold text-brand mb-0.5">
                          {msg.fromDoctorName}
                        </p>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <p
                        className={cn(
                          "text-[9px] mt-1",
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
        )}
      </div>

      {/* Input — solo en chat */}
      {view === "chat" && (
        <div className="border-t border-mist p-3 bg-white shrink-0">
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
                activeContact?.online === false
                  ? "Dejar mensaje para cuando se conecte…"
                  : "Escribí tu mensaje…"
              }
              className="flex-1 rounded-md border border-mist px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-600 disabled:opacity-50 shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return panel;

  return (
    <>
      {open && panel}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setView("menu");
          }}
          className="fixed bottom-4 right-4 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:bg-brand-600 hover:scale-105 active:scale-95 transition-all"
          aria-label="Abrir Nodo Chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
