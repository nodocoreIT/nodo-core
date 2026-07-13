'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Images, Search } from 'lucide-react'
import ProductoImagenesModal from './ProductoImagenesModal'

interface ProductoBasic {
  id: string
  nombre: string
  marca: string
  slug: string
  imagen_url?: string | null
  imagenes_adicionales?: string[] | null
  activo: boolean
}

interface Props {
  productos: ProductoBasic[]
}

export default function ImagenesManager({ productos }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProductoBasic | null>(null)
  const [localProductos, setLocalProductos] = useState(productos)

  const filtered = localProductos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.marca.toLowerCase().includes(search.toLowerCase())
  )

  function handleSaved(id: string, imagen_url: string | null, imagenes_adicionales: string[]) {
    setLocalProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, imagen_url, imagenes_adicionales } : p))
    )
    setSelected((prev) => (prev?.id === id ? { ...prev, imagen_url, imagenes_adicionales } : prev))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
          <h1 className="text-white text-2xl font-serif">Imágenes de Productos</h1>
          <p className="text-[#555555] text-sm mt-1">
            Hacé click en un producto para gestionar sus imágenes.
          </p>
        </div>
        <div className="text-[#555555] text-xs">
          {localProductos.length} productos
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o marca..."
          className="w-full bg-luxury-black border border-luxury-gray-mid text-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((producto) => {
          const totalImages =
            (producto.imagen_url ? 1 : 0) + (producto.imagenes_adicionales?.length ?? 0)
          return (
            <button
              key={producto.id}
              type="button"
              onClick={() => setSelected(producto)}
              className="group bg-luxury-black border border-luxury-gray hover:border-gold/50 transition-all text-left flex flex-col overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square w-full bg-luxury-gray overflow-hidden">
                {producto.imagen_url ? (
                  <Image
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    fill
                    sizes="200px"
                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Images size={24} className="text-[#444444]" />
                  </div>
                )}
                {/* Image count badge */}
                <div className="absolute bottom-1.5 right-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${totalImages > 0 ? 'bg-gold text-black' : 'bg-luxury-gray-mid text-[#555555]'}`}>
                    {totalImages} foto{totalImages !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-[#555555] text-[9px] tracking-wider uppercase truncate">{producto.marca}</p>
                <p className="text-white text-xs font-medium leading-snug mt-0.5 line-clamp-2">{producto.nombre}</p>
              </div>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#555555] text-sm">
          No se encontraron productos.
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ProductoImagenesModal
          producto={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
