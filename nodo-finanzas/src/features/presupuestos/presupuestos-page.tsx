import { useState } from 'react';
import { Plus, Pencil, Target, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Spinner } from '@/components/ui/spinner';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { usePresupuestos } from '@/hooks/use-presupuestos';
import { formatearMoneda } from '@/utils/formatters';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import { barraColor, textoColor } from './presupuesto-colors';
import type { Rubro } from '@/types';

function mesActualLabel(): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function PresupuestosPage() {
  const { presupuestos, loading, actualizarPresupuesto } = usePresupuestos();
  const totalAsignado = presupuestos.reduce((sum, p) => sum + p.presupuesto, 0);

  const [formAbierto, setFormAbierto] = useState(false);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<Rubro | null>(null);
  const [monto, setMonto] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  function abrirNuevo() {
    setEditandoId(null);
    setRubroSeleccionado(null);
    setMonto(0);
    setFormAbierto(true);
  }

  function abrirEditar(rubro: Rubro) {
    setEditandoId(rubro.id);
    setRubroSeleccionado(rubro);
    setMonto(rubro.presupuestoMensual ?? 0);
    setFormAbierto(true);
  }

  function cerrarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setRubroSeleccionado(null);
    setMonto(0);
  }

  async function handleGuardar() {
    if (!rubroSeleccionado) {
      toast.error('Seleccioná un rubro');
      return;
    }
    if (monto <= 0) {
      toast.error('El presupuesto debe ser mayor a 0');
      return;
    }

    setGuardando(true);
    const ok = await actualizarPresupuesto(rubroSeleccionado.id, monto);
    setGuardando(false);

    if (ok) {
      toast.success(
        editandoId
          ? 'Presupuesto actualizado'
          : `Presupuesto asignado a ${normalizarCodigoRubro(rubroSeleccionado.nombre)}`,
      );
      cerrarForm();
    } else {
      toast.error('No se pudo guardar el presupuesto');
    }
  }

  async function handleQuitar(rubro: Rubro) {
    const ok = await actualizarPresupuesto(rubro.id, null);
    if (ok) {
      toast.success('Presupuesto eliminado');
      if (editandoId === rubro.id) cerrarForm();
    } else {
      toast.error('No se pudo eliminar el presupuesto');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate2">
            Tope de gasto por rubro · {mesActualLabel()}
          </p>
          {presupuestos.length > 0 && (
            <p className="text-sm mt-1">
              <span className="text-slate2">Total asignado: </span>
              <span className="font-bold text-ink">{formatearMoneda(totalAsignado)}</span>
            </p>
          )}
        </div>
        {!formAbierto && (
          <Button onClick={abrirNuevo} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Asignar presupuesto
          </Button>
        )}
      </div>

      {formAbierto && (
        <Card title={editandoId ? 'Editar presupuesto' : 'Asignar presupuesto'}>
          <div className="space-y-4 max-w-md">
            <RubroSelector
              rubroId={rubroSeleccionado?.id}
              onChange={(rubro) => {
                setRubroSeleccionado(rubro);
                if (rubro?.presupuestoMensual != null && rubro.presupuestoMensual > 0) {
                  setMonto(rubro.presupuestoMensual);
                  setEditandoId(rubro.id);
                } else if (!editandoId) {
                  setMonto(0);
                }
              }}
              required
            />
            <MoneyInput
              label="Presupuesto mensual (ARS)"
              value={monto}
              onChange={setMonto}
              moneda="ARS"
              required
            />
            <div className="flex gap-2 pt-1">
              <Button onClick={handleGuardar} loading={guardando}>
                {editandoId ? 'Guardar cambios' : 'Asignar'}
              </Button>
              <Button variant="outline" onClick={cerrarForm} disabled={guardando}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {presupuestos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 gap-3 text-center">
            <Target className="h-10 w-10 text-brand/50" />
            <p className="text-sm font-semibold text-ink">Sin presupuestos asignados</p>
            <p className="text-xs text-slate2 max-w-sm">
              Asigná un tope mensual a un rubro para seguir el gasto del mes y recibir avisos
              cuando te acerques o lo superes.
            </p>
            {!formAbierto && (
              <Button onClick={abrirNuevo} variant="outline" className="mt-2 gap-2">
                <Plus className="h-4 w-4" />
                Asignar el primero
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {presupuestos.map(({ rubro, presupuesto, gastado, porcentaje, excedido }) => (
            <Card
              key={rubro.id}
              className={excedido ? 'border-red-200 ring-1 ring-red-100' : undefined}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-ink truncate">
                      {rubro.emoji} {normalizarCodigoRubro(rubro.nombre)}
                    </p>
                    {excedido && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wide text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" />
                        Excedido
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirEditar(rubro)}
                      aria-label="Editar presupuesto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleQuitar(rubro)}
                      aria-label="Quitar presupuesto"
                      className="text-slate2 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate2">Gastado</span>
                  <span className={`font-semibold ${textoColor(porcentaje, excedido)}`}>
                    {formatearMoneda(gastado)}
                    <span className="text-slate2 font-normal"> / {formatearMoneda(presupuesto)}</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate2">Consumo del mes</span>
                    <span className={`font-medium ${textoColor(porcentaje, excedido)}`}>
                      {porcentaje.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-mist overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${barraColor(porcentaje, excedido)}`}
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                  </div>
                  {excedido && (
                    <p className="text-xs text-red-600 font-medium pt-0.5">
                      +{formatearMoneda(gastado - presupuesto)} sobre el tope
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
