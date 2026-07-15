'use client'

import { useState } from 'react'
import { useDolar } from '@/context/DolarContext'
import { CreditCard } from 'lucide-react'

const CUOTAS = [
  { n: 1,  factor: 0.96, label: '1 pago' },
  { n: 2,  factor: 0.93, label: '2 cuotas' },
  { n: 3,  factor: 0.91, label: '3 cuotas' },
  { n: 4,  factor: 0.89, label: '4 cuotas' },
  { n: 5,  factor: 0.86, label: '5 cuotas' },
  { n: 6,  factor: 0.83, label: '6 cuotas' },
  { n: 7,  factor: 0.79, label: '7 cuotas' },
  { n: 8,  factor: 0.76, label: '8 cuotas' },
  { n: 9,  factor: 0.73, label: '9 cuotas' },
  { n: 10, factor: 0.70, label: '10 cuotas' },
  { n: 11, factor: 0.67, label: '11 cuotas' },
  { n: 12, factor: 0.64, label: '12 cuotas' },
]

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

interface Props {
  precioVenta: number
  moneda?: 'ARS' | 'USD'
}

export default function SimuladorCuotas({ precioVenta, moneda }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const { rate } = useDolar()

  const precioARS = moneda === 'USD' && rate
    ? Math.round(precioVenta * rate)
    : precioVenta

  const cuotaSeleccionada = selected !== null
    ? CUOTAS.find(c => c.n === selected)
    : null

  const totalSeleccionado = cuotaSeleccionada
    ? precioARS / cuotaSeleccionada.factor
    : null

  return (
    <div className="border-t border-luxury-gray-mid pt-4 mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-gold text-sm font-semibold hover:text-gold-light transition-colors"
      >
        <CreditCard size={15} />
        Simulador de cuotas
        <span className="text-xs text-luxury-gray-light font-normal ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CUOTAS.map(({ n, factor, label }) => {
              const total = precioARS / factor
              const cuota = total / n
              const isSelected = selected === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : n)}
                  className={`flex flex-col items-center p-2.5 border text-center transition-all ${
                    isSelected
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-luxury-gray-mid hover:border-gold/50 text-luxury-gray-light hover:text-white'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider mb-1">{label}</span>
                  <span className="text-sm font-bold">{fmt(cuota)}</span>
                  <span className="text-[10px] opacity-60">c/u</span>
                </button>
              )
            })}
          </div>

          {cuotaSeleccionada && totalSeleccionado !== null && (
            <div className="bg-luxury-gray border border-gold/30 p-4 text-sm space-y-1.5">
              <p className="text-luxury-gray-light text-xs uppercase tracking-widest mb-2">Resumen</p>
              <div className="flex justify-between">
                <span className="text-luxury-gray-light">Cuotas</span>
                <span className="text-white font-medium">{cuotaSeleccionada.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-luxury-gray-light">Valor por cuota</span>
                <span className="text-white font-medium">{fmt(totalSeleccionado / cuotaSeleccionada.n)}</span>
              </div>
              <div className="flex justify-between border-t border-luxury-gray-mid pt-1.5 mt-1.5">
                <span className="text-luxury-gray-light">Total a pagar</span>
                <span className="text-gold font-bold">{fmt(totalSeleccionado)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
