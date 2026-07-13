'use client'

import { useState } from 'react'
import { Save, Layout } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveSiteConfig } from '@/app/dashboard/configuracion-sitio/actions'

const NAV_MODULES: Array<{ slug: string; label: string }> = [
  { slug: 'productos',      label: 'Productos' },
  { slug: 'carrousel',      label: 'Carrusel de imágenes' },
  { slug: 'pedidos',        label: 'Pedidos' },
  { slug: 'categorias',     label: 'Categorías' },
  { slug: 'marcas',         label: 'Marcas' },
  { slug: 'configuracion',  label: 'Configuración' },
  { slug: 'tema',           label: 'Editor de Tema' },
]

interface Props {
  initialNavModules: string[]
}

export default function DashboardModulosClient({ initialNavModules }: Props) {
  const [navModules, setNavModules] = useState<string[]>(initialNavModules)
  const [saving, setSaving] = useState(false)

  function toggleModule(slug: string) {
    setNavModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveSiteConfig({ nav_modules_enabled: JSON.stringify(navModules) })
    setSaving(false)
    if (result.success) {
      toast.success('Módulos guardados.')
    } else {
      toast.error(result.error ?? 'Error al guardar.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Layout size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Módulos del Panel</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-[#555555] text-xs mb-4">
            Seleccioná qué secciones se muestran en la barra lateral del panel de administración.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NAV_MODULES.map(({ slug, label }) => {
              const enabled = navModules.includes(slug)
              return (
                <label key={slug} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleModule(slug)}
                    className="w-4 h-4 accent-gold cursor-pointer"
                  />
                  <span className={`text-sm transition-colors ${enabled ? 'text-white' : 'text-[#555]'}`}>
                    {label}
                  </span>
                </label>
              )
            })}
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
