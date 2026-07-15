'use client'

import { useDolar } from '@/context/DolarContext'

export default function DolarWidget() {
  const { rate, loading, error } = useDolar()

  if (loading && rate === null) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/40 text-gold text-[10px] font-bold tracking-wider px-3 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        Cargando cotización...
      </span>
    )
  }

  if (error && rate === null) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/40 text-gold text-[10px] font-bold tracking-wider px-3 py-1 rounded-full">
        Sin cotización
      </span>
    )
  }

  if (!rate) return null

  const formatted = Math.round(rate).toLocaleString('es-AR')

  return (
    <span className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/40 text-gold text-[10px] font-bold tracking-wider px-3 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
      Dólar Blue: ${formatted}
    </span>
  )
}
