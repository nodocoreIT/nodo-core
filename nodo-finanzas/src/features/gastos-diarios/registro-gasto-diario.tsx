// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { getFechaHoy, formatearMoneda } from '@/utils/formatters';
import { capitalizarDescripcion } from '@/utils/capitalizar-descripcion';
import type { FormaDePago, GastoDiario } from '@/types';

const schema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida'),
  detalle: z.string().optional(),
  monto: z.number().refine((n) => n !== 0, 'El monto no puede ser 0'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  rubroId: z.string().min(1, 'Seleccioná un rubro'),
  rubro: z.string().optional(),
  formaPago: z.enum(['EFECTIVO', 'DEBITO', 'TARJETA', 'TRANSFERENCIA BANCO', 'MERCADO_PAGO']),
  tarjetaId: z.string().optional(),
  cuentaId: z.string().optional(),
  cuotas: z.number().min(1).optional(),
  planId: z.string().optional(),
  prestamoId: z.string().optional(),
  pagoTarjetaId: z.string().optional(),
  gastoFijoId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onVolver: () => void;
  onGastoRegistrado?: () => void;
  gastoEditando?: GastoDiario | null;
  datosIniciales?: Partial<GastoDiario>;
}

const FORMAS_PAGO: Array<{ value: FormaDePago; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
  { value: 'TARJETA', label: 'Tarjeta de Crédito' },
  { value: 'DEBITO', label: 'Débito / Caja de Ahorro' },
  { value: 'TRANSFERENCIA BANCO', label: 'Transferencia Bancaria' },
];

export function RegistroGastoDiario({ onVolver, onGastoRegistrado, gastoEditando, datosIniciales }: Props) {
  const finanzas = useFinanzas();
  const { rubrosActivos } = useRubros();
  const [procesando, setProcesando] = useState(false);

  const defaults: FormData = gastoEditando
    ? {
        descripcion: gastoEditando.descripcion,
        detalle: gastoEditando.detalle ?? '',
        monto: gastoEditando.monto,
        fecha: gastoEditando.fecha,
        rubroId: gastoEditando.rubroId ?? '',
        rubro: gastoEditando.rubro ?? '',
        formaPago: gastoEditando.formaPago,
        tarjetaId: gastoEditando.tarjetaId ?? '',
        cuentaId: gastoEditando.cuentaId ?? '',
        cuotas: gastoEditando.cuotas ?? 1,
        planId: gastoEditando.planId ?? '',
        prestamoId: gastoEditando.prestamoId ?? '',
        pagoTarjetaId: gastoEditando.pagoTarjetaId ?? '',
        gastoFijoId: gastoEditando.gastoFijoId ?? '',
      }
    : {
        descripcion: datosIniciales?.descripcion ?? '',
        detalle: datosIniciales?.detalle ?? '',
        monto: datosIniciales?.monto ?? 0,
        fecha: datosIniciales?.fecha ?? getFechaHoy(),
        rubroId: datosIniciales?.rubroId ?? '',
        rubro: datosIniciales?.rubro ?? '',
        formaPago: (datosIniciales?.formaPago as FormaDePago) ?? 'MERCADO_PAGO',
        tarjetaId: datosIniciales?.tarjetaId ?? '',
        cuentaId: datosIniciales?.cuentaId ?? '',
        cuotas: 1,
        planId: datosIniciales?.planId ?? '',
        prestamoId: datosIniciales?.prestamoId ?? '',
        pagoTarjetaId: datosIniciales?.pagoTarjetaId ?? '',
        gastoFijoId: datosIniciales?.gastoFijoId ?? '',
      };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults });

  const formaPago = watch('formaPago');
  const cuotas = watch('cuotas') ?? 1;
  const monto = watch('monto') ?? 0;

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa);
  const cuentasActivas = finanzas.cuentas.filter((c) => c.activa);

  const norm = useCallback((s: string) => s.toLowerCase().replace(/\s/g, ''), []);

  // Compute auto-selections inline — instant, no effect delay
  const autoTarjetaId = useMemo(() => {
    // When editing, field.value takes priority (field.value || autoTarjetaId).
    // This fallback only applies when field.value is empty (e.g. older records without tarjetaId stored).
    const visibles = tarjetasActivas.filter((t) => !t.banco?.toLowerCase().includes('pampa'));
    return (
      visibles.find((t) => { const n = t.nombre.toLowerCase(); return n.includes('visa') || n.includes('santander'); })
      ?? visibles[0]
    )?.id ?? '';
  }, [tarjetasActivas]);

  const autoCuentaId = useMemo(() => {
    // Fallback only when field.value is empty (new records or old records without cuentaId).
    // Uses saldo IDs — same as gastos_diarios.cuenta_id FK references cuentas table.
    if (formaPago === 'EFECTIVO') return cuentasActivas.find((c) => norm(c.nombre).includes('efectivo'))?.id ?? '';
    if (formaPago === 'MERCADO_PAGO') return cuentasActivas.find((c) => { const n = norm(c.nombre); return n.includes('mercadopago') && !n.includes('reserva'); })?.id ?? '';
    if (formaPago === 'DEBITO' || formaPago === 'TRANSFERENCIA BANCO') return cuentasActivas.find((c) => { const n = norm(c.nombre); return n.includes('santander') && !n.includes('pampa'); })?.id ?? '';
    return '';
  }, [cuentasActivas, formaPago, norm]);
  const opcionesCuotas = Array.from({ length: 24 }, (_, i) => ({
    value: i + 1,
    label: i === 0 ? '1 cuota (contado)' : `${i + 1} cuotas`,
  }));


  async function onSubmit(data: FormData) {
    setProcesando(true);
    try {
      const effectiveTarjetaId = data.tarjetaId || autoTarjetaId;
      const effectiveCuentaId = data.cuentaId || autoCuentaId;

      if (data.formaPago === 'TARJETA' && !effectiveTarjetaId) {
        toast.error('Seleccioná una tarjeta para continuar');
        return;
      }

      const payload: Omit<GastoDiario, 'id'> = {
        descripcion: capitalizarDescripcion(data.descripcion),
        detalle: data.detalle || undefined,
        monto: data.monto,
        fecha: data.fecha,
        rubroId: data.rubroId,
        rubro: data.rubro || data.rubroId,
        formaPago: data.formaPago,
        tarjetaId: effectiveTarjetaId || undefined,
        cuentaId: effectiveCuentaId || undefined,
        cuotas: data.cuotas,
        planId: data.planId || undefined,
        prestamoId: data.prestamoId || undefined,
        pagoTarjetaId: data.pagoTarjetaId || undefined,
        gastoFijoId: data.gastoFijoId || undefined,
        codigoOperacion: gastoEditando?.codigoOperacion ?? crypto.randomUUID(),
      };

      if (gastoEditando) {
        await finanzas.actualizarGastoDiario(gastoEditando.id, payload);
        toast.success('Gasto actualizado');
      } else {
        await finanzas.agregarGastoDiario(payload);
        toast.success('Gasto registrado');
      }

      onGastoRegistrado?.();
      onVolver();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el gasto';
      toast.error(msg);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate2">
        <button onClick={onVolver} className="flex items-center gap-1 hover:text-brand transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Gastos Diarios
        </button>
        <span>/</span>
        <span className="text-ink font-medium">{gastoEditando ? 'Editar Gasto' : 'Nuevo Gasto'}</span>
      </nav>

      <Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Hidden fields */}
          <input type="hidden" {...register('planId')} />
          <input type="hidden" {...register('prestamoId')} />
          <input type="hidden" {...register('pagoTarjetaId')} />
          <input type="hidden" {...register('gastoFijoId')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Fecha"
              type="date"
              {...register('fecha')}
              error={errors.fecha?.message}
            />
            <Controller
              name="rubroId"
              control={control}
              render={({ field }) => (
                <RubroSelector
                  rubroId={field.value}
                  onChange={(r) => {
                    setValue('rubroId', r?.id ?? '');
                    setValue('rubro', r?.codigo ?? '');
                  }}
                  error={errors.rubroId?.message}
                  required
                />
              )}
            />
          </div>

          <Input
            label="Descripción"
            {...register('descripcion')}
            error={errors.descripcion?.message}
            placeholder="Ej: Almuerzo, Combustible, Supermercado"
          />

          <Input
            label="Notas (opcional)"
            {...register('detalle')}
            placeholder="Notas adicionales"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Controller
              name="monto"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  label="Monto"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.monto?.message}
                  required
                />
              )}
            />

            <Controller
              control={control}
              name="formaPago"
              render={({ field }) => (
                <Select
                  label="Forma de Pago"
                  options={FORMAS_PAGO}
                  error={errors.formaPago?.message}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    setValue('cuentaId', '');
                    setValue('tarjetaId', '');
                  }}
                  name={field.name}
                />
              )}
            />
          </div>

          {/* Tarjeta fields — always mounted so setValue fires reliably */}
          <div className={formaPago !== 'TARJETA' ? 'hidden' : 'grid grid-cols-1 md:grid-cols-2 gap-5'}>
            <Controller
              control={control}
              name="tarjetaId"
              render={({ field }) => (
                <Select
                  label="Tarjeta"
                  options={tarjetasActivas
                    .filter((t) => !t.banco?.toLowerCase().includes('pampa'))
                    .map((t) => ({
                      value: t.id,
                      label: t.nombre,
                    }))}
                  allowEmpty
                  emptyLabel="— Seleccioná una tarjeta —"
                  value={field.value || autoTarjetaId}
                  onChange={(e) => field.onChange(e.target.value)}
                  name={field.name}
                />
              )}
            />

            <Select
              label="Cuotas"
              options={opcionesCuotas.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
              {...register('cuotas', { valueAsNumber: true })}
            />
          </div>

          {/* Cuotas summary */}
          {formaPago === 'TARJETA' && cuotas > 1 && (
            <div className="bg-mist/40 p-4 rounded-xl border border-mist text-sm">
              <p className="font-semibold text-ink">Resumen de cuotas</p>
              <p className="text-slate2 mt-1">
                {cuotas} cuotas de {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto / cuotas)}
              </p>
            </div>
          )}

          {/* Account selector — always mounted so setValue fires reliably */}
          <div className={(formaPago === 'DEBITO' || formaPago === 'MERCADO_PAGO' || formaPago === 'EFECTIVO' || formaPago === 'TRANSFERENCIA BANCO') ? '' : 'hidden'}>
            <Controller
              control={control}
              name="cuentaId"
              render={({ field }) => (
                <Select
                  label="Cuenta origen"
                  options={cuentasActivas.map((c) => ({
                    value: c.id,
                    label: `${c.nombre} — ${new Intl.NumberFormat('es-AR').format(c.saldoActual)}`,
                  }))}
                  allowEmpty
                  emptyLabel="Seleccioná una cuenta"
                  value={field.value || autoCuentaId}
                  onChange={(e) => field.onChange(e.target.value)}
                  name={field.name}
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-mist">
            <Button type="button" variant="outline" onClick={onVolver} disabled={procesando}>
              Cancelar
            </Button>
            <Button type="submit" loading={procesando}>
              <Save className="h-4 w-4" />
              {gastoEditando ? 'Actualizar' : 'Registrar Gasto'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
