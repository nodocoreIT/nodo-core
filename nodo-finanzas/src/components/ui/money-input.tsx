import React, { useState, useEffect } from 'react';
import type { Moneda } from '@/types';

interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  moneda?: Moneda;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

function formatThousands(n: number): string {
  if (n === 0) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function MoneyInput({
  label,
  value,
  onChange,
  moneda = 'ARS',
  error,
  placeholder,
  required,
}: MoneyInputProps) {
  const [raw, setRaw] = useState(value === 0 ? '' : formatThousands(value));

  useEffect(() => {
    const parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    const numeric = isNaN(parsed) ? 0 : parsed;
    if (numeric !== value) {
      setRaw(value === 0 ? '' : formatThousands(value));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const str = e.target.value;
    setRaw(str);
    // Parse: remove thousand separators (dots in es-AR) then replace comma with dot
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    onChange(isNaN(parsed) ? 0 : parsed);
  }

  const symbol = moneda === 'USD' ? 'U$S' : '$';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-ink">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate2 pointer-events-none">
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          placeholder={placeholder ?? '0'}
          className={`w-full pl-10 pr-3 py-2 rounded-lg border text-sm transition-colors outline-none
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
              : 'border-mist focus:border-brand focus:ring-1 focus:ring-brand'
            }`}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
