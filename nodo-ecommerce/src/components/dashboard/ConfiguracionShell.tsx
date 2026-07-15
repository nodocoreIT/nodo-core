'use client'

import { useState } from 'react'
import { Settings, Layout, Globe, HelpCircle, UserCircle, Building2, Phone } from 'lucide-react'
import { SiteConfig } from '@/lib/site-config/getSiteConfig'
import ConfiguracionSitioClient from './ConfiguracionSitioClient'
import DashboardModulosClient from './DashboardModulosClient'
import NosotrosEditor from './NosotrosEditor'
import FaqEditor from './FaqEditor'
import MisDatosClient from './MisDatosClient'
import DatosBancariosClient from './DatosBancariosClient'
import ContactoClient from './ContactoClient'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: string
}

interface Props {
  siteConfig: SiteConfig
  initialNavModules: string[]
  nosotros: { titulo: string; subtitulo: string; texto: string }
  faqItems: FaqItem[]
  misDatosConfig: Record<string, string>
  datosBancariosConfig: Record<string, string>
  contactoConfig: Record<string, string>
  defaultTab?: string
}

const TABS = [
  { id: 'sitio',           label: 'Sitio',            icon: Settings   },
  { id: 'dashboard',      label: 'Dashboard',         icon: Layout     },
  { id: 'contacto',       label: 'Horarios & Dirección', icon: Phone      },
  { id: 'nosotros',       label: 'Nosotros',          icon: Globe      },
  { id: 'faq',            label: 'FAQ',               icon: HelpCircle },
  { id: 'mis-datos',      label: 'Mis Datos',         icon: UserCircle },
  { id: 'datos-bancarios',label: 'Datos Bancarios',   icon: Building2  },
]

export default function ConfiguracionShell({
  siteConfig,
  initialNavModules,
  nosotros,
  faqItems,
  misDatosConfig,
  datosBancariosConfig,
  contactoConfig,
  defaultTab = 'sitio',
}: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
        <h1 className="text-white text-2xl font-serif">Configuración</h1>
        <p className="text-[#555555] text-sm mt-1">
          Gestioná todas las opciones del sitio y del panel desde un solo lugar.
        </p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-luxury-gray overflow-x-auto">
        <nav className="flex gap-0 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs tracking-wider uppercase border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-gold text-gold'
                    : 'border-transparent text-[#555555] hover:text-luxury-gray-light hover:border-luxury-gray-mid'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'sitio' && (
          <ConfiguracionSitioClient initialConfig={siteConfig} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardModulosClient initialNavModules={initialNavModules} />
        )}
        {activeTab === 'nosotros' && (
          <NosotrosEditor
            initialTitulo={nosotros.titulo}
            initialSubtitulo={nosotros.subtitulo}
            initialTexto={nosotros.texto}
          />
        )}
        {activeTab === 'faq' && (
          <FaqEditor initialItems={faqItems} />
        )}
        {activeTab === 'mis-datos' && (
          <MisDatosClient config={misDatosConfig} />
        )}
        {activeTab === 'contacto' && (
          <ContactoClient config={contactoConfig} />
        )}
        {activeTab === 'datos-bancarios' && (
          <DatosBancariosClient config={datosBancariosConfig} />
        )}
      </div>
    </div>
  )
}
