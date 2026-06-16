import React from 'react';
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
}

export function RubroSelector({
  rubroId,
  onChange,
  placeholder = 'Seleccioná un rubro',
  label = 'Rubro',
  error,
  required,
  hideLabel = false,
}: RubroSelectorProps) {
  const { rubrosActivos } = useRubros();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) {
      onChange(null);
      return;
    }
    const found = rubrosActivos.find((r) => r.id === id);
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
      <select
        value={rubroId ?? ''}
        onChange={handleChange}
        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white transition-colors outline-none h-10
          ${error
            ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
            : 'border-mist focus:border-brand focus:ring-1 focus:ring-brand'
          }`}
      >
        <option value="">{placeholder}</option>
        {rubrosActivos.map((r) => (
          <option key={r.id} value={r.id}>
            {r.emoji} {normalizarCodigoRubro(r.nombre)}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
