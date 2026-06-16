import type { AutomationDef } from "./types";

export const AUTOMATIONS: AutomationDef[] = [
  // WhatsApp Bot
  {
    id: "wa-bot-queries",
    title: "Respuesta automática por WhatsApp",
    description:
      "Un bot responde consultas frecuentes de inquilinos y propietarios por WhatsApp las 24 horas.",
    category: "whatsapp",
    status: "coming_soon",
  },
  {
    id: "wa-expiry-alerts",
    title: "Avisos de vencimiento y mora",
    description:
      "Notificaciones automáticas por WhatsApp cuando se acerca el vencimiento de un alquiler o hay mora.",
    category: "whatsapp",
    status: "coming_soon",
  },
  // Internal
  {
    id: "auto-contract",
    title: "Generación automática de contrato",
    description:
      "Al cargar propiedad, propietario e inquilino, el sistema pre-completa el borrador del contrato.",
    category: "internal",
    status: "active",
    configHint:
      "Disponible al crear un nuevo contrato cuando la propiedad tiene propietario asignado.",
  },
  {
    id: "employee-stats",
    title: "Estadísticas de ventas por empleado",
    description:
      "Panel de productividad que muestra contratos y propiedades gestionadas por cada agente.",
    category: "internal",
    status: "coming_soon",
  },
  // Payments
  {
    id: "mercadopago",
    title: "Cobros online con Mercado Pago",
    description:
      "Los inquilinos pueden pagar el alquiler directamente desde su portal con Mercado Pago.",
    category: "payments",
    status: "coming_soon",
  },
  // Email
  {
    id: "gmail-integration",
    title: "Integración con Gmail",
    description:
      "Envío de recibos, avisos y contratos directamente desde la cuenta de Gmail de la agencia.",
    category: "email",
    status: "coming_soon",
  },
  // Sheets
  {
    id: "google-sheets",
    title: "Sincronización con Google Sheets",
    description:
      "Exportación automática de propiedades, contratos y pagos a una planilla de Google.",
    category: "sheets",
    status: "coming_soon",
  },
  // Social
  {
    id: "social-auto",
    title: "Publicación automática en redes sociales",
    description:
      "Al publicar una propiedad disponible, se genera y publica automáticamente en Instagram y Facebook.",
    category: "social",
    status: "coming_soon",
  },
];
