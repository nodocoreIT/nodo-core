export const PROJECT_TYPES = [
  { id: 'web', label: 'Sitio web / landing' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'webapp', label: 'Web app / panel admin' },
  { id: 'n8n', label: 'Automatización (n8n)' },
];

export const PROJECT_LABELS = Object.fromEntries(
  PROJECT_TYPES.map((t) => [t.id, t.label]),
);

export const REF_TABLES = {
  web: {
    caption: 'Sitio web / landing — horas de referencia',
    rows: [
      ['Landing de una sola página (5–8 secciones)', '16–28 hs'],
      ['Sitio institucional multi-página (5–10 páginas)', '30–50 hs'],
      ['Formulario de contacto + integración email', '4–8 hs'],
      ['Blog / sección de noticias con CMS simple', '15–25 hs'],
      ['Optimización SEO básica + performance', '8–15 hs'],
      ['Multi-idioma', '10–20 hs'],
    ],
  },
  ecommerce: {
    caption: 'E-commerce — horas de referencia',
    rows: [
      ['Catálogo de productos + filtros', '20–35 hs'],
      ['Carrito de compras + checkout', '20–35 hs'],
      ['Integración de pagos (Mercado Pago / Stripe)', '12–25 hs'],
      ['Gestión de stock e inventario', '15–30 hs'],
      ['Panel admin para cargar productos', '20–35 hs'],
      ['Envíos / integración con correo', '10–20 hs'],
    ],
  },
  webapp: {
    caption: 'Web app / panel de administración — horas de referencia',
    rows: [
      ['Autenticación + roles y permisos', '15–25 hs'],
      ['CRUD de entidades principales (por módulo)', '10–20 hs'],
      ['Dashboard con métricas / gráficos', '20–40 hs'],
      ['Exportación de reportes (PDF / Excel)', '8–15 hs'],
      ['Notificaciones (email / push)', '8–15 hs'],
      ['Integración con API externa', '10–20 hs'],
      ['Tests automatizados', '15–30 hs'],
    ],
  },
  n8n: {
    caption: 'Automatización n8n — horas de referencia',
    rows: [
      ['Flujo simple (1 trigger, 1–2 acciones)', '4–8 hs'],
      ['Flujo medio (varios pasos, condicionales)', '10–20 hs'],
      ['Flujo complejo (múltiples integraciones, reintentos, manejo de errores)', '20–40 hs'],
      ['Por cada integración/API adicional', '5–10 hs'],
      ['Dashboard de monitoreo de flujos', '15–25 hs'],
      ['Documentación y capacitación al cliente', '5–10 hs'],
    ],
  },
  mixto: {
    caption: 'Mixto (web app + automatización) — horas de referencia',
    rows: [
      ['Base de web app (auth + CRUD + dashboard)', '80–150 hs'],
      ['Automatizaciones conectadas (por flujo)', '10–25 hs'],
      ['Integración entre el panel y n8n (webhooks, triggers)', '10–20 hs'],
      ['Monitoreo y logs centralizados', '12–20 hs'],
    ],
  },
};

/** ponytail: parsea "16–28 hs" o "16-28 hs" → punto medio */
export function parseHoursRange(str) {
  const m = str.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return 0;
  return (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2;
}

if (import.meta.env?.DEV) {
  console.assert(parseHoursRange('16–28 hs') === 22, 'parseHoursRange en-dash');
  console.assert(parseHoursRange('10-20 hs') === 15, 'parseHoursRange hyphen');
}
