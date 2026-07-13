import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { getSiteConfig } from '@/lib/site-config/getSiteConfig'

async function getNosotrosContent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['nosotros_titulo', 'nosotros_subtitulo', 'nosotros_texto'])

  const kv = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor ?? '']))
  return {
    titulo: kv.nosotros_titulo || 'Quiénes Somos',
    subtitulo: kv.nosotros_subtitulo || '',
    texto: kv.nosotros_texto || '',
  }
}

export default async function QuienesSomosPage() {
  const [siteConfig, content] = await Promise.all([getSiteConfig(), getNosotrosContent()])

  if (!siteConfig.feature_nosotros) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 className="font-serif text-4xl md:text-5xl text-gold mb-4">{content.titulo}</h1>
      {content.subtitulo && (
        <p className="text-white text-lg leading-relaxed mb-10 border-l-2 border-gold pl-4">
          {content.subtitulo}
        </p>
      )}
      {content.texto ? (
        <div
          className="rich-content text-white leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content.texto }}
        />
      ) : (
        <p className="text-[#555555]">Contenido próximamente.</p>
      )}
    </main>
  )
}
