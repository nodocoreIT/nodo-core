import { SearchableSelect } from '@nodocore/shared-components';
import { useRubros } from '@/hooks/use-rubros';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import type { Rubro } from '@/types';

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
  const { rubrosActivos } = useRubros();

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
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
