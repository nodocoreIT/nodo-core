'use client'

import { useState } from 'react'
import { Save, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveSiteConfig } from '@/app/dashboard/configuracion-sitio/actions'
import RichTextEditor from '@/components/ui/RichTextEditor'

interface Props {
  initialTitulo: string
  initialSubtitulo: string
  initialTexto: string
}

const inputClass = 'w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]'
const labelClass = 'block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5'

export default function NosotrosEditor({ initialTitulo, initialSubtitulo, initialTexto }: Props) {
  const [titulo, setTitulo] = useState(initialTitulo)
  const [subtitulo, setSubtitulo] = useState(initialSubtitulo)
  const [texto, setTexto] = useState(initialTexto)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await saveSiteConfig({
      nosotros_titulo: titulo,
      nosotros_subtitulo: subtitulo,
      nosotros_texto: texto,
    })
    setSaving(false)
    if (result.success) {
      toast.success('Contenido guardado.')
    } else {
      toast.error(result.error ?? 'Error al guardar.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Globe size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Quiénes Somos</h2>
        </div>
        <div className="px-5 py-5 space-y-5">
          <p className="text-[#555555] text-xs">
            Este contenido se muestra en la página pública <span className="text-luxury-gray-light">/quienes-somos</span>.
          </p>

          <div>
            <label className={labelClass}>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={inputClass}
              placeholder="Ej: Nuestra Historia"
            />
          </div>

          <div>
            <label className={labelClass}>Subtítulo</label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              className={inputClass}
              placeholder="Ej: Desde 2010 llevando fragancias únicas a tu puerta"
            />
          </div>

          <div>
            <label className={labelClass}>Texto principal</label>
            <RichTextEditor
              value={texto}
              onChange={setTexto}
              placeholder="Contá la historia de tu negocio, tus valores, tu misión..."
              minHeight="280px"
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2.5 text-sm tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
      >
        <Save size={15} />
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}
