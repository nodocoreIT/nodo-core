'use client'

import Link from 'next/link'

interface Marca {
  id: string
  nombre: string
  logo_url: string | null
}

interface Props {
  marcas: Marca[]
}

export default function MarcasCarousel({ marcas }: Props) {
  if (marcas.length === 0) return null

  // Repeat enough times so one set always overflows the viewport, then duplicate for seamless loop
  const MIN_ITEMS = 12
  const repeatCount = Math.ceil(MIN_ITEMS / marcas.length)
  const set = Array.from({ length: repeatCount }, () => marcas).flat()
  const items = [...set, ...set]

  return (
    <section className="py-16 border-y border-luxury-gray overflow-hidden">
      <div className="px-6 sm:px-10 mb-10">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-2">Nuestras</p>
        <h2 className="font-serif text-3xl md:text-4xl text-white">Marcas</h2>
      </div>

      {/* Fade edges */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-luxury-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-luxury-black to-transparent" />

        <div
          className="flex gap-12 w-max"
          style={{
            animation: `marquee ${set.length * 2.5}s linear infinite`,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.animationPlayState = 'paused'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.animationPlayState = 'running'
          }}
        >
          {items.map((marca, i) => (
            <Link
              key={`${marca.id}-${i}`}
              href={`/buscar?q=${encodeURIComponent(marca.nombre)}`}
              className="flex-none flex items-center justify-center w-36 h-20 px-4 opacity-80 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
              title={`Ver productos de ${marca.nombre}`}
            >
              {marca.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marca.logo_url}
                  alt={marca.nombre}
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <span className="text-luxury-gray-light text-sm font-serif tracking-wider text-center leading-tight">
                  {marca.nombre}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
