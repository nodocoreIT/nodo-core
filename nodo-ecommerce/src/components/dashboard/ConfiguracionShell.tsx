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
import {
  SettingsDesktopNav,
  SettingsMobileNav,
  type SettingsSectionNavItem,
} from './settings-section-nav'

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

const TABS: SettingsSectionNavItem[] = [
  { id: 'sitio', label: 'Sitio', icon: Settings, mobileLabel: 'Sitio' },
  { id: 'dashboard', label: 'Dashboard', icon: Layout, mobileLabel: 'Panel' },
  { id: 'contacto', label: 'Horarios & Dirección', icon: Phone, mobileLabel: 'Contacto' },
  { id: 'nosotros', label: 'Nosotros', icon: Globe, mobileLabel: 'Nosotros' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, mobileLabel: 'FAQ' },
  { id: 'mis-datos', label: 'Mis Datos', icon: UserCircle, mobileLabel: 'Datos' },
  { id: 'datos-bancarios', label: 'Datos Bancarios', icon: Building2, mobileLabel: 'Bancos' },
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
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <SettingsDesktopNav
        items={TABS}
        activeId={activeTab}
        onSelect={setActiveTab}
      />

      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
          <h1 className="text-white text-2xl font-serif">Configuración</h1>
          <p className="text-[#555555] text-sm mt-1">
            Gestioná todas las opciones del sitio y del panel desde un solo lugar.
          </p>
          <SettingsMobileNav
            items={TABS}
            activeId={activeTab}
            onSelect={setActiveTab}
            className="mt-4"
            columns={4}
          />
        </div>

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
    </div>
  )
}
