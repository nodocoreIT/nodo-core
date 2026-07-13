'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { X, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { updateProductoImages } from '@/app/dashboard/imagenes/actions'

interface ProductoBasic {
  id: string
  nombre: string
  marca: string
  slug: string
  imagen_url?: string | null
  imagenes_adicionales?: string[] | null
}

interface Props {
  producto: ProductoBasic
  onClose: () => void
  onSaved: (id: string, imagen_url: string | null, imagenes_adicionales: string[]) => void
}

export default function ProductoImagenesModal({ producto, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [imagenUrl, setImagenUrl] = useState<string>(producto.imagen_url ?? '')
  const [adicionales, setAdicionales] = useState<string[]>(producto.imagenes_adicionales ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const allImages = Array.from(new Set([imagenUrl, ...adicionales].filter(Boolean)))

  async function handleUpload(files: FileList) {
    setUploading(true)
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

    if (newUrls.length > 0) {
      if (!imagenUrl) {
        setImagenUrl(newUrls[0])
        setAdicionales((prev) => [...prev, ...newUrls.slice(1)])
      } else {
        setAdicionales((prev) => [...prev, ...newUrls])
      }
      toast.success(`${newUrls.length} imagen${newUrls.length !== 1 ? 'es' : ''} subida${newUrls.length !== 1 ? 's' : ''}`)
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function setAsPrincipal(url: string) {
    if (url === imagenUrl) return
    setImagenUrl(url)
    setAdicionales((prev) => {
      const rest = prev.filter((u) => u !== url)
      if (imagenUrl) return [imagenUrl, ...rest]
      return rest
    })
  }

  function deleteImage(url: string) {
    if (url === imagenUrl) {
      const next = adicionales[0] ?? ''
      setImagenUrl(next)
      setAdicionales(adicionales.slice(1))
    } else {
      setAdicionales((prev) => prev.filter((u) => u !== url))
    }
  }

  async function handleSave() {
    setSaving(true)
    const result = await updateProductoImages(
      producto.id,
      imagenUrl || null,
      adicionales
    )
    setSaving(false)

    if (result.success) {
      toast.success('Imágenes guardadas.')
      onSaved(producto.id, imagenUrl || null, adicionales)
      onClose()
    } else {
      toast.error(result.error ?? 'Error al guardar.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 bg-luxury-black border border-luxury-gray w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-luxury-gray shrink-0">
          <div>
            <p className="text-[#555555] text-[10px] tracking-widest uppercase">{producto.marca}</p>
            <h2 className="text-white text-sm font-semibold mt-0.5 line-clamp-1">{producto.nombre}</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Upload button */}
            <label className={`flex items-center gap-2 px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${uploading ? 'bg-luxury-gray text-[#555555]' : 'bg-gold text-black hover:bg-gold-light'}`}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {uploading ? 'Subiendo...' : 'Subir fotos'}
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </label>
            <button onClick={onClose} className="text-[#555555] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {allImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ImagePlus size={32} className="text-[#444444] mb-3" />
              <p className="text-[#555555] text-sm">Sin imágenes. Subí las primeras.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {allImages.map((url, i) => {
                const isPrincipal = url === imagenUrl
                return (
                  <div
                    key={i}
                    className={`group relative aspect-square bg-luxury-gray border overflow-hidden ${isPrincipal ? 'border-gold ring-1 ring-gold' : 'border-luxury-gray-mid'}`}
                  >
                    <Image src={url} alt={`Imagen ${i + 1}`} fill className="object-contain p-2" sizes="200px" />

                    {isPrincipal && (
                      <div className="absolute top-2 left-2 bg-gold text-black px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider z-10">
                        Portada
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      {!isPrincipal && (
                        <button
                          type="button"
                          onClick={() => setAsPrincipal(url)}
                          className="p-2 bg-gold text-black rounded hover:bg-gold-light transition-colors"
                          title="Establecer como portada"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteImage(url)}
                        className="p-2 bg-red-500/80 text-white rounded hover:bg-red-500 transition-colors"
                        title="Eliminar imagen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-luxury-gray flex items-center justify-between shrink-0">
          <p className="text-[#555555] text-xs">
            {allImages.length} imagen{allImages.length !== 1 ? 'es' : ''} · Hover para acciones
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-luxury-gray-light hover:text-white transition-colors px-4 py-2 border border-luxury-gray-mid"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2 text-xs tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
