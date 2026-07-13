'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveSiteConfig(flags: Record<string, boolean | string>) {
  const supabase = await createClient()

  const entries = Object.entries(flags).map(([clave, value]) => ({
    clave,
    valor: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('configuracion')
    .upsert(entries, { onConflict: 'clave' })

  if (error) return { success: false, error: error.message }

  revalidateTag('site-config', 'max')
  revalidateTag('theme-config', 'max')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function revalidateConfig() {
  'use server'
  revalidateTag('site-config', 'max')
  revalidatePath('/', 'layout')
}
