import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { getSiteConfig } from '@/lib/site-config/getSiteConfig'
import FaqAccordion from '@/components/faq/FaqAccordion'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: string
}

async function getFaqItems(): Promise<FaqItem[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'faq_items')
    .single()

  try { return JSON.parse(data?.valor ?? '[]') }
  catch { return [] }
}

export default async function PreguntasFrecuentesPage() {
  const [siteConfig, items] = await Promise.all([getSiteConfig(), getFaqItems()])

  if (!siteConfig.feature_faq) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-14">
        <div className="w-12 h-12 rounded-full border-2 border-gold flex items-center justify-center mb-5">
          <HelpCircle size={22} className="text-gold" />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-3">
          Preguntas Frecuentes
        </h1>
        <p className="text-luxury-gray-light text-sm">
          Encontrá respuestas rápidas a tus consultas más comunes.
        </p>
      </div>

      {items.length > 0 ? (
        <FaqAccordion items={items} />
      ) : (
        <p className="text-center text-[#555555]">Próximamente.</p>
      )}
    </main>
  )
}
