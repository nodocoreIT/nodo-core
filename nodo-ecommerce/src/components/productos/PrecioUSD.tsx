'use client'

import { useDolar } from '@/context/DolarContext'

interface Props {
  precioUsd: number
  priceClassName?: string
}

export default function PrecioUSD({ precioUsd, priceClassName = 'text-white font-bold text-xl' }: Props) {
  const { rate } = useDolar()

  const arsFormatted = rate
    ? `$${Math.round(precioUsd * rate).toLocaleString('es-AR')}`
    : '...'

  const usdFormatted = `US$ ${precioUsd.toLocaleString('es-AR')} USD`

  return (
    <div className="flex flex-col">
      <span className={priceClassName}>{arsFormatted}</span>
      <span className="text-gold text-xs font-medium mt-0.5">{usdFormatted}</span>
    </div>
  )
}
