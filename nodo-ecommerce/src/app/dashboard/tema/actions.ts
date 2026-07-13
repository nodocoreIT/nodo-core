'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ThemeConfig } from '@/lib/theme/defaults'

type SaveResult = { success: boolean; error?: string }

/**
 * Upserts theme config keys into the `configuracion` table.
 * Accepts a partial ThemeConfig — only provided keys are upserted.
 * Calls updateTag('theme-config') so the next layout render
 * picks up the new values immediately.
 */
export async function saveThemeConfig(
  partial: Partial<ThemeConfig>
): Promise<SaveResult> {
  try {
    const supabase = await createClient()

    const rows = Object.entries(partial).map(([clave, valor]) => ({
      clave,
      valor: String(valor),
      updated_at: new Date().toISOString(),
    }))

    if (rows.length === 0) return { success: true }

    const { error } = await supabase
      .from('configuracion')
      .upsert(rows, { onConflict: 'clave' })

    if (error) return { success: false, error: error.message }

    revalidateTag('theme-config', 'max')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return { success: false, error: message }
  }
}

/**
 * Uploads a branding asset (logo or favicon) to the `branding` Storage bucket.
 * Stores the resulting public URL in `configuracion` under `logo_url` or `favicon_url`.
 * Returns the public URL on success.
 */
export async function uploadBrandingAsset(
  formData: FormData,
  field: 'logo_url' | 'favicon_url'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'No se proporcionó ningún archivo.' }
    }

    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'El archivo debe ser una imagen válida.' }
    }

    const supabase = await createClient()

    const ext = file.name.split('.').pop() ?? 'png'
    const prefix = field.replace('_url', '')
    const path = `${prefix}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: urlData } = supabase.storage
      .from('branding')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    const result = await saveThemeConfig({ [field]: publicUrl } as Partial<ThemeConfig>)
    if (!result.success) return result

    return { success: true, url: publicUrl }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return { success: false, error: message }
  }
}
