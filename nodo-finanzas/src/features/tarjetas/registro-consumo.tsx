import React, { useState } from 'react';
import { ArrowLeft, Receipt, CreditCard } from 'lucide-react';
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

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa);

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
      const montoNum = monto;
      const montoPorCuota = montoNum / cuotas;
      const codigoOperacion = crypto.randomUUID();

      await finanzas.agregarConsumo({
        tarjetaId,
        fecha: new Date(`${fecha}T12:00:00`).toISOString(),
        fechaCompra,
        lugar,
        rubro: (rubroCodigo || 'OTROS') as RubroConsumo,
        rubroId,
        detalle,
        importeARS: moneda === 'ARS' ? montoPorCuota : 0,
        importeUSD: moneda === 'USD' ? montoPorCuota : 0,
        cuotas: cuotas > 1 ? `1 de ${cuotas}` : '1 de 1',
        cuotaActual: 1,
        totalCuotas: cuotas,
        gastoFijo,
        codigoOperacion,
      });

      if (cuotas > 1) {
        const promesas = [];
        for (let i = 2; i <= cuotas; i++) {
          const fechaCuota = new Date(fecha);
          fechaCuota.setMonth(fechaCuota.getMonth() + (i - 1));
          promesas.push(
            finanzas.agregarConsumo({
              tarjetaId,
              fecha: fechaCuota.toISOString(),
              fechaCompra,
              lugar,
              rubro: (rubroCodigo || 'OTROS') as RubroConsumo,
              rubroId,
              detalle,
              importeARS: moneda === 'ARS' ? montoPorCuota : 0,
              importeUSD: moneda === 'USD' ? montoPorCuota : 0,
              cuotas: `${i} de ${cuotas}`,
              cuotaActual: i,
              totalCuotas: cuotas,
              gastoFijo,
              codigoOperacion,
            })
          );
        }
        await Promise.all(promesas);
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
              {cuotas > 1 && monto > 0 && (
                <p className="text-xs text-slate2 mt-1">
                  Se registrarán {cuotas} cuotas de{' '}
                  {formatearMoneda(monto / cuotas, moneda)}
                </p>
              )}
            </div>

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
