import { createClient } from '@/lib/supabase/server'
import ProveedoresClient from '@/components/dashboard/ProveedoresClient'

export default async function ProveedoresPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('proveedores')
    .select('id, nombre, razon_social, cuit, direccion, ciudad, provincia, telefono, email, horarios, notas, activo')
    .order('nombre')

  return <ProveedoresClient proveedores={data || []} />
}
