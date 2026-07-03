import React, { useState, useEffect } from 'react';
import { ArrowLeft, Receipt, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { FormSelect, SearchableSelect } from '@nodocore/shared-components';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { useFinanzas } from '@/hooks/use-finanzas';
import { formatearMoneda, getFechaHoy } from '@/utils/formatters';
import toast from 'react-hot-toast';
import type { Tarjeta, RubroConsumo } from '@/types';

interface RegistroConsumoProps {
  onVolver: () => void;
  onGastoRegistrado?: (tarjetaId?: string) => void;
  tarjetaPreseleccionada?: Tarjeta | null;
}

export function RegistroConsumo({
  onVolver,
  onGastoRegistrado,
  tarjetaPreseleccionada,
}: RegistroConsumoProps) {
  const finanzas = useFinanzas();
  const [procesando, setProcesando] = useState(false);

  const [tarjetaId, setTarjetaId] = useState(tarjetaPreseleccionada?.id ?? '');
  const [fecha, setFecha] = useState(getFechaHoy());
  const [fechaCompra, setFechaCompra] = useState(getFechaHoy());
  const [lugar, setLugar] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [rubroCodigo, setRubroCodigo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [monto, setMonto] = useState(0);
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [cuotas, setCuotas] = useState(1);
  const [gastoFijo, setGastoFijo] = useState(false);
  const [cuotasDetalle, setCuotasDetalle] = useState<{ fecha: string; monto: number }[]>([]);

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa);

  // Recalculate installment preview whenever cuotas, fecha, or monto change
  useEffect(() => {
    if (cuotas <= 1) {
      setCuotasDetalle([]);
      return;
    }
    const montoPorCuota = monto > 0 ? monto / cuotas : 0;
    const detalle = Array.from({ length: cuotas }, (_, i) => {
      const d = new Date(`${fecha}T12:00:00`);
      d.setMonth(d.getMonth() + i);
      return {
        fecha: d.toISOString().slice(0, 10),
        monto: montoPorCuota,
      };
    });
    setCuotasDetalle(detalle);
  }, [cuotas, fecha, monto]);

  const opcionesCuotas = Array.from({ length: 24 }, (_, i) => ({
    value: i + 1,
    label: i === 0 ? '1 cuota (contado)' : `${i + 1} cuotas`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarjetaId || !lugar || !rubroId || monto <= 0) {
      toast.error('Completá todos los campos requeridos');
      return;
    }

    try {
      setProcesando(true);
      const codigoOperacion = crypto.randomUUID();

      if (cuotas > 1 && cuotasDetalle.length === cuotas) {
        // Use the (potentially edited) installment detail
        const promesas = cuotasDetalle.map((c, i) =>
          finanzas.agregarConsumo({
            tarjetaId,
            fecha: new Date(`${c.fecha}T12:00:00`).toISOString(),
            fechaCompra,
            lugar,
            rubro: (rubroCodigo || 'OTROS') as RubroConsumo,
            rubroId,
            detalle,
            importeARS: moneda === 'ARS' ? c.monto : 0,
            importeUSD: moneda === 'USD' ? c.monto : 0,
            cuotas: `${i + 1} de ${cuotas}`,
            cuotaActual: i + 1,
            totalCuotas: cuotas,
            gastoFijo,
            codigoOperacion,
          })
        );
        await Promise.all(promesas);
      } else {
        await finanzas.agregarConsumo({
          tarjetaId,
          fecha: new Date(`${fecha}T12:00:00`).toISOString(),
          fechaCompra,
          lugar,
          rubro: (rubroCodigo || 'OTROS') as RubroConsumo,
          rubroId,
          detalle,
          importeARS: moneda === 'ARS' ? monto : 0,
          importeUSD: moneda === 'USD' ? monto : 0,
          cuotas: '1 de 1',
          cuotaActual: 1,
          totalCuotas: 1,
          gastoFijo,
          codigoOperacion,
        });
      }

      toast.success('Consumo registrado correctamente');
      onGastoRegistrado?.(tarjetaId);
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el consumo');
    } finally {
      setProcesando(false);
    }
  };

  if (finanzas.loading && tarjetasActivas.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando tarjetas…</span>
      </div>
    );
  }

  if (tarjetasActivas.length === 0 && !finanzas.loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onVolver}>
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <h2 className="text-2xl font-bold text-ink">Registrar Gasto</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-mist p-8 text-center">
          <CreditCard className="w-16 h-16 text-slate2 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink mb-2">No hay tarjetas activas</h3>
          <p className="text-slate2 mb-4">Necesitás al menos una tarjeta activa para registrar gastos.</p>
          <Button variant="outline" onClick={onVolver}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-slate2">
        <button onClick={onVolver} className="hover:text-brand transition-colors">
          Mis Tarjetas
        </button>
        <span>/</span>
        <span className="text-ink font-medium">Registrar Gasto</span>
      </nav>

      <div className="flex items-center gap-3">
        <Receipt className="w-8 h-8 text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-ink">Registrar Nuevo Gasto</h1>
          <p className="text-slate2">Agrega un consumo a tu tarjeta de crédito</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tarjeta */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Tarjeta *</label>
              <SearchableSelect
                value={tarjetaId}
                onChange={setTarjetaId}
                options={tarjetasActivas.map((tarjeta) => ({
                  value: tarjeta.id,
                  label: `${tarjeta.nombre} — ${tarjeta.banco} (${tarjeta.titular})`,
                }))}
                allowEmpty
                emptyLabel="Seleccioná una tarjeta"
                searchPlaceholder="Buscar tarjeta..."
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Fecha de Compra *</label>
                <input
                  type="date"
                  value={fechaCompra}
                  onChange={(e) => {
                    setFechaCompra(e.target.value);
                    setFecha(e.target.value);
                  }}
                  className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Fecha de Cobro (Período) *</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </div>

            {/* Lugar */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Lugar *</label>
              <input
                type="text"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Ej: Supermercado Vea, YPF, Netflix"
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                required
              />
            </div>

            {/* Rubro */}
            <RubroSelector
              rubroId={rubroId}
              onChange={(rubro) => {
                setRubroId(rubro?.id ?? '');
                setRubroCodigo(rubro?.codigo ?? '');
              }}
              required
            />

            {/* Detalle */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Detalle</label>
              <input
                type="text"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Describe brevemente la compra..."
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {/* Monto y moneda */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <MoneyInput
                  label="Monto *"
                  value={monto}
                  onChange={setMonto}
                  moneda={moneda}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Moneda</label>
                <FormSelect
                  value={moneda}
                  onChange={(value) => setMoneda(value as 'ARS' | 'USD')}
                  options={[
                    { value: 'ARS', label: 'Pesos (ARS)' },
                    { value: 'USD', label: 'Dólares (USD)' },
                  ]}
                />
              </div>
            </div>

            {/* Cuotas */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Cuotas</label>
              <FormSelect
                value={String(cuotas)}
                onChange={(value) => setCuotas(parseInt(value, 10))}
                options={opcionesCuotas.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
            </div>

            {/* Installment preview */}
            {cuotas > 1 && cuotasDetalle.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-ink">Detalle de cuotas</label>
                  {monto > 0 && (
                    <span className="text-xs text-slate2">
                      Total: {formatearMoneda(monto, moneda)}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-mist overflow-hidden">
                  <div className="grid grid-cols-[2rem_1fr_1fr] gap-0 bg-mist/40 px-3 py-2 text-xs font-medium text-slate2">
                    <span>#</span>
                    <span>Fecha de cobro</span>
                    <span>Monto</span>
                  </div>
                  <div className="divide-y divide-mist max-h-72 overflow-y-auto">
                    {cuotasDetalle.map((c, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[2rem_1fr_1fr] gap-0 items-center px-3 py-2"
                      >
                        <span className="text-xs text-slate2 font-medium">{i + 1}</span>
                        <input
                          type="date"
                          value={c.fecha}
                          onChange={(e) => {
                            const next = [...cuotasDetalle];
                            next[i] = { ...next[i], fecha: e.target.value };
                            setCuotasDetalle(next);
                          }}
                          className="border border-mist rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand mr-2"
                        />
                        <MoneyInput
                          compact
                          value={c.monto}
                          onChange={(v) => {
                            const next = [...cuotasDetalle];
                            next[i] = { ...next[i], monto: v };
                            setCuotasDetalle(next);
                          }}
                          moneda={moneda}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {monto > 0 && (() => {
                  const sumaDetalle = cuotasDetalle.reduce((acc, c) => acc + c.monto, 0);
                  const diff = Math.abs(sumaDetalle - monto);
                  if (diff > 0.01) {
                    return (
                      <p className="text-xs text-amber-600">
                        La suma de las cuotas ({formatearMoneda(sumaDetalle, moneda)}) difiere del total ({formatearMoneda(monto, moneda)}).
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Gasto fijo */}
            <label className="flex items-start gap-3 p-4 bg-brand/5 rounded-lg border border-brand/20 cursor-pointer">
              <input
                type="checkbox"
                checked={gastoFijo}
                onChange={(e) => setGastoFijo(e.target.checked)}
                className="mt-1 w-4 h-4 text-brand border-mist rounded focus:ring-brand"
              />
              <div>
                <span className="text-sm font-medium text-ink">Gasto Fijo Mensual</span>
                <p className="text-xs text-slate2 mt-1">
                  Marcá esta opción para gastos recurrentes como suscripciones o servicios.
                </p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onVolver}
                className="flex-1"
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={procesando} className="flex-1">
                {procesando ? 'Registrando...' : 'Registrar Gasto'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
