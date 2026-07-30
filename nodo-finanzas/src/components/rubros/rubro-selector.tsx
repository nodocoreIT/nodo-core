import { SearchableSelect } from '@nodocore/shared-components';
import { useRubros } from '@/hooks/use-rubros';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import type { Rubro } from '@/types';
import toast from 'react-hot-toast';

interface RubroSelectorProps {
  rubroId: string | null | undefined;
  onChange: (rubro: Rubro | null) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  hideLabel?: boolean;
  triggerClassName?: string;
}

/** "Sin resultados" → "MI RUBRO", collision-safe by suffixing _2, _3, ... */
function generarCodigoRubro(nombre: string, existentes: Set<string>): string {
  const base = nombre
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function RubroSelector({
  rubroId,
  onChange,
  placeholder = 'Seleccioná un rubro',
  label = 'Rubro',
  error,
  required,
  hideLabel = false,
  triggerClassName,
}: RubroSelectorProps) {
  const { rubrosActivos, crearRubro } = useRubros();

  const options = rubrosActivos.map((rubro) => ({
    value: rubro.id,
    label: `${rubro.emoji} ${normalizarCodigoRubro(rubro.nombre)}`,
  }));

  function handleChange(id: string) {
    if (!id) {
      onChange(null);
      return;
    }
    const found = rubrosActivos.find((rubro) => rubro.id === id);
    onChange(found ?? null);
  }

  async function handleCreateNew(nombre: string) {
    const existentes = new Set(rubrosActivos.map((r) => r.codigo));
    const creado = await crearRubro({
      codigo: generarCodigoRubro(nombre, existentes),
      nombre,
      emoji: '📦',
      color: '',
      activo: true,
      esSistema: false,
      orden: rubrosActivos.length,
    });
    if (creado) {
      toast.success(`Rubro "${nombre}" creado`);
      onChange(creado);
    } else {
      toast.error('No se pudo crear el rubro');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && (
        <label className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <SearchableSelect
        value={rubroId ?? ''}
        onChange={handleChange}
        options={options}
        allowEmpty
        emptyLabel={placeholder}
        searchPlaceholder="Buscar rubro..."
        aria-label={label}
        triggerClassName={triggerClassName}
        onCreateNew={handleCreateNew}
        createNewLabel={(search) => `Agregar rubro "${search}"`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
