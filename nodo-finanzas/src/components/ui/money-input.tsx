import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Moneda } from '@/types';
import {
  formatearMontoInput,
  formatearMontoInputEnVivo,
  parsearMontoInput,
  sanitizarEntradaMonto,
  simboloMoneda,
} from '@/utils/formatters';

interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  moneda?: Moneda;
  error?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

function contarDigitosAntes(valor: string, posicion: number): number {
  let count = 0;
  for (let i = 0; i < posicion && i < valor.length; i++) {
    if (/\d/.test(valor[i])) count++;
  }
  return count;
}

function posicionCursorTrasFormato(valor: string, cantidadDigitos: number): number {
  if (cantidadDigitos <= 0) return 0;

  let vistos = 0;
  for (let i = 0; i < valor.length; i++) {
    if (/\d/.test(valor[i])) {
      vistos++;
      if (vistos === cantidadDigitos) return i + 1;
    }
  }
  return valor.length;
}

export function MoneyInput({
  label,
  value,
  onChange,
  moneda = 'ARS',
  error,
  placeholder,
  required,
  className = '',
  disabled = false,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  const [raw, setRaw] = useState(value === 0 ? '' : formatearMontoInput(value, moneda));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setRaw(value === 0 ? '' : formatearMontoInput(value, moneda));
  }, [value, moneda, focused]);

  useLayoutEffect(() => {
    if (!focused || cursorRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
    cursorRef.current = null;
  }, [raw, focused]);

  function aplicarEntrada(texto: string, posicionCursor: number) {
    const digitosAntes = contarDigitosAntes(texto, posicionCursor);
    const sanitizado = sanitizarEntradaMonto(texto);
    const formateado = formatearMontoInputEnVivo(sanitizado);

    cursorRef.current = posicionCursorTrasFormato(formateado, digitosAntes);
    setRaw(formateado);
    onChange(parsearMontoInput(formateado));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    aplicarEntrada(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parsearMontoInput(raw);
    setRaw(parsed === 0 ? '' : formatearMontoInput(parsed, moneda));
    onChange(parsed);
  }

  const symbol = simboloMoneda(moneda);
  const symbolWidth = moneda === 'USD' ? 'pl-11' : 'pl-10';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
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
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder ?? '0'}
          disabled={disabled}
          className={`w-full ${symbolWidth} pr-3 py-2 rounded-lg border bg-white text-sm transition-colors outline-none
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
              : 'border-mist focus:border-brand focus:ring-1 focus:ring-brand'
            }
            ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
