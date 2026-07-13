import { createClient } from '@/lib/supabase/server'
import { getSiteConfig } from '@/lib/site-config/getSiteConfig'
import ConfiguracionShell from '@/components/dashboard/ConfiguracionShell'

const MIS_DATOS_KEYS = ['nombre_completo', 'telefono', 'instagram', 'whatsapp', 'facebook', 'tiktok']
const DATOS_BANCARIOS_KEYS = ['cbu', 'alias_cbu', 'titular', 'banco', 'cuentas_bancarias']
const EXTRA_KEYS = ['nosotros_titulo', 'nosotros_subtitulo', 'nosotros_texto', 'faq_items']
const CONTACTO_KEYS = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'contact_address', 'contact_horarios', 'contact_email']
const ALL_KEYS = [...new Set([...MIS_DATOS_KEYS, ...DATOS_BANCARIOS_KEYS, ...EXTRA_KEYS, ...CONTACTO_KEYS])]

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()

  const [siteConfig, { data: rows }] = await Promise.all([
    getSiteConfig(),
    supabase.from('configuracion').select('clave, valor').in('clave', ALL_KEYS),
  ])

  const kv = Object.fromEntries((rows ?? []).map((r) => [r.clave, r.valor ?? '']))

  const initialNavModules = (() => {
    try { return JSON.parse(siteConfig.nav_modules_enabled) as string[] }
    catch { return ['productos','carrousel','pedidos','categorias','marcas','configuracion','tema'] }
  })()

  const faqItems = (() => {
    try { return JSON.parse(kv.faq_items ?? '[]') }
    catch { return [] }
  })()

  const misDatosConfig = Object.fromEntries(MIS_DATOS_KEYS.map((k) => [k, kv[k] ?? '']))
  const datosBancariosConfig = Object.fromEntries(DATOS_BANCARIOS_KEYS.map((k) => [k, kv[k] ?? '']))
  const contactoConfig = Object.fromEntries(CONTACTO_KEYS.map((k) => [k, kv[k] ?? '']))

  return (
    <ConfiguracionShell
      siteConfig={siteConfig}
      initialNavModules={initialNavModules}
      nosotros={{
        titulo: kv.nosotros_titulo ?? '',
        subtitulo: kv.nosotros_subtitulo ?? '',
        texto: kv.nosotros_texto ?? '',
      }}
      faqItems={faqItems}
      misDatosConfig={misDatosConfig}
      datosBancariosConfig={datosBancariosConfig}
      contactoConfig={contactoConfig}
      defaultTab={tab ?? 'sitio'}
    />
  )
}
