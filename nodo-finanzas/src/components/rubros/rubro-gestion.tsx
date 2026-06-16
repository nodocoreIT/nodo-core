import { useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { useRubros } from '@/hooks/use-rubros';
import type { Rubro } from '@/types';

// ── Schema ────────────────────────────────────────────────────────────────────

const schemaRubro = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  codigo: z.string().min(1, 'El código es requerido'),
  emoji: z.string().min(1, 'El emoji es requerido'),
  color: z.string().optional(),
  descripcion: z.string().optional(),
  orden: z.number().min(0),
});

type FormRubro = z.infer<typeof schemaRubro>;

// ── Emoji presets ─────────────────────────────────────────────────────────────

const EMOJI_PRESETS = ['🏠', '🚗', '🎓', '💊', '🍔', '✈️', '🎬', '💰', '📱', '🛒', '🏋️', '💡', '🐾', '🎮', '👔'];

// ── Component ─────────────────────────────────────────────────────────────────

export function RubroGestion() {
  const { rubros, loading, crearRubro, actualizarRubro, eliminarRubro } = useRubros();
  const [modal, setModal] = useState(false);
  const [rubroEditando, setRubroEditando] = useState<Rubro | null>(null);
  const [rubroAEliminar, setRubroAEliminar] = useState<Rubro | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormRubro>({
    resolver: zodResolver(schemaRubro),
    defaultValues: { nombre: '', codigo: '', emoji: '📦', color: '', descripcion: '', orden: 0 },
  });

  const emojiActual = watch('emoji');

  function abrirModal(rubro?: Rubro) {
    if (rubro) {
      setRubroEditando(rubro);
      reset({
        nombre: rubro.nombre,
        codigo: rubro.codigo,
        emoji: rubro.emoji,
        color: rubro.color,
        descripcion: rubro.descripcion ?? '',
        orden: rubro.orden,
      });
    } else {
      setRubroEditando(null);
      reset({ nombre: '', codigo: '', emoji: '📦', color: '', descripcion: '', orden: rubros.length });
    }
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setRubroEditando(null);
    reset();
  }

  async function onSubmit(data: FormRubro) {
    try {
      if (rubroEditando) {
        const ok = await actualizarRubro(rubroEditando.id, data);
        if (ok) {
          toast.success('Rubro actualizado');
          cerrarModal();
        } else {
          toast.error('Error al actualizar el rubro');
        }
      } else {
        const created = await crearRubro({
          ...data,
          activo: true,
          esSistema: false,
        });
        if (created) {
          toast.success('Rubro creado');
          cerrarModal();
        } else {
          toast.error('Error al crear el rubro');
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el rubro');
    }
  }

  async function handleEliminar() {
    if (!rubroAEliminar) return;
    setEliminando(true);
    try {
      const ok = await eliminarRubro(rubroAEliminar.id);
      if (ok) {
        toast.success('Rubro eliminado');
      } else {
        toast.error('No se pudo eliminar el rubro');
      }
    } catch {
      toast.error('Error al eliminar el rubro');
    } finally {
      setEliminando(false);
      setRubroAEliminar(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-brand" />
          <div>
            <h2 className="text-xl font-bold text-ink">Rubros</h2>
            <p className="text-sm text-slate2">Categorizá tus gastos</p>
          </div>
        </div>
        <Button size="sm" onClick={() => abrirModal()}>
          <Plus className="h-4 w-4" />
          Nuevo Rubro
        </Button>
      </div>

      {/* List */}
      <Card>
        {rubros.length === 0 ? (
          <div className="text-center py-10">
            <Tag className="h-10 w-10 mx-auto opacity-20 mb-3" />
            <p className="font-semibold text-ink">Sin rubros</p>
            <Button variant="outline" className="mt-4" onClick={() => abrirModal()}>
              <Plus className="h-4 w-4" />
              Crear primer rubro
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-mist/60">
            {[...rubros].sort((a, b) => a.orden - b.orden).map((rubro) => (
              <div key={rubro.id} className={`flex items-center justify-between py-3 ${!rubro.activo ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{rubro.emoji}</span>
                  <div>
                    <p className="font-semibold text-ink">{rubro.nombre}</p>
                    <p className="text-xs text-slate2">{rubro.codigo}</p>
                  </div>
                  {rubro.esSistema && (
                    <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      sistema
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirModal(rubro)}
                    className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  {!rubro.esSistema && (
                    <button
                      onClick={() => setRubroAEliminar(rubro)}
                      className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Modal: Crear / Editar ───────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-ink">
                {rubroEditando ? 'Editar Rubro' : 'Nuevo Rubro'}
              </h3>
              <button onClick={cerrarModal} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Emoji picker */}
              <div>
                <label className="text-sm font-medium text-ink block mb-2">Emoji</label>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{emojiActual}</span>
                  <input
                    {...register('emoji')}
                    className="w-20 px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm outline-none text-center"
                    placeholder="🏠"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setValue('emoji', e)}
                      className={`text-xl p-1.5 rounded-lg border transition-colors ${
                        emojiActual === e ? 'border-brand bg-brand/10' : 'border-mist hover:border-brand/40'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {errors.emoji && <p className="text-xs text-red-600 mt-1">{errors.emoji.message}</p>}
              </div>

              <Input
                label="Nombre"
                {...register('nombre')}
                error={errors.nombre?.message}
                placeholder="Ej: Alimentación"
              />

              <Input
                label="Código"
                {...register('codigo')}
                error={errors.codigo?.message}
                placeholder="Ej: ALIMENTACION"
              />

              <Input
                label="Descripción (opcional)"
                {...register('descripcion')}
                placeholder="Descripción breve del rubro"
              />

              <div>
                <label className="text-sm font-medium text-ink block mb-1">Orden</label>
                <input
                  type="number"
                  {...register('orden', { valueAsNumber: true })}
                  className="w-24 px-3 py-2 rounded-lg border border-mist focus:border-brand focus:ring-1 focus:ring-brand text-sm outline-none"
                  min={0}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={cerrarModal} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={isSubmitting} className="flex-1">
                  <Save className="h-4 w-4" />
                  {rubroEditando ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm: Eliminar ─────────────────────────────────────────────── */}
      <ModalConfirmacion
        open={!!rubroAEliminar}
        title="Eliminar Rubro"
        message={`¿Eliminás el rubro "${rubroAEliminar?.nombre}"? Los gastos que lo usan quedarán sin categoría.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleEliminar}
        onCancel={() => setRubroAEliminar(null)}
        onClose={() => setRubroAEliminar(null)}
      />

      {eliminando && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
          <Spinner className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}
