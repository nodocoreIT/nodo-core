'use client'

import { useState } from 'react'
import { Save, HelpCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveSiteConfig } from '@/app/dashboard/configuracion-sitio/actions'
import RichTextEditor from '@/components/ui/RichTextEditor'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: string
}

interface Props {
  initialItems: FaqItem[]
}

const inputClass = 'w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]'
const labelClass = 'block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5'

function newItem(): FaqItem {
  return { id: Date.now().toString(), pregunta: '', respuesta: '' }
}

export default function FaqEditor({ initialItems }: Props) {
  const [items, setItems] = useState<FaqItem[]>(initialItems)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function addItem() {
    const item = newItem()
    setItems((prev) => [...prev, item])
    setExpandedId(item.id)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function updateItem(id: string, field: keyof FaqItem, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  async function handleSave() {
    const incomplete = items.some((i) => !i.pregunta.trim())
    if (incomplete) {
      toast.error('Completá la pregunta en todos los items.')
      return
    }
    setSaving(true)
    const result = await saveSiteConfig({ faq_items: JSON.stringify(items) })
    setSaving(false)
    if (result.success) {
      toast.success('Preguntas frecuentes guardadas.')
    } else {
      toast.error(result.error ?? 'Error al guardar.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-gold" />
            <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Preguntas Frecuentes</h2>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-gold border border-gold/30 hover:border-gold px-3 py-1.5 transition-colors"
          >
            <Plus size={13} />
            Agregar
          </button>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[#555555] text-sm">No hay preguntas frecuentes todavía.</p>
            <button type="button" onClick={addItem} className="mt-3 text-gold text-xs hover:underline">
              Agregar la primera
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-luxury-gray">
            {items.map((item, index) => {
              const expanded = expandedId === item.id
              return (
                <li key={item.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                    >
                      <span className="text-gold text-xs font-mono shrink-0">{String(index + 1).padStart(2, '0')}</span>
                      <span className={`text-sm truncate ${item.pregunta ? 'text-white' : 'text-[#555]'}`}>
                        {item.pregunta || 'Nueva pregunta...'}
                      </span>
                      {expanded
                        ? <ChevronUp size={14} className="text-luxury-gray-light shrink-0" />
                        : <ChevronDown size={14} className="text-luxury-gray-light shrink-0" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[#555] hover:text-red-400 transition-colors shrink-0 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {expanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-luxury-gray bg-[#0a0a0a]">
                      <div className="pt-4">
                        <label className={labelClass}>Pregunta</label>
                        <input
                          type="text"
                          value={item.pregunta}
                          onChange={(e) => updateItem(item.id, 'pregunta', e.target.value)}
                          className={inputClass}
                          placeholder="¿Cuál es el tiempo de entrega?"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Respuesta</label>
                        <RichTextEditor
                          value={item.respuesta}
                          onChange={(html) => updateItem(item.id, 'respuesta', html)}
                          placeholder="Escribí la respuesta..."
                          minHeight="150px"
                        />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
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
