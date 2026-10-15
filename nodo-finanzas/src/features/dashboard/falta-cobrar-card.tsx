import { useState } from 'react';
import { HandCoins, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { formatearMoneda } from '@/utils/formatters';
import type { CobroPendiente } from './use-cobros-pendientes';

interface FaltaCobrarCardProps {
  items: CobroPendiente[];
  onChange: (next: CobroPendiente[]) => void;
}

export function FaltaCobrarCard({ items, onChange }: FaltaCobrarCardProps) {
  const [abierto, setAbierto] = useState(false);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState(0);
  const [montosEditados, setMontosEditados] = useState<Record<string, number>>({});

  function montoDe(item: CobroPendiente) {
    return montosEditados[item.id] ?? item.monto;
  }

  const total = items.reduce((sum, item) => sum + montoDe(item), 0);

  function cambiarMonto(id: string, value: number) {
    setMontosEditados((prev) => ({ ...prev, [id]: value }));
  }

  function confirmarMonto(id: string, value: number) {
    onChange(items.map((item) => (item.id === id ? { ...item, monto: value } : item)));
    setMontosEditados((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function cerrar() {
    const pendientes = Object.keys(montosEditados);
    if (pendientes.length > 0) {
      onChange(
        items.map((item) =>
          montosEditados[item.id] != null ? { ...item, monto: montosEditados[item.id] } : item,
        ),
      );
      setMontosEditados({});
    }
    setAbierto(false);
  }

  function agregar() {
    const nombre = concepto.trim();
    if (!nombre) {
      toast.error('Poné un concepto');
      return;
    }
    if (monto <= 0) {
      toast.error('El monto tiene que ser mayor a cero');
      return;
    }
    onChange([...items, { id: crypto.randomUUID(), concepto: nombre, monto }]);
    setConcepto('');
    setMonto(0);
  }

  function quitar(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl shadow-sm border border-lime-700 bg-lime-600 p-3 flex flex-col justify-between gap-1.5 text-left"
      >
        <div className="flex items-start gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
            <HandCoins className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Falta cobrar</p>
            <p className="text-[9px] font-bold text-white/70 mt-0.5">saldo a favor</p>
          </div>
        </div>
        <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(total)}</p>
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-mist">
              <div>
                <h3 className="text-base font-bold text-ink">Falta cobrar</h3>
                <p className="text-xs text-slate2 mt-0.5">Se suma al saldo disponible del mes</p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                className="p-1.5 rounded-lg text-slate2 hover:bg-mist transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {items.length === 0 ? (
                <p className="text-sm text-slate2 text-center py-4">Todavía no hay nada pendiente de cobro.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-mist last:border-0">
                      <p className="text-sm font-semibold text-ink truncate flex-1 min-w-0">{item.concepto}</p>
                      <div className="w-36 shrink-0">
                        <MoneyInput
                          compact
                          value={montoDe(item)}
                          onChange={(value) => cambiarMonto(item.id, value)}
                          onBlur={(value) => confirmarMonto(item.id, value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitar(item.id)}
                        className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <p className="text-sm font-bold text-ink text-right pt-1">Total {formatearMoneda(total)}</p>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-mist">
                <Input
                  label="Concepto"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  placeholder="Cuota moto vendida"
                />
                <MoneyInput label="Monto" value={monto} onChange={setMonto} />
                <Button type="button" className="w-full" onClick={agregar}>
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
