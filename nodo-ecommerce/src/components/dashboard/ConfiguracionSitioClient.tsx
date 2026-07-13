'use client'

import { useState } from 'react'
import { Save, Globe, BookOpen, HelpCircle, MessageCircle, Mail, Search, Settings, Truck, Star, DollarSign, Type } from 'lucide-react'
import toast from 'react-hot-toast'
import { SiteConfig } from '@/lib/site-config/getSiteConfig'
import { saveSiteConfig } from '@/app/dashboard/configuracion-sitio/actions'

interface Props {
  initialConfig: SiteConfig
}

interface FeatureItem {
  key: keyof SiteConfig
  label: string
  description: string
  icon: React.ReactNode
}

const FEATURES: FeatureItem[] = [
  {
    key: 'feature_catalogo',
    label: 'Catálogo',
    description: 'Muestra el botón de catálogo en el header y permite ver el catálogo completo.',
    icon: <BookOpen size={15} />,
  },
  {
    key: 'feature_faq',
    label: 'Preguntas Frecuentes',
    description: 'Habilita la página /preguntas-frecuentes y el link en la navegación.',
    icon: <HelpCircle size={15} />,
  },
  {
    key: 'feature_nosotros',
    label: 'Quiénes Somos',
    description: 'Habilita la página /quienes-somos y el link en la navegación.',
    icon: <Globe size={15} />,
  },
  {
    key: 'feature_whatsapp',
    label: 'Botón de WhatsApp',
    description: 'Muestra el botón flotante de WhatsApp en todas las páginas del sitio.',
    icon: <MessageCircle size={15} />,
  },
  {
    key: 'feature_newsletter',
    label: 'Newsletter',
    description: 'Activa el modal de suscripción al newsletter para los visitantes.',
    icon: <Mail size={15} />,
  },
  {
    key: 'feature_quick_search',
    label: 'Búsqueda Rápida (Ctrl+K)',
    description: 'Muestra el botón de búsqueda rápida en el header y habilita el atajo de teclado.',
    icon: <Search size={15} />,
  },
  {
    key: 'feature_marcas_carousel',
    label: 'Carrusel de Marcas',
    description: 'Muestra la sección "Nuestras Marcas" en la homepage con el carrusel de logos.',
    icon: <Star size={15} />,
  },
  {
    key: 'feature_precios_usd',
    label: 'Precios en USD (Dólar Blue)',
    description: 'Los productos se muestran con precio en pesos calculado al dólar blue. El widget de cotización aparece en el header y se actualiza cada 10 minutos.',
    icon: <DollarSign size={15} />,
  },
]

export default function ConfiguracionSitioClient({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig)
  const [saving, setSaving] = useState(false)

  function toggle(key: keyof SiteConfig) {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setText(key: keyof SiteConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveSiteConfig(config as unknown as Record<string, boolean | string>)
    setSaving(false)
    if (result.success) {
      toast.success('Configuración guardada.')
    } else {
      toast.error(result.error ?? 'Error al guardar.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Feature toggles */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Settings size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Secciones y Funcionalidades</h2>
        </div>
        <ul className="divide-y divide-luxury-gray">
          {FEATURES.map(({ key, label, description, icon }) => {
            const enabled = config[key]
            return (
              <li key={key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-gold mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-[#555555] text-xs mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                    enabled ? 'bg-gold' : 'bg-luxury-gray-mid'
                  }`}
                  aria-checked={enabled ? 'true' : 'false'}
                  role="switch"
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Shipping banner */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Truck size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Banner de Envío</h2>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Mostrar banner de envío en el header</p>
              <p className="text-[#555555] text-xs mt-0.5">Aparece en la barra superior del sitio.</p>
            </div>
            <button
              type="button"
              onClick={() => toggle('shipping_banner_enabled')}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                config.shipping_banner_enabled ? 'bg-gold' : 'bg-luxury-gray-mid'
              }`}
              role="switch"
              aria-checked={config.shipping_banner_enabled ? 'true' : 'false'}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${config.shipping_banner_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {config.shipping_banner_enabled && (
            <>
              <div>
                <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5">
                  Texto del banner
                </label>
                <input
                  type="text"
                  value={config.shipping_banner_text}
                  onChange={(e) => setText('shipping_banner_text', e.target.value)}
                  className="w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]"
                  placeholder="Ej: ENVÍO GRATIS en toda la zona"
                />
                <p className="text-[#555555] text-xs mt-1">Este texto se muestra exactamente como lo escribís.</p>
              </div>
              <div>
                <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5">
                  Monto mínimo para envío gratis (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-luxury-gray-light text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={config.shipping_free_from}
                    onChange={(e) => setText('shipping_free_from', e.target.value)}
                    className="w-40 bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]"
                    placeholder="Sin mínimo"
                  />
                </div>
                <p className="text-[#555555] text-xs mt-1">Si lo dejás vacío, el envío gratis aplica siempre.</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Newsletter modal text */}
      {config.feature_newsletter && (
        <section className="bg-luxury-black border border-luxury-gray">
          <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
            <Type size={14} className="text-gold" />
            <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Texto del modal de Newsletter</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5">
                Título
              </label>
              <input
                type="text"
                value={config.newsletter_title}
                onChange={(e) => setText('newsletter_title', e.target.value)}
                className="w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]"
                placeholder="Ej: Unite a la Elite"
              />
            </div>
            <div>
              <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5">
                Descripción
              </label>
              <textarea
                value={config.newsletter_body}
                onChange={(e) => setText('newsletter_body', e.target.value)}
                rows={3}
                className="w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444] resize-none"
                placeholder="Ej: Suscribite para recibir lanzamientos exclusivos..."
              />
            </div>
            <div>
              <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5">
                Texto inferior (pie del modal)
              </label>
              <input
                type="text"
                value={config.newsletter_footer}
                onChange={(e) => setText('newsletter_footer', e.target.value)}
                className="w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]"
                placeholder="Ej: Sin spam. Solo exclusividad."
              />
            </div>
          </div>
        </section>
      )}

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
