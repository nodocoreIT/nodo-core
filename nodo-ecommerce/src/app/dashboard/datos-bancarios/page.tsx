import { redirect } from 'next/navigation'

export default function DatosBancariosPage() {
  redirect('/dashboard/configuracion?tab=datos-bancarios')
}
