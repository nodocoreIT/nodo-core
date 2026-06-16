import { useState } from 'react';
import { Bell, X, Calendar } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/hooks/use-notifications';

const URGENCIA_STYLES: Record<Notification['urgencia'], string> = {
  alta: 'border-l-red-500 bg-red-50/40',
  media: 'border-l-orange-400 bg-orange-50/30',
  baja: 'border-l-brand bg-white',
};

const URGENCIA_BADGE: Record<Notification['urgencia'], string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-orange-100 text-orange-700',
  baja: 'bg-mist text-brand',
};

const TIPO_LABEL: Record<Notification['tipo'], string> = {
  tarjeta: 'Tarjeta',
  prestamo: 'Préstamo',
  plan: 'Plan',
};

export function NotificationBell() {
  const { notifications, count } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full text-slate2 hover:text-navy hover:bg-mist transition-colors focus:outline-none"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[480px] flex flex-col bg-white rounded-xl shadow-lg border border-mist overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-mist bg-mist/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-navy">Próximos Vencimientos</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mist text-brand">
                  {count} pendiente{count !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate2 hover:text-navy transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-slate2">
                  <Bell className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Sin vencimientos próximos</p>
                  <p className="text-xs mt-1 text-center">Todo al día por ahora</p>
                </div>
              ) : (
                <ul className="divide-y divide-mist/50">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 border-l-4 transition-colors hover:bg-mist/20 ${URGENCIA_STYLES[n.urgencia]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${URGENCIA_BADGE[n.urgencia]}`}>
                              {TIPO_LABEL[n.tipo]}
                            </span>
                            {n.urgencia === 'alta' && (
                              <span className="text-[10px] font-black text-red-600 uppercase">Urgente</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-navy line-clamp-1">{n.titulo}</p>
                          <p className="text-xs text-slate2 line-clamp-2 mt-0.5">{n.mensaje}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate2">
                        <Calendar className="w-3 h-3" />
                        {n.fecha}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
