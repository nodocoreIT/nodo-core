import { useEffect, useState, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { useFinanzas } from '@/hooks/use-finanzas';
import toast from 'react-hot-toast';
import type { ConsumoTarjeta, RubroConsumo } from '@/types';

interface ModalEditarConsumoProps {
  open: boolean;
  consumo: ConsumoTarjeta | null;
  onSave: () => void;
  onCancel: () => void;
}

type InstallmentRow = {
  cuotaNum: number;
  existing: ConsumoTarjeta | null;
  fecha: string;
  monto: number;
};

export function ModalEditarConsumo({
  open,
  consumo,
  onSave,
  onCancel,
}: ModalEditarConsumoProps) {
  const finanzas = useFinanzas();
  const [saving, setSaving] = useState(false);

  // Shared fields (apply to all installments)
  const [lugar, setLugar] = useState('');
  const [fechaCompra, setFechaCompra] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [rubroCodigo, setRubroCodigo] = useState('');
  const [detalle, setDetalle] = useState('');

  // Simple mode (1 cuota)
  const [fecha, setFecha] = useState('');
  const [importeARS, setImporteARS] = useState(0);
  const [importeUSD, setImporteUSD] = useState(0);

  // Installment mode
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [cuotasDetalle, setCuotasDetalle] = useState<InstallmentRow[]>([]);

  const isInstallment = !!(consumo?.totalCuotas && consumo.totalCuotas > 1 && consumo.codigoOperacion);

  const siblings = useMemo(() => {
    if (!consumo?.codigoOperacion) return [];
    return finanzas.consumosTarjetas.filter(
      (c) => c.codigoOperacion === consumo.codigoOperacion
    );
  }, [consumo, finanzas.consumosTarjetas]);

  useEffect(() => {
    if (!consumo) return;

    setLugar(consumo.lugar);
    setFechaCompra(consumo.fechaCompra?.slice(0, 10) ?? consumo.fecha.slice(0, 10));
    setRubroId(consumo.rubroId ?? '');
    setRubroCodigo((consumo.rubro as string) ?? '');
    setDetalle(consumo.detalle ?? '');

    const totalCuotas = consumo.totalCuotas ?? 1;

    if (!isInstallment) {
      setFecha(consumo.fecha.slice(0, 10));
      setImporteARS(consumo.importeARS ?? 0);
      setImporteUSD(consumo.importeUSD ?? 0);
      setCuotasDetalle([]);
      return;
    }

    // Determine currency from any existing sibling (or from consumo itself)
    const detectedMoneda: 'ARS' | 'USD' =
      (consumo.importeUSD ?? 0) > 0 ? 'USD' : 'ARS';
    setMoneda(detectedMoneda);

    // Build a map of existing installments by cuota number
    const byNum = new Map(siblings.map((c) => [c.cuotaActual ?? 0, c]));

    // Find the reference to extrapolate dates for missing installments
    // Use the existing sibling with the lowest cuotaActual to derive cuota-1 date
    const sorted = [...siblings].sort((a, b) => (a.cuotaActual ?? 0) - (b.cuotaActual ?? 0));
    const earliest = sorted[0];

    const getBaseDate = (): Date => {
      if (!earliest) return new Date(`${consumo.fecha.slice(0, 10)}T12:00:00`);
      const d = new Date(earliest.fecha);
      d.setMonth(d.getMonth() - ((earliest.cuotaActual ?? 1) - 1));
      return d;
    };

    const baseDate = getBaseDate();
    const defaultMonto =
      detectedMoneda === 'ARS' ? (consumo.importeARS ?? 0) : (consumo.importeUSD ?? 0);

    const rows: InstallmentRow[] = Array.from({ length: totalCuotas }, (_, i) => {
      const num = i + 1;
      const existing = byNum.get(num) ?? null;

      if (existing) {
        return {
          cuotaNum: num,
          existing,
          fecha: existing.fecha.slice(0, 10),
          monto:
            detectedMoneda === 'ARS'
              ? (existing.importeARS ?? 0)
              : (existing.importeUSD ?? 0),
        };
      }

      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      return {
        cuotaNum: num,
        existing: null,
        fecha: d.toISOString().slice(0, 10),
        monto: defaultMonto,
      };
    });

    setCuotasDetalle(rows);
  }, [consumo, siblings, isInstallment]);

  if (!open || !consumo) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const totalCuotas = consumo.totalCuotas ?? 1;

      if (!isInstallment) {
        // Simple single-installment update
        await finanzas.actualizarConsumo(consumo.id, {
          lugar,
          fecha: new Date(`${fecha}T12:00:00`).toISOString(),
          fechaCompra,
          rubroId: rubroId || undefined,
          detalle,
          importeARS,
          importeUSD: importeUSD > 0 ? importeUSD : undefined,
        });
      } else {
        // Batch: update existing + create missing
        const ops = cuotasDetalle.map((row) => {
          const montoARS = moneda === 'ARS' ? row.monto : 0;
          const montoUSD = moneda === 'USD' ? row.monto : 0;
          const fechaISO = new Date(`${row.fecha}T12:00:00`).toISOString();

          if (row.existing) {
            return finanzas.actualizarConsumo(row.existing.id, {
              lugar,
              fechaCompra,
              fecha: fechaISO,
              rubroId: rubroId || undefined,
              detalle,
              importeARS: montoARS,
              importeUSD: montoUSD > 0 ? montoUSD : undefined,
            });
          }

          return finanzas.agregarConsumo({
            tarjetaId: consumo.tarjetaId,
            lugar,
            fechaCompra,
            fecha: fechaISO,
            rubro: (rubroCodigo || 'OTROS') as RubroConsumo,
            rubroId: rubroId || undefined,
            detalle,
            importeARS: montoARS,
            importeUSD: montoUSD > 0 ? montoUSD : undefined,
            cuotas: `${row.cuotaNum} de ${totalCuotas}`,
            cuotaActual: row.cuotaNum,
            totalCuotas,
            gastoFijo: consumo.gastoFijo ?? false,
            codigoOperacion: consumo.codigoOperacion,
          });
        });

        await Promise.all(ops);
      }

      toast.success('Consumo actualizado');
      onSave();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el consumo');
    } finally {
      setSaving(false);
    }
  };

  const missingCount = cuotasDetalle.filter((r) => !r.existing).length;
  const sumaDetalle = cuotasDetalle.reduce((acc, r) => acc + r.monto, 0);
  const totalOriginal = cuotasDetalle
    .filter((r) => r.existing)
    .reduce(
      (acc, r) =>
        acc + (moneda === 'ARS' ? (r.existing!.importeARS ?? 0) : (r.existing!.importeUSD ?? 0)),
      0
    );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-mist shrink-0">
          <div>
            <h3 className="text-lg font-bold text-ink">Editar Consumo</h3>
            {isInstallment && (
              <p className="text-xs text-slate2 mt-0.5">
                {consumo.totalCuotas} cuotas · {consumo.cuotas}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-mist transition-colors">
            <X className="w-5 h-5 text-slate2" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Shared fields */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">Lugar</label>
            <input
              type="text"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              className="border border-mist rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">Fecha de Compra</label>
            <input
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
              className="border border-mist rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <RubroSelector
            rubroId={rubroId}
            onChange={(rubro) => {
              setRubroId(rubro?.id ?? '');
              setRubroCodigo(rubro?.codigo ?? '');
            }}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">Detalle</label>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              className="border border-mist rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Simple mode: single fecha + monto */}
          {!isInstallment && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Fecha de Cobro</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="border border-mist rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MoneyInput
                  label="Importe ARS"
                  value={importeARS}
                  onChange={setImporteARS}
                  moneda="ARS"
                />
                <MoneyInput
                  label="Importe USD"
                  value={importeUSD}
                  onChange={setImporteUSD}
                  moneda="USD"
                />
              </div>
            </>
          )}

          {/* Installment mode: per-row fecha + monto */}
          {isInstallment && cuotasDetalle.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Cuotas</label>
                {missingCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    {missingCount} cuota{missingCount > 1 ? 's' : ''} sin registrar — se crearán al guardar
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-mist overflow-hidden">
                <div className="grid grid-cols-[2rem_1fr_1fr_auto] bg-mist/40 px-3 py-2 text-xs font-medium text-slate2">
                  <span>#</span>
                  <span>Fecha de cobro</span>
                  <span>Monto ({moneda})</span>
                  <span />
                </div>
                <div className="divide-y divide-mist max-h-56 overflow-y-auto">
                  {cuotasDetalle.map((row, i) => (
                    <div
                      key={row.cuotaNum}
                      className={`grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 px-3 py-2 ${
                        !row.existing ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <span className="text-xs text-slate2 font-medium">{row.cuotaNum}</span>
                      <input
                        type="date"
                        value={row.fecha}
                        onChange={(e) => {
                          const next = [...cuotasDetalle];
                          next[i] = { ...next[i], fecha: e.target.value };
                          setCuotasDetalle(next);
                        }}
                        className="border border-mist rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand w-full"
                      />
                      <MoneyInput
                        compact
                        value={row.monto}
                        onChange={(v) => {
                          const next = [...cuotasDetalle];
                          next[i] = { ...next[i], monto: v };
                          setCuotasDetalle(next);
                        }}
                        moneda={moneda}
                      />
                      {!row.existing ? (
                        <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">nuevo</span>
                      ) : (
                        <span className="w-8" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total summary */}
              <div className="flex justify-between text-xs text-slate2 px-1">
                <span>Total de cuotas</span>
                <span className="font-medium text-ink">
                  {moneda === 'ARS'
                    ? `$${sumaDetalle.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : `USD ${sumaDetalle.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-mist shrink-0">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}
