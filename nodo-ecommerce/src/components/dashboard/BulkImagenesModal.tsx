'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ImagePlus, Loader2, Check, Images } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { updateProductoImages } from '@/app/dashboard/imagenes/actions'
import { Producto } from '@/types'

interface Props {
  productos: Producto[]
  selectedIds: Set<string>
  onClose: () => void
  onSaved: (id: string, imagen_url: string | null, imagenes_adicionales: string[]) => void
}

interface ProductoImgState {
  id: string
  nombre: string
  marca: string
  imagen_url: string | null
  imagenes_adicionales: string[]
  modified: boolean
  uploading: boolean
}

export default function BulkImagenesModal({ productos, selectedIds, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [states, setStates] = useState<Map<string, ProductoImgState>>(() => {
    const map = new Map<string, ProductoImgState>()
    productos
      .filter((p) => selectedIds.has(p.id))
      .forEach((p) => {
        map.set(p.id, {
          id: p.id,
          nombre: p.nombre,
          marca: p.marca,
          imagen_url: p.imagen_url ?? null,
          imagenes_adicionales: p.imagenes_adicionales ?? [],
          modified: false,
          uploading: false,
        })
      })
    return map
  })

  const [saving, setSaving] = useState(false)

  const selectedProductos = productos.filter((p) => selectedIds.has(p.id))

  async function handleUpload(productId: string, files: FileList) {
    setStates((prev) => {
      const next = new Map(prev)
      const p = next.get(productId)!
      next.set(productId, { ...p, uploading: true })
      return next
    })

    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()
      const path = `productos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('productos').upload(path, file)
      if (error) {
        toast.error(`Error subiendo ${file.name}`)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path)
      newUrls.push(publicUrl)
    }

    setStates((prev) => {
      const next = new Map(prev)
      const p = next.get(productId)!
      let newMain = p.imagen_url
      let newAdicionales = [...p.imagenes_adicionales]

      if (!newMain && newUrls.length > 0) {
        newMain = newUrls[0]
        newAdicionales = [...newAdicionales, ...newUrls.slice(1)]
      } else {
        newAdicionales = [...newAdicionales, ...newUrls]
      }

      next.set(productId, {
        ...p,
        imagen_url: newMain,
        imagenes_adicionales: newAdicionales,
        modified: newUrls.length > 0 ? true : p.modified,
        uploading: false,
      })
      return next
    })

    if (newUrls.length > 0) {
      toast.success(`${newUrls.length} foto${newUrls.length !== 1 ? 's' : ''} subida${newUrls.length !== 1 ? 's' : ''}`)
    }
  }

  async function saveAll() {
    setSaving(true)
    const modified = Array.from(states.values()).filter((p) => p.modified)
    let savedCount = 0

    for (const p of modified) {
      const result = await updateProductoImages(p.id, p.imagen_url, p.imagenes_adicionales)
      if (result.success) {
        onSaved(p.id, p.imagen_url, p.imagenes_adicionales)
        savedCount++
      } else {
        toast.error(`Error guardando ${p.nombre}`)
      }
    }

    setSaving(false)
    if (savedCount > 0) {
      toast.success(`${savedCount} producto${savedCount !== 1 ? 's' : ''} guardado${savedCount !== 1 ? 's' : ''}.`)
      onClose()
    }
  }

  const modifiedCount = Array.from(states.values()).filter((p) => p.modified).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-luxury-gray w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-luxury-gray flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10">
              <Images className="text-gold" size={18} />
            </div>
            <div>
              <h2 className="text-white text-base font-semibold">
                Imágenes — {selectedProductos.length} productos
              </h2>
              <p className="text-[#555555] text-xs">
                Subí fotos para cada producto seleccionado
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#555555] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {selectedProductos.map((producto) => {
              const state = states.get(producto.id)!
              const totalImgs =
                (state.imagen_url ? 1 : 0) + state.imagenes_adicionales.length

              return (
                <div
                  key={producto.id}
                  className={`bg-luxury-black border flex flex-col overflow-hidden transition-colors ${
                    state.modified ? 'border-gold/40' : 'border-luxury-gray'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-luxury-gray">
                    {state.imagen_url ? (
                      <Image
                        src={state.imagen_url}
                        alt={producto.nombre}
                        fill
                        className="object-contain p-2"
                        sizes="200px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Images size={24} className="text-[#444444]" />
                      </div>
                    )}
                    {state.modified && (
                      <div className="absolute top-1.5 right-1.5 bg-gold text-black p-0.5 rounded-full">
                        <Check size={10} />
                      </div>
                    )}
                    {totalImgs > 0 && (
                      <div className="absolute bottom-1.5 left-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gold text-black">
                          {totalImgs} foto{totalImgs !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info + Upload */}
                  <div className="p-2.5 flex flex-col gap-2">
                    <div>
                      <p className="text-[#555555] text-[9px] tracking-wider uppercase truncate">
                        {state.marca}
                      </p>
                      <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                        {state.nombre}
                      </p>
                    </div>
                    <label
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                        state.uploading
                          ? 'bg-luxury-gray text-[#555555] cursor-not-allowed'
                          : 'bg-luxury-gray hover:bg-[#252525] text-white border border-luxury-gray-mid'
                      }`}
                    >
                      {state.uploading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <ImagePlus size={11} />
                      )}
                      {state.uploading ? 'Subiendo...' : 'Subir fotos'}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        disabled={state.uploading}
                        onChange={(e) =>
                          e.target.files && handleUpload(producto.id, e.target.files)
                        }
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-luxury-gray flex items-center justify-between shrink-0">
          <p className="text-[#555555] text-xs">
            {modifiedCount > 0
              ? `${modifiedCount} producto${modifiedCount !== 1 ? 's' : ''} con cambios pendientes`
              : 'Sin cambios aún'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-luxury-gray-light hover:text-white border border-luxury-gray-mid transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={saveAll}
              disabled={saving || modifiedCount === 0}
              className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2 text-xs tracking-wider hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Guardar todo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
