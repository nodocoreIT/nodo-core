import { redirect } from 'next/navigation'

export default function ConfiguracionSitioPage() {
  redirect('/dashboard/configuracion?tab=sitio')
}
