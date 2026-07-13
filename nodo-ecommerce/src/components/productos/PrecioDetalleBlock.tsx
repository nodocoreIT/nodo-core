'use client'

import { useDolar } from '@/context/DolarContext'
import { calculateListPrice, calculateInstallment, formatPrice } from '@/lib/price-utils'

interface Props {
  precioVenta: number
  moneda?: 'ARS' | 'USD'
}

export default function PrecioDetalleBlock({ precioVenta, moneda }: Props) {
  const { rate } = useDolar()

  const isUSD = moneda === 'USD'

  // Precio base en ARS
  const precioARS = isUSD && rate ? Math.round(precioVenta * rate) : precioVenta

  const listaARS = calculateListPrice(precioARS)
  const cuotaARS = calculateInstallment(precioARS)

  return (
    <div className="mb-8 p-6 bg-luxury-gray border-l-4 border-gold flex flex-col gap-1">
      {/* Precio de lista */}
      <div className="flex flex-col">
        <span className="text-gray-400 text-xs uppercase tracking-widest mb-1">
          Precio de lista
        </span>
        <span className="text-gray-300 font-medium text-2xl">
          {formatPrice(listaARS)}
        </span>
      </div>

      {/* Cuotas */}
      <div className="flex items-center gap-2 text-gray-300 mt-1">
        <span className="font-semibold text-lg">
          3 cuotas sin interés de {formatPrice(cuotaARS)}
        </span>
      </div>

      {/* Contado */}
      <div className="mt-6 pt-6 border-t border-luxury-gray-mid">
        <span className="text-gray-400 text-xs uppercase tracking-widest block mb-2">
          Precio Especial Contado / Transferencia
        </span>
        <span className="text-white font-bold text-5xl block">
          {formatPrice(precioARS)}
        </span>
        {isUSD && (
          <span className="text-gold text-sm font-medium mt-1 block">
            US$ {precioVenta.toLocaleString('es-AR')} USD
          </span>
        )}
      </div>
    </div>
  )
}
