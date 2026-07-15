export const THEME_DEFAULTS = {
  // Dark mode colors
  color_primary: '#D4AF37',
  color_primary_light: '#E8C84A',
  color_primary_dark: '#B8941F',
  color_bg: '#000000',
  color_surface: '#0D0D0D',
  color_text: '#FFFFFF',
  color_nav_subcategory: '#715F24',
  // Light mode colors
  light_color_primary: '#D4AF37',
  light_color_primary_light: '#E8C84A',
  light_color_primary_dark: '#B8941F',
  light_color_bg: '#f5f4f0',
  light_color_surface: '#eae9e4',
  light_color_text: '#111111',
  light_color_nav_subcategory: '#8B6914',
  // Site identity
  site_name: 'Mi Tienda',
  site_tagline: 'Tu tienda online',
  logo_url: '',
  favicon_url: '',
  nav_modules_enabled: '["productos","carrousel","pedidos","vendedoras","categorias","notas","datos-bancarios","mis-datos"]',
  site_theme: 'dark',
} as const

export type ThemeConfig = typeof THEME_DEFAULTS
