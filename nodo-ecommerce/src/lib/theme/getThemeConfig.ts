import { cacheTag, cacheLife } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { THEME_DEFAULTS, ThemeConfig } from './defaults'

const THEME_KEYS = Object.keys(THEME_DEFAULTS) as (keyof ThemeConfig)[]

export async function getThemeConfig(): Promise<ThemeConfig> {
  'use cache'
  cacheTag('theme-config')
  cacheLife('hours')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return { ...THEME_DEFAULTS }
  }

  try {
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', THEME_KEYS)

    if (error || !data) {
      return { ...THEME_DEFAULTS }
    }

    const dbValues = Object.fromEntries(data.map((row) => [row.clave, row.valor]))

    return THEME_KEYS.reduce((acc, key) => {
      acc[key] = (dbValues[key] ?? THEME_DEFAULTS[key]) as never
      return acc
    }, {} as Record<keyof ThemeConfig, string>) as ThemeConfig
  } catch {
    return { ...THEME_DEFAULTS }
  }
}
