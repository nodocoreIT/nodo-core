'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, RotateCcw, X, Palette, Globe, Sun, Moon } from 'lucide-react'
import { ThemeConfig, THEME_DEFAULTS } from '@/lib/theme/defaults'
import { saveThemeConfig, uploadBrandingAsset } from '@/app/dashboard/tema/actions'

interface TemaEditorProps {
  initialConfig: ThemeConfig
}

const DARK_COLOR_VAR_MAP: Record<string, string> = {
  color_primary: '--color-gold',
  color_primary_light: '--color-gold-light',
  color_primary_dark: '--color-gold-dark',
  color_bg: '--color-luxury-black',
  color_surface: '--color-luxury-gray',
  color_text: '--color-text',
  color_nav_subcategory: '--color-nav-subcategory',
}

const COLOR_FIELDS: Array<{ darkKey: keyof ThemeConfig; lightKey: keyof ThemeConfig; label: string }> = [
  { darkKey: 'color_primary', lightKey: 'light_color_primary', label: 'Color principal' },
  { darkKey: 'color_primary_light', lightKey: 'light_color_primary_light', label: 'Color Hover (Mouse encima)' },
  { darkKey: 'color_primary_dark', lightKey: 'light_color_primary_dark', label: 'Color principal oscuro' },
  { darkKey: 'color_bg', lightKey: 'light_color_bg', label: 'Color de fondo' },
  { darkKey: 'color_surface', lightKey: 'light_color_surface', label: 'Color de superficie' },
  { darkKey: 'color_text', lightKey: 'light_color_text', label: 'Color de texto' },
  { darkKey: 'color_nav_subcategory', lightKey: 'light_color_nav_subcategory', label: 'Color subcategorías del menú' },
]

const inputClass =
  'w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]'
const labelClass = 'block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5'

function buildLightCss(colors: Record<string, string>): string {
  return `html[data-theme="light"],[data-theme="light"]{--color-gold:${colors.light_color_primary};--color-gold-light:${colors.light_color_primary_light};--color-gold-dark:${colors.light_color_primary_dark};--color-luxury-black:${colors.light_color_bg};--color-luxury-gray:${colors.light_color_surface};--color-text:${colors.light_color_text};--color-nav-subcategory:${colors.light_color_nav_subcategory};}`
}

export default function TemaEditor({ initialConfig }: TemaEditorProps) {
  const [siteTheme, setSiteTheme] = useState<'dark' | 'light'>(
    (initialConfig.site_theme as 'dark' | 'light') ?? 'dark'
  )
  const [colorTab, setColorTab] = useState<'dark' | 'light'>('dark')

  const [darkColors, setDarkColors] = useState<Record<string, string>>({
    color_primary: initialConfig.color_primary,
    color_primary_light: initialConfig.color_primary_light,
    color_primary_dark: initialConfig.color_primary_dark,
    color_bg: initialConfig.color_bg,
    color_surface: initialConfig.color_surface,
    color_text: initialConfig.color_text,
    color_nav_subcategory: initialConfig.color_nav_subcategory,
  })

  const [lightColors, setLightColors] = useState<Record<string, string>>({
    light_color_primary: initialConfig.light_color_primary,
    light_color_primary_light: initialConfig.light_color_primary_light,
    light_color_primary_dark: initialConfig.light_color_primary_dark,
    light_color_bg: initialConfig.light_color_bg,
    light_color_surface: initialConfig.light_color_surface,
    light_color_text: initialConfig.light_color_text,
    light_color_nav_subcategory: initialConfig.light_color_nav_subcategory,
  })

  const [siteName, setSiteName] = useState<string>(initialConfig.site_name)
  const [siteTagline, setSiteTagline] = useState<string>(initialConfig.site_tagline)
  const [logoUrl, setLogoUrl] = useState<string>(initialConfig.logo_url)
  const [faviconUrl, setFaviconUrl] = useState<string>(initialConfig.favicon_url)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState('')
  const [faviconError, setFaviconError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const originalCssVars = useRef<Record<string, string>>({})

  // Inject live light-mode style tag
  const lightStyleRef = useRef<HTMLStyleElement | null>(null)

  useEffect(() => {
    // Store original CSS vars
    Object.values(DARK_COLOR_VAR_MAP).forEach((cssVar) => {
      originalCssVars.current[cssVar] =
        getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    })
    // Apply dark mode colors on mount
    Object.entries(DARK_COLOR_VAR_MAP).forEach(([key, cssVar]) => {
      const value = initialConfig[key as keyof ThemeConfig]
      if (value) document.documentElement.style.setProperty(cssVar, value)
    })

    // Create a style element for live light-mode preview
    const el = document.createElement('style')
    el.id = 'live-light-theme'
    el.textContent = buildLightCss({
      light_color_primary: initialConfig.light_color_primary,
      light_color_primary_light: initialConfig.light_color_primary_light,
      light_color_primary_dark: initialConfig.light_color_primary_dark,
      light_color_bg: initialConfig.light_color_bg,
      light_color_surface: initialConfig.light_color_surface,
      light_color_text: initialConfig.light_color_text,
      light_color_nav_subcategory: initialConfig.light_color_nav_subcategory,
    })
    document.head.appendChild(el)
    lightStyleRef.current = el

    return () => {
      el.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDarkColorChange(key: string, value: string) {
    setDarkColors((prev) => ({ ...prev, [key]: value }))
    const cssVar = DARK_COLOR_VAR_MAP[key]
    if (cssVar) document.documentElement.style.setProperty(cssVar, value)
  }

  function handleLightColorChange(key: string, value: string) {
    setLightColors((prev) => {
      const next = { ...prev, [key]: value }
      if (lightStyleRef.current) {
        lightStyleRef.current.textContent = buildLightCss(next)
      }
      return next
    })
  }

  function handleResetDefaults() {
    const defaultDark: Record<string, string> = {
      color_primary: THEME_DEFAULTS.color_primary,
      color_primary_light: THEME_DEFAULTS.color_primary_light,
      color_primary_dark: THEME_DEFAULTS.color_primary_dark,
      color_bg: THEME_DEFAULTS.color_bg,
      color_surface: THEME_DEFAULTS.color_surface,
      color_text: THEME_DEFAULTS.color_text,
      color_nav_subcategory: THEME_DEFAULTS.color_nav_subcategory,
    }
    const defaultLight: Record<string, string> = {
      light_color_primary: THEME_DEFAULTS.light_color_primary,
      light_color_primary_light: THEME_DEFAULTS.light_color_primary_light,
      light_color_primary_dark: THEME_DEFAULTS.light_color_primary_dark,
      light_color_bg: THEME_DEFAULTS.light_color_bg,
      light_color_surface: THEME_DEFAULTS.light_color_surface,
      light_color_text: THEME_DEFAULTS.light_color_text,
      light_color_nav_subcategory: THEME_DEFAULTS.light_color_nav_subcategory,
    }
    setDarkColors(defaultDark)
    setLightColors(defaultLight)
    Object.entries(DARK_COLOR_VAR_MAP).forEach(([key, cssVar]) => {
      const value = defaultDark[key]
      if (value) document.documentElement.style.setProperty(cssVar, value)
    })
    if (lightStyleRef.current) {
      lightStyleRef.current.textContent = buildLightCss(defaultLight)
    }
    toast('Valores restaurados a los predeterminados. Guardá para aplicar.', { icon: '↩' })
  }

  function handleCancel() {
    Object.entries(originalCssVars.current).forEach(([cssVar, value]) => {
      if (value) document.documentElement.style.setProperty(cssVar, value)
    })
    const origDark = {
      color_primary: initialConfig.color_primary,
      color_primary_light: initialConfig.color_primary_light,
      color_primary_dark: initialConfig.color_primary_dark,
      color_bg: initialConfig.color_bg,
      color_surface: initialConfig.color_surface,
      color_text: initialConfig.color_text,
      color_nav_subcategory: initialConfig.color_nav_subcategory,
    }
    const origLight = {
      light_color_primary: initialConfig.light_color_primary,
      light_color_primary_light: initialConfig.light_color_primary_light,
      light_color_primary_dark: initialConfig.light_color_primary_dark,
      light_color_bg: initialConfig.light_color_bg,
      light_color_surface: initialConfig.light_color_surface,
      light_color_text: initialConfig.light_color_text,
      light_color_nav_subcategory: initialConfig.light_color_nav_subcategory,
    }
    setDarkColors(origDark)
    setLightColors(origLight)
    if (lightStyleRef.current) {
      lightStyleRef.current.textContent = buildLightCss(origLight)
    }
    setSiteName(initialConfig.site_name)
    setSiteTagline(initialConfig.site_tagline)
    setLogoFile(null)
    setFaviconFile(null)
    setLogoError('')
    setFaviconError('')
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('El archivo debe ser una imagen válida (PNG, JPG, SVG, WebP).')
      e.target.value = ''
      return
    }
    setLogoError('')
    setLogoFile(file)
  }

  function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFaviconError('El archivo debe ser una imagen válida (PNG, ICO, SVG).')
      e.target.value = ''
      return
    }
    setFaviconError('')
    setFaviconFile(file)
  }

  async function handleUploadLogo() {
    if (!logoFile) return
    setUploadingLogo(true)
    const fd = new FormData()
    fd.append('file', logoFile)
    const result = await uploadBrandingAsset(fd, 'logo_url')
    setUploadingLogo(false)
    if (result.success && result.url) {
      setLogoUrl(result.url)
      setLogoFile(null)
      toast.success('Logo actualizado correctamente.')
    } else {
      toast.error(result.error ?? 'Error al subir el logo.')
    }
  }

  async function handleUploadFavicon() {
    if (!faviconFile) return
    setUploadingFavicon(true)
    const fd = new FormData()
    fd.append('file', faviconFile)
    const result = await uploadBrandingAsset(fd, 'favicon_url')
    setUploadingFavicon(false)
    if (result.success && result.url) {
      setFaviconUrl(result.url)
      setFaviconFile(null)
      toast.success('Favicon actualizado correctamente.')
    } else {
      toast.error(result.error ?? 'Error al subir el favicon.')
    }
  }

  async function handleSave() {
    setSaving(true)
    const partial: Partial<ThemeConfig> = {
      ...darkColors,
      ...lightColors,
      site_name: siteName,
      site_tagline: siteTagline,
      site_theme: siteTheme,
    } as Partial<ThemeConfig>

    const result = await saveThemeConfig(partial)
    setSaving(false)

    if (result.success) {
      toast.success('Cambios guardados correctamente.')
    } else {
      toast.error(result.error ?? 'Error al guardar los cambios.')
    }
  }

  const activeColors = colorTab === 'dark' ? darkColors : lightColors
  const handleColorChange = colorTab === 'dark' ? handleDarkColorChange : handleLightColorChange

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
        <h1 className="text-white text-2xl font-serif">Editor de Tema</h1>
        <p className="text-[#555555] text-sm mt-1">
          Personalizá los colores, la identidad visual y la navegación del sitio.
        </p>
      </div>

      {/* ===== SECCIÓN: COLORES ===== */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Palette size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Colores de Marca</h2>
        </div>

        {/* Tabs Oscuro / Claro */}
        <div className="flex border-b border-luxury-gray">
          <button
            type="button"
            onClick={() => setColorTab('dark')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-wider border-b-2 transition-colors ${
              colorTab === 'dark'
                ? 'border-gold text-gold'
                : 'border-transparent text-luxury-gray-light hover:text-white'
            }`}
          >
            <Moon size={13} />
            Modo Oscuro
          </button>
          <button
            type="button"
            onClick={() => setColorTab('light')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-wider border-b-2 transition-colors ${
              colorTab === 'light'
                ? 'border-gold text-gold'
                : 'border-transparent text-luxury-gray-light hover:text-white'
            }`}
          >
            <Sun size={13} />
            Modo Claro
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COLOR_FIELDS.map(({ darkKey, lightKey, label }) => {
              const stateKey = colorTab === 'dark' ? darkKey : lightKey
              const value = activeColors[stateKey as string] ?? '#000000'
              return (
                <div key={stateKey} className="space-y-2">
                  <label className={labelClass}>{label}</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded border border-luxury-gray-mid shrink-0"
                      style={{ backgroundColor: value }}
                    />
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => handleColorChange(stateKey as string, e.target.value)}
                      className="w-10 h-8 cursor-pointer bg-transparent border-0 p-0"
                      title={label}
                    />
                    <span className="text-luxury-gray-light text-xs font-mono uppercase">{value}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-luxury-gray">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-gold border border-luxury-gray-mid hover:border-gold/40 px-3 py-2 transition-colors"
            >
              <RotateCcw size={13} />
              Restaurar valores predeterminados
            </button>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN: MODO VISUAL ===== */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          {siteTheme === 'dark' ? <Moon size={14} className="text-gold" /> : <Sun size={14} className="text-gold" />}
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Modo Visual del Sitio</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-[#555555] text-xs mb-4">
            Define el tema visual del sitio público para todos los visitantes.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSiteTheme('dark')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider border transition-all ${
                siteTheme === 'dark'
                  ? 'bg-gold text-black border-gold'
                  : 'bg-transparent text-luxury-gray-light border-luxury-gray-mid hover:border-gold/40 hover:text-white'
              }`}
            >
              <Moon size={13} />
              Oscuro
            </button>
            <button
              type="button"
              onClick={() => setSiteTheme('light')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider border transition-all ${
                siteTheme === 'light'
                  ? 'bg-gold text-black border-gold'
                  : 'bg-transparent text-luxury-gray-light border-luxury-gray-mid hover:border-gold/40 hover:text-white'
              }`}
            >
              <Sun size={13} />
              Claro
            </button>
          </div>
        </div>
      </section>

      {/* ===== SECCIÓN: IDENTIDAD ===== */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
          <Globe size={14} className="text-gold" />
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase">Identidad del Sitio</h2>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div>
            <label className={labelClass}>Nombre del sitio</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className={inputClass}
              placeholder="Ej: Mi Tienda"
            />
          </div>
          <div>
            <label className={labelClass}>Tagline</label>
            <input
              type="text"
              value={siteTagline}
              onChange={(e) => setSiteTagline(e.target.value)}
              className={inputClass}
              placeholder="Ej: Tu tienda online"
            />
          </div>

          {/* Logo upload */}
          <div>
            <label className={labelClass}>Logo del sitio</label>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo actual"
                className="h-12 mb-3 object-contain border border-luxury-gray-mid p-1 bg-[#111]"
              />
            )}
            <div className="flex items-start gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="flex-1 text-xs text-luxury-gray-light bg-[#111111] border border-luxury-gray-mid px-3 py-2 file:mr-3 file:py-1 file:px-2 file:text-xs file:border-0 file:bg-gold file:text-black file:cursor-pointer hover:file:bg-gold-light cursor-pointer"
              />
              {logoFile && (
                <button
                  type="button"
                  onClick={handleUploadLogo}
                  disabled={uploadingLogo}
                  className="flex items-center gap-1.5 bg-gold text-black font-bold px-3 py-2 text-xs tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors shrink-0"
                >
                  {uploadingLogo ? 'Subiendo...' : 'Subir'}
                </button>
              )}
            </div>
            {logoError && <p className="text-red-400 text-xs mt-1">{logoError}</p>}
          </div>

          {/* Favicon upload */}
          <div>
            <label className={labelClass}>Favicon</label>
            {faviconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt="Favicon actual"
                className="h-8 mb-3 object-contain border border-luxury-gray-mid p-1 bg-[#111]"
              />
            )}
            <div className="flex items-start gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFaviconChange}
                className="flex-1 text-xs text-luxury-gray-light bg-[#111111] border border-luxury-gray-mid px-3 py-2 file:mr-3 file:py-1 file:px-2 file:text-xs file:border-0 file:bg-gold file:text-black file:cursor-pointer hover:file:bg-gold-light cursor-pointer"
              />
              {faviconFile && (
                <button
                  type="button"
                  onClick={handleUploadFavicon}
                  disabled={uploadingFavicon}
                  className="flex items-center gap-1.5 bg-gold text-black font-bold px-3 py-2 text-xs tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors shrink-0"
                >
                  {uploadingFavicon ? 'Subiendo...' : 'Subir'}
                </button>
              )}
            </div>
            {faviconError && <p className="text-red-400 text-xs mt-1">{faviconError}</p>}
          </div>
        </div>
      </section>

      {/* ===== ACCIONES ===== */}
      <div className="flex items-center gap-3 pb-8">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2.5 text-sm tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
        >
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="flex items-center gap-2 border border-luxury-gray-mid text-luxury-gray-light hover:text-white hover:border-gold/50 px-5 py-2.5 text-sm transition-colors"
        >
          <X size={15} />
          Descartar
        </button>
      </div>
    </div>
  )
}
