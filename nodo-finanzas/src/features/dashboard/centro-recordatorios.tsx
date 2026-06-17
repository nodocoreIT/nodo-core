import { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  X,
  Calendar,
  CreditCard,
  Wallet,
  ArrowRight,
  HandCoins,
  Edit2,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useFinanzas } from '@/hooks/use-finanzas';
import { calcularFechasTarjeta } from '@/utils/tarjeta-fechas';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import type { Tarjeta, Prestamo, PlanAhorro } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReminderItem {
  id: string;
  entityId: string;
  type: 'PRESTAMO' | 'PLAN_AHORRO' | 'TARJETA';
  title: string;
  amount: number;
  moneda: 'ARS' | 'USD';
  dueDate: string;
  daysLeft: number;
  isOverdue: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  onNavigate?: (page: string, params?: Record<string, unknown>) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CentroRecordatorios({ onNavigate }: Props) {
  const finanzas = useFinanzas();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dismissed_reminders');
      if (saved) setDismissedIds(JSON.parse(saved));
    } catch (_) {
      // ignore
    }
  }, []);

  function saveDismissed(ids: string[]) {
    setDismissedIds(ids);
    localStorage.setItem('dismissed_reminders', JSON.stringify(ids));
  }

  function handleDismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    saveDismissed([...dismissedIds, id]);
  }

  const reminders = useMemo<ReminderItem[]>(() => {
    const list: ReminderItem[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    // Préstamos
    finanzas.prestamos
      .filter((p: Prestamo) => p.activo && !p.pagado && !p.noCobrarCuota && !p.cuotaAbonada && p.fechaVencimiento)
      .forEach((p: Prestamo) => {
        const id = `PRESTAMO-${p.id}-${mesActual}`;
        if (dismissedIds.includes(id)) return;
        const vto = new Date(p.fechaVencimiento! + 'T12:00:00');
        vto.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 10) {
          list.push({
            id,
            entityId: p.id,
            type: 'PRESTAMO',
            title: p.concepto,
            amount: p.importeCuota || 0,
            moneda: p.moneda,
            dueDate: p.fechaVencimiento!,
            daysLeft: diff,
            isOverdue: diff < 0,
            priority: diff < 0 ? 'high' : diff <= 2 ? 'high' : 'medium',
          });
        }
      });

    // Planes de Ahorro
    finanzas.planesAhorro
      .filter((p: PlanAhorro) => p.activa && p.fechaVencimiento)
      .forEach((p: PlanAhorro) => {
        const id = `PLAN_AHORRO-${p.id}-${mesActual}`;
        if (dismissedIds.includes(id)) return;
        const vto = new Date(p.fechaVencimiento + 'T12:00:00');
        vto.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 10) {
          list.push({
            id,
            entityId: p.id,
            type: 'PLAN_AHORRO',
            title: p.detalle,
            amount: p.importeCuota,
            moneda: p.moneda,
            dueDate: p.fechaVencimiento,
            daysLeft: diff,
            isOverdue: diff < 0,
            priority: diff < 0 ? 'high' : diff <= 2 ? 'high' : 'medium',
          });
        }
      });

    // Tarjetas
    finanzas.tarjetas
      .filter((t: Tarjeta) => t.activa && t.diaVencimiento && t.diaCierre)
      .forEach((t: Tarjeta) => {
        const offset = ((t.diaVencimiento || 10) - (t.diaCierre || 20) + 30) % 30 || 14;
        const fechas = calcularFechasTarjeta({ closingDay: t.diaCierre!, dueOffsetDays: offset }, hoy);
        const vtoStr = fechas.currentDueDate;
        const id = `TARJETA-${t.id}-${vtoStr.substring(0, 7)}`;
        if (dismissedIds.includes(id)) return;
        const vto = new Date(vtoStr + 'T12:00:00');
        vto.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= -5 && diff <= 7) {
          list.push({
            id,
            entityId: t.id,
            type: 'TARJETA',
            title: `Resumen ${t.nombre}`,
            amount: 0,
            moneda: 'ARS',
            dueDate: vtoStr,
            daysLeft: diff,
            isOverdue: diff < 0,
            priority: diff < 0 ? 'high' : diff <= 2 ? 'high' : 'medium',
          });
        }
      });

    const pMap = { high: 3, medium: 2, low: 1 } as const;
    return list.sort((a, b) => {
      if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
      return a.daysLeft - b.daysLeft;
    });
  }, [finanzas.prestamos, finanzas.planesAhorro, finanzas.tarjetas, dismissedIds]);

  function getTypeIcon(type: ReminderItem['type']) {
    switch (type) {
      case 'PRESTAMO': return <HandCoins className="w-4 h-4 text-brand" />;
      case 'PLAN_AHORRO': return <Wallet className="w-4 h-4 text-slate2" />;
      case 'TARJETA': return <CreditCard className="w-4 h-4 text-orange-500" />;
    }
  }

  function getTypeLabel(type: ReminderItem['type']): string {
    switch (type) {
      case 'PRESTAMO': return 'Préstamo';
      case 'PLAN_AHORRO': return 'Plan Ahorro';
      case 'TARJETA': return 'Tarjeta';
    }
  }

  function handleAction(reminder: ReminderItem) {
    if (editingId) return;
    switch (reminder.type) {
      case 'PRESTAMO': onNavigate?.('prestamos'); break;
      case 'PLAN_AHORRO': onNavigate?.('planes-ahorro'); break;
      case 'TARJETA': onNavigate?.('tarjetas', { tarjetaId: reminder.entityId }); break;
    }
  }

  function startEditing(e: React.MouseEvent, reminder: ReminderItem) {
    e.stopPropagation();
    setEditingId(reminder.id);
    setEditValue(String(reminder.amount));
  }

  function cancelEditing(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
  }

  async function saveEdit(e: React.MouseEvent, reminder: ReminderItem) {
    e.stopPropagation();
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) return;
    try {
      if (reminder.type === 'PLAN_AHORRO') {
        await finanzas.actualizarPlanAhorro(reminder.entityId, { importeCuota: newValue });
      } else if (reminder.type === 'PRESTAMO') {
        await finanzas.actualizarPrestamo(reminder.entityId, { importeCuota: newValue });
      }
      setEditingId(null);
    } catch (err) {
      console.error('Error updating amount', err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-navy flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand" />
          Próximos Vencimientos
        </h2>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${reminders.length > 0 ? 'text-brand bg-mist' : 'text-slate2 bg-mist/30'}`}>
          {reminders.length} pendiente{reminders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white rounded-xl border-2 border-dashed border-mist">
          <div className="p-4 bg-mist rounded-full mb-4">
            <Check className="w-8 h-8 text-brand" />
          </div>
          <p className="text-navy font-bold text-lg">Todo al día</p>
          <p className="text-slate2 text-sm">Sin recordatorios pendientes por ahora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.slice(0, 6).map((reminder) => (
            <div
              key={reminder.id}
              className={`group relative overflow-hidden transition-all hover:shadow-md border-l-4 cursor-pointer active:scale-[0.98] rounded-xl shadow-sm border border-mist ${
                reminder.isOverdue
                  ? 'border-l-red-500 bg-red-50/30'
                  : reminder.priority === 'high'
                  ? 'border-l-orange-400 bg-orange-50/20'
                  : 'border-l-brand bg-white'
              }`}
              onClick={() => handleAction(reminder)}
            >
            <Card className="border-0 shadow-none rounded-none bg-transparent p-4">
              <button
                onClick={(e) => handleDismiss(reminder.id, e)}
                className="absolute top-2 right-2 p-1 text-slate2/40 hover:text-slate2 hover:bg-mist rounded-full opacity-0 group-hover:opacity-100 transition-all"
                title="Ocultar recordatorio"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-mist/50 rounded-lg">
                      {getTypeIcon(reminder.type)}
                    </div>
                    <span className="text-[10px] font-bold text-slate2 uppercase tracking-tighter">
                      {getTypeLabel(reminder.type)}
                    </span>
                  </div>
                  {reminder.isOverdue ? (
                    <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase">
                      Vencido
                    </span>
                  ) : reminder.daysLeft === 0 ? (
                    <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded uppercase">
                      Hoy
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-brand bg-mist px-2 py-0.5 rounded uppercase">
                      en {reminder.daysLeft}d
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-navy group-hover:text-brand transition-colors line-clamp-1">
                    {reminder.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {editingId === reminder.id ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-2 py-1 text-sm font-bold border border-brand rounded outline-none focus:ring-1 focus:ring-brand"
                        />
                        <button
                          onClick={(e) => saveEdit(e, reminder)}
                          className="p-1 bg-brand text-white rounded hover:bg-brand-dark shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 bg-mist text-slate2 rounded hover:bg-mist/70 shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-navy">
                          {reminder.type === 'TARJETA'
                            ? 'Ver Resumen'
                            : formatearMoneda(reminder.amount, reminder.moneda)}
                        </p>
                        {reminder.type !== 'TARJETA' && (
                          <button
                            onClick={(e) => startEditing(e, reminder)}
                            className="p-1 text-slate2/40 hover:text-brand hover:bg-mist rounded transition-all opacity-0 group-hover:opacity-100"
                            title="Actualizar importe"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-mist/50">
                  <div className="flex items-center gap-1.5 text-xs text-slate2">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatearFecha(reminder.dueDate)}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate2/30 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
