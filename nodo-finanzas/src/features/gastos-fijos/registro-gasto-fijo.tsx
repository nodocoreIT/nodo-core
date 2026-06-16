import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Copy, Calculator } from 'lucide-react';
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
import { obtenerFechaActual } from '@/utils/formatters';
import { capitalizarDescripcion } from '@/utils/capitalizar-descripcion';
import type { GastoFijo } from '@/types';

const schema = z.object({
  rubroId: z.string().min(1, 'Seleccioná un rubro'),
  etiqueta: z.string().optional(),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  moneda: z.enum(['ARS', 'USD']),
  formaDePago: z.enum(['EFECTIVO', 'DEBITO', 'TARJETA', 'TRANSFERENCIA BANCO', 'MERCADO_PAGO']),
  tarjetaId: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  planId: z.string().optional(),
  prestamoId: z.string().optional(),
  pagoTarjetaId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onVolver: () => void;
  onGastoRegistrado?: () => void;
  gastoEditando?: GastoFijo | null;
  esDuplicacion?: boolean;
}

const FORMAS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'DEBITO', label: 'Débito Automático' },
  { value: 'TARJETA', label: 'Tarjeta de Crédito' },
  { value: 'TRANSFERENCIA BANCO', label: 'Transferencia Bancaria' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
];

const MONEDAS = [
  { value: 'ARS', label: 'Pesos Argentinos (ARS)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

export function RegistroGastoFijo({ onVolver, onGastoRegistrado, gastoEditando, esDuplicacion = false }: Props) {
  const finanzas = useFinanzas();
  const [loading, setLoading] = useState(false);

  const emptyDefaults: FormData = {
    rubroId: '',
    etiqueta: '',
    descripcion: '',
    monto: 0,
    moneda: 'ARS',
    formaDePago: 'DEBITO',
    tarjetaId: '',
    cuentaBancariaId: '',
    planId: '',
    prestamoId: '',
    pagoTarjetaId: '',
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: emptyDefaults });

  useEffect(() => {
    if (gastoEditando) {
      reset({
        rubroId: gastoEditando.rubroId ?? '',
        etiqueta: gastoEditando.etiqueta ?? '',
        descripcion: gastoEditando.descripcion,
        monto: gastoEditando.monto,
        moneda: gastoEditando.moneda,
        formaDePago: gastoEditando.formaDePago,
        tarjetaId: gastoEditando.tarjetaId ?? '',
        cuentaBancariaId: gastoEditando.cuentaBancariaId ?? '',
        planId: gastoEditando.planId ?? '',
        prestamoId: gastoEditando.prestamoId ?? '',
        pagoTarjetaId: gastoEditando.pagoTarjetaId ?? '',
      });
    } else {
      reset(emptyDefaults);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastoEditando, esDuplicacion]);

  const formaDePago = watch('formaDePago');
  const moneda = watch('moneda');

  // Auto-select cuenta bancaria based on payment method
  useEffect(() => {
    if (gastoEditando) return;
    const cuentasBancarias = finanzas.configuracion.cuentasBancarias;
    if (formaDePago === 'MERCADO_PAGO') {
      const mp = cuentasBancarias.find((c) =>
        c.activa && c.nombre.toLowerCase().includes('mercado pago')
      );
      if (mp) setValue('cuentaBancariaId', mp.id);
    } else if (formaDePago === 'DEBITO' || formaDePago === 'TRANSFERENCIA BANCO') {
      const santander = cuentasBancarias.find((c) =>
        c.activa && c.nombre.toLowerCase().includes('santander')
      );
      if (santander) setValue('cuentaBancariaId', santander.id);
    }
  }, [formaDePago, finanzas.configuracion.cuentasBancarias, setValue, gastoEditando]);

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa).map((t) => ({
    value: t.id,
    label: `${t.nombre} - ${t.titular}`,
  }));

  const cuentasBancariasActivas = finanzas.configuracion.cuentasBancarias
    .filter((c) => c.activa)
    .map((c) => ({ value: c.id, label: c.nombre }));

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = {
        ...data,
        descripcion: capitalizarDescripcion(data.descripcion),
        planId: data.planId || undefined,
        prestamoId: data.prestamoId || undefined,
        pagoTarjetaId: data.pagoTarjetaId || undefined,
        tarjetaId: data.tarjetaId || undefined,
        cuentaBancariaId: data.cuentaBancariaId || undefined,
        etiqueta: data.etiqueta || undefined,
      };

      if (gastoEditando && !esDuplicacion) {
        await finanzas.actualizarGastoFijo(gastoEditando.id, payload);
        toast.success('Gasto fijo actualizado');
      } else {
        await finanzas.agregarGastoFijo({
          ...payload,
          activo: true,
          fechaCreacion: obtenerFechaActual('iso'),
        });
        toast.success(esDuplicacion ? 'Gasto duplicado' : 'Gasto fijo creado');
      }

      onGastoRegistrado?.();
      onVolver();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el gasto fijo';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const titulo = esDuplicacion
    ? 'Duplicar Gasto Fijo'
    : gastoEditando
    ? 'Editar Gasto Fijo'
    : 'Nuevo Gasto Fijo';

  const isLoading = loading || isSubmitting;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate2">
        <button onClick={onVolver} className="flex items-center gap-1 hover:text-brand transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Gastos Fijos
        </button>
        <span>/</span>
        <span className="text-ink font-medium">{titulo}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        {esDuplicacion ? (
          <Copy className="h-7 w-7 text-brand" />
        ) : (
          <Calculator className="h-7 w-7 text-brand" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-ink">{titulo}</h1>
          <p className="text-sm text-slate2">
            {esDuplicacion
              ? 'Creá una copia con los mismos datos'
              : gastoEditando
              ? 'Modificá los datos del gasto'
              : 'Registrá un nuevo gasto mensual recurrente'}
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Rubro */}
          <Controller
            name="rubroId"
            control={control}
            render={({ field }) => (
              <RubroSelector
                rubroId={field.value}
                onChange={(r) => setValue('rubroId', r?.id ?? '')}
                error={errors.rubroId?.message}
                required
              />
            )}
          />

          {/* Etiqueta + Descripción */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Etiqueta (opcional)"
              {...register('etiqueta')}
              placeholder="Ej: Casa, Oficina, Personal"
            />
            <Input
              label="Descripción"
              {...register('descripcion')}
              error={errors.descripcion?.message}
              placeholder="Ej: Luz - Edenor, Gimnasio, Seguro Auto"
            />
          </div>

          {/* Moneda + Monto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select
              label="Moneda"
              {...register('moneda')}
              options={MONEDAS}
              error={errors.moneda?.message}
            />
            <Controller
              name="monto"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  label="Monto"
                  value={field.value}
                  onChange={field.onChange}
                  moneda={moneda}
                  error={errors.monto?.message}
                />
              )}
            />
          </div>

          {/* Forma de Pago */}
          <Select
            label="Forma de Pago"
            {...register('formaDePago')}
            options={FORMAS_PAGO}
            error={errors.formaDePago?.message}
          />

          {/* Tarjeta */}
          {formaDePago === 'TARJETA' && tarjetasActivas.length > 0 && (
            <Select
              label="Tarjeta"
              {...register('tarjetaId')}
              options={[{ value: '', label: 'Seleccioná una tarjeta...' }, ...tarjetasActivas]}
              error={errors.tarjetaId?.message}
            />
          )}

          {/* Cuenta bancaria */}
          {(formaDePago === 'DEBITO' || formaDePago === 'MERCADO_PAGO' || formaDePago === 'TRANSFERENCIA BANCO') &&
            cuentasBancariasActivas.length > 0 && (
              <Select
                label="Cuenta origen / Caja"
                {...register('cuentaBancariaId')}
                options={[
                  { value: '', label: 'Seleccioná una cuenta...' },
                  ...cuentasBancariasActivas,
                ]}
                error={errors.cuentaBancariaId?.message}
              />
            )}

          {/* Optional links */}
          <div className="border-t border-dashed border-mist pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate2 mb-4">
              Vincular con Préstamo, Plan o Tarjeta (Opcional)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Select
                label="Plan de Ahorro"
                {...register('planId')}
                options={[
                  { value: '', label: 'Ninguno' },
                  ...finanzas.planesAhorro.map((p) => ({ value: p.id, label: p.detalle })),
                ]}
              />
              <Select
                label="Préstamo"
                {...register('prestamoId')}
                options={[
                  { value: '', label: 'Ninguno' },
                  ...finanzas.prestamos.map((p) => ({ value: p.id, label: p.concepto })),
                ]}
              />
              <Select
                label="Pago Tarjeta"
                {...register('pagoTarjetaId')}
                options={[
                  { value: '', label: 'Ninguno' },
                  ...finanzas.tarjetas.map((t) => ({ value: t.id, label: t.nombre })),
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-mist">
            <Button type="button" variant="outline" onClick={onVolver} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" loading={isLoading}>
              <Save className="h-4 w-4" />
              {esDuplicacion ? 'Duplicar Gasto' : gastoEditando ? 'Actualizar' : 'Crear Gasto'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
