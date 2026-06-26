"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { clinicApi } from "@/lib/clinic/client-api";
import { cn } from "@/lib/utils";

interface NodoChatBellProps {
  isPro: boolean;
  onOpenChat?: () => void;
  /** En /medico/interconsultas el chat ya está visible en pantalla */
  chatEmbedded?: boolean;
}

function formatPreviewTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NodoChatBell({
  isPro,
  onOpenChat,
  chatEmbedded = false,
}: NodoChatBellProps) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<
    Array<{
      id: string;
      fromDoctorName: string;
      content: string;
      createdAt: string;
    }>
  >([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!isPro) {
      setCount(0);
      setItems([]);
      return;
    }
    try {
      const data = await clinicApi.getNodoChatUnread();
      setCount(data.count);
      setItems(data.items);
    } catch {
      setCount(0);
      setItems([]);
    }
  }, [isPro]);

  useEffect(() => {
    refresh();
    if (!isPro) return;
    const interval = setInterval(refresh, 20_000);
    const onRead = () => refresh();
    window.addEventListener("nodo-chat-read", onRead);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nodo-chat-read", onRead);
    };
  }, [isPro, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleOpenChat = async () => {
    setOpen(false);
    await clinicApi.markNodoChatRead();
    window.dispatchEvent(new CustomEvent("nodo-chat-read"));
    setCount(0);
    setItems([]);
    if (chatEmbedded) return;
    if (onOpenChat) {
      onOpenChat();
      return;
    }
    router.push("/medico/interconsultas");
  };

  if (!isPro) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full border border-mist bg-white text-navy shadow-sm transition-colors hover:border-brand/40 hover:text-brand",
          open && "border-brand/40 text-brand",
        )}
        aria-label={
          count > 0
            ? `${count} mensajes nuevos en Nodo Chat`
            : "Notificaciones de Nodo Chat"
        }
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[110] mt-2 w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-lg border border-mist bg-white shadow-xl">
          <div className="border-b border-mist bg-paper px-4 py-3">
            <p className="font-display text-sm font-bold text-navy">Nodo Chat</p>
            <p className="text-[11px] text-slate2">
              {count > 0
                ? `${count} mensaje${count === 1 ? "" : "s"} sin leer`
                : "No tenés mensajes nuevos"}
            </p>
          </div>

          {items.length > 0 ? (
            <ul className="max-h-52 overflow-y-auto divide-y divide-mist">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-2.5">
                  <p className="text-xs font-semibold text-navy truncate">
                    {item.fromDoctorName}
                  </p>
                  <p className="text-[11px] text-slate2 line-clamp-2 mt-0.5">
                    {item.content}
                  </p>
                  <p className="text-[10px] text-slate2/70 mt-1">
                    {formatPreviewTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-xs text-slate2">
              Cuando un colega te escriba, lo vas a ver acá.
            </p>
          )}

          <div className="border-t border-mist p-2">
            <button
              type="button"
              onClick={handleOpenChat}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              {chatEmbedded ? "Marcar como leído" : "Abrir chat"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
