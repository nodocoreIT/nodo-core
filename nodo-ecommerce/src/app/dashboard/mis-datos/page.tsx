import { redirect } from 'next/navigation'

export default function MisDatosPage() {
  redirect('/dashboard/configuracion?tab=mis-datos')
}
