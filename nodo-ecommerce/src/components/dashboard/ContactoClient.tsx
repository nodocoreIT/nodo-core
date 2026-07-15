'use client'

import { useState } from 'react'
import { Save, CheckCircle, MapPin, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { revalidateConfig } from '@/app/dashboard/configuracion-sitio/actions'

interface Props {
  config: Record<string, string>
}

const inputClass = 'w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]'
const labelClass = 'block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5'

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z" />
  </svg>
)

export default function ContactoClient({ config: initial }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
    contact_address: initial.contact_address ?? '',
    contact_horarios: initial.contact_horarios ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const entries = Object.entries(form).map(([clave, valor]) => ({
      clave,
      valor,
      updated_at: new Date().toISOString(),
    }))

    const { error: err } = await supabase
      .from('configuracion')
      .upsert(entries, { onConflict: 'clave' })

    setSaving(false)
    if (err) { setError(err.message); return }

    await revalidateConfig()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">

      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <MapPin size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Ubicación y Horarios</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className={labelClass}>
              <MapPin size={11} className="inline mr-1" />
              Dirección física
            </label>
            <input
              type="text"
              value={form.contact_address}
              onChange={(e) => set('contact_address', e.target.value)}
              className={inputClass}
              placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
            />
          </div>
          <div>
            <label className={labelClass}>
              <Clock size={11} className="inline mr-1" />
              Horarios de atención
            </label>
            <textarea
              value={form.contact_horarios}
              onChange={(e) => set('contact_horarios', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder={`Ej:\nLun–Vie: 9 a 18 hs\nSáb: 9 a 13 hs`}
            />
            <p className="text-[#444444] text-xs mt-1">Podés usar saltos de línea para separar días.</p>
          </div>
        </div>
      </section>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2.5 text-sm tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
      >
        {saved ? (
          <><CheckCircle size={15} /> Guardado</>
        ) : (
          <><Save size={15} /> {saving ? 'Guardando...' : 'Guardar cambios'}</>
        )}
      </button>
    </div>
  )
}
