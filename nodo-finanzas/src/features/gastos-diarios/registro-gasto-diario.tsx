import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { useFinanzas } from '@/hooks/use-finanzas';
import { getFechaHoy } from '@/utils/formatters';
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

  // Auto-select account based on payment method
  useEffect(() => {
    if (gastoEditando) return;
    if (formaPago !== 'TARJETA') {
      const cuenta = finanzas.resolverCuentaDeSaldo(undefined, formaPago);
      if (cuenta) setValue('cuentaId', cuenta.id);
    }
  }, [formaPago, finanzas, setValue, gastoEditando]);

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa);
  const cuentasActivas = finanzas.cuentas.filter((c) => c.activa);
  const opcionesCuotas = Array.from({ length: 24 }, (_, i) => ({
    value: i + 1,
    label: i === 0 ? '1 cuota (contado)' : `${i + 1} cuotas`,
  }));

  async function onSubmit(data: FormData) {
    setProcesando(true);
    try {
      if (data.formaPago === 'TARJETA' && !data.tarjetaId) {
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
        tarjetaId: data.tarjetaId || undefined,
        cuentaId: data.cuentaId || undefined,
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
            label="Detalle / Notas (opcional)"
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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Forma de Pago</label>
              <select
                {...register('formaPago')}
                className="w-full px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white outline-none"
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {errors.formaPago && <p className="text-xs text-red-600">{errors.formaPago.message}</p>}
            </div>
          </div>

          {/* Tarjeta fields */}
          {formaPago === 'TARJETA' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Tarjeta <span className="text-red-500">*</span></label>
                <select
                  {...register('tarjetaId')}
                  className="w-full px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white outline-none"
                >
                  <option value="">— Seleccioná una tarjeta —</option>
                  {tarjetasActivas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre} - {t.banco}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink">Cuotas</label>
                <select
                  {...register('cuotas', { valueAsNumber: true })}
                  className="w-full px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white outline-none"
                >
                  {opcionesCuotas.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Cuotas summary */}
          {formaPago === 'TARJETA' && cuotas > 1 && (
            <div className="bg-mist/40 p-4 rounded-xl border border-mist text-sm">
              <p className="font-semibold text-ink">Resumen de cuotas</p>
              <p className="text-slate2 mt-1">
                {cuotas} cuotas de {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto / cuotas)}
              </p>
            </div>
          )}

          {/* Non-card account selector */}
          {(formaPago === 'DEBITO' || formaPago === 'MERCADO_PAGO' || formaPago === 'EFECTIVO' || formaPago === 'TRANSFERENCIA BANCO') && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink">Cuenta origen</label>
              <select
                {...register('cuentaId')}
                className="w-full px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white outline-none"
              >
                <option value="">Seleccioná una cuenta</option>
                {cuentasActivas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} — {new Intl.NumberFormat('es-AR').format(c.saldoActual)}</option>
                ))}
              </select>
            </div>
          )}

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
