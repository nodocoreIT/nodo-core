'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateProductoImages(
  id: string,
  imagen_url: string | null,
  imagenes_adicionales: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('productos')
      .update({ imagen_url, imagenes_adicionales, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}
