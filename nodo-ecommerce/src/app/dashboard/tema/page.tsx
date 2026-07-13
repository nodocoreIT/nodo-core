import { getThemeConfig } from '@/lib/theme/getThemeConfig'
import TemaEditor from '@/components/dashboard/TemaEditor'

export const metadata = {
  title: 'Editor de Tema — Dashboard',
}

export default async function TemaPage() {
  const config = await getThemeConfig()

  return <TemaEditor initialConfig={config} />
}
