import { cacheTag, cacheLife } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export interface SiteConfig {
  // Contact & social
  whatsapp: string
  instagram: string
  facebook: string
  tiktok: string
  contact_address: string
  contact_horarios: string
  contact_email: string
  // Feature flags (boolean)
  feature_catalogo: boolean
  feature_faq: boolean
  feature_nosotros: boolean
  feature_whatsapp: boolean
  feature_newsletter: boolean
  feature_quick_search: boolean
  feature_marcas_carousel: boolean
  feature_precios_usd: boolean
  // Shipping banner
  shipping_banner_enabled: boolean
  shipping_banner_text: string
  shipping_free_from: string
  // Newsletter modal
  newsletter_title: string
  newsletter_body: string
  newsletter_footer: string
  // Dashboard modules
  nav_modules_enabled: string
}

const BOOL_KEYS = [
  'feature_catalogo',
  'feature_faq',
  'feature_nosotros',
  'feature_whatsapp',
  'feature_newsletter',
  'feature_quick_search',
  'feature_marcas_carousel',
  'feature_precios_usd',
  'shipping_banner_enabled',
] as const

const STRING_KEYS = [
  'shipping_banner_text',
  'shipping_free_from',
  'newsletter_title',
  'newsletter_body',
  'newsletter_footer',
  'nav_modules_enabled',
  // Contact & social (shared with redes-sociales page)
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'contact_address',
  'contact_horarios',
  'contact_email',
] as const

const ALL_KEYS = [...BOOL_KEYS, ...STRING_KEYS]

const DEFAULTS: SiteConfig = {
  whatsapp: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  contact_address: '',
  contact_horarios: '',
  contact_email: '',
  feature_catalogo: false,
  feature_faq: true,
  feature_nosotros: true,
  feature_whatsapp: true,
  feature_newsletter: true,
  feature_quick_search: true,
  feature_marcas_carousel: true,
  feature_precios_usd: false,
  shipping_banner_enabled: false,
  shipping_banner_text: 'ENVÍO GRATIS en tu primera compra',
  shipping_free_from: '',
  newsletter_title: 'Unite a la Elite',
  newsletter_body: 'Suscribite para recibir lanzamientos exclusivos, ofertas privadas y novedades.',
  newsletter_footer: 'Sin spam. Solo exclusividad.',
  nav_modules_enabled: '["productos","carrousel","pedidos","categorias","marcas","proveedores","configuracion","tema"]',
}

export async function getSiteConfig(): Promise<SiteConfig> {
  'use cache'
  cacheTag('site-config')
  cacheLife('hours')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ALL_KEYS)

    if (error || !data) return DEFAULTS

    const result = { ...DEFAULTS }
    for (const row of data) {
      const key = row.clave as keyof SiteConfig
      if ((BOOL_KEYS as readonly string[]).includes(key)) {
        (result as Record<string, unknown>)[key] = row.valor === 'true'
      } else if ((STRING_KEYS as readonly string[]).includes(key)) {
        (result as Record<string, unknown>)[key] = row.valor ?? ''
      }
    }
    return result
  } catch {
    return DEFAULTS
  }
}
