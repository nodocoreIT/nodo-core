import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Database,
  FileCheck,
  FileDown,
  FlaskConical,
  Heart,
  History,
  Home,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Mic,
  NotebookText,
  Palette,
  Pill,
  Plug,
  Radio,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  UserCog,
  UserRound,
  Video,
} from "lucide-react";
import type { NodoRoadmap } from "./types";

export const NODO_CLINICA_ROADMAP: NodoRoadmap = {
  nodoCode: "clinica",
  nodoLabel: "Nodo Clínica",
  updatedAt: "2026-08-08",
  qaNotes: [
    "Mis estudios (paciente): la UI de carga de archivos existe pero es un \"coming soon\" — nada se persiste todavía.",
    "Integraciones (configuración de paciente): placeholder \"próximamente\", sin funcionalidad real.",
    "Recordatorios de turno (médico): completo en el backend, pero la pestaña está deshabilitada en el modal de Configuración — sigue activa en la versión de página completa /medico/configuracion. Las dos superficies de settings están desincronizadas.",
    "Interconsultas: conviven dos implementaciones (InterconsultPanel vs NodoChatWidget) — solo el Nodo Chat (con gate de plan Pro) está enrutado hoy. Confirmar si InterconsultPanel sigue siendo alcanzable.",
    "paciente-portal.tsx parece un portal legacy de una sola pantalla, duplicado del flujo multi-ruta actual, con un placeholder sin terminar (\"aaa\"). Confirmar si todavía es alcanzable desde algún punto de entrada.",
    "Hay tres conceptos de \"suscripción\" distintos y fáciles de confundir: plan personal del médico en Nodo Clínica, suscripción de la clínica a Nodo Core (plataforma), y plan del paciente (Gratuito/Pago).",
    "Historial clínico del paciente está paywalleado al Plan Pago — confirmar que el gating funciona en ambos sentidos (bloquea Gratuito, desbloquea Pago).",
  ],
  items: [
    // ── MÉDICO ──────────────────────────────────────────────────────────────
    {
      id: "medico-cuenta",
      side: "medico",
      category: "Cuenta y acceso",
      title: "Registro, login y onboarding",
      description:
        "Login separado en /login/medico, registro guiado con DNI y matrícula, modal de aceptación de términos, recuperación/actualización de contraseña, selector de rol entre nodos y bloqueo de acceso si la suscripción de la plataforma está impaga.",
      status: "disponible",
      icon: UserCog,
    },
    {
      id: "medico-dashboard",
      side: "medico",
      category: "Inicio",
      title: "Dashboard con accesos rápidos y tareas del día",
      description:
        "Saludo personalizado, 4 accesos directos (Consultorio, Interconsultas, Turnos, Recetas/Estudios), lista de tareas del día (turnos + manuales), estadísticas y próximos turnos, todo desde /medico/dashboard.",
      status: "disponible",
      icon: LayoutDashboard,
    },
    {
      id: "medico-consultorio",
      side: "medico",
      category: "Consultorio virtual",
      title: "Espacio de trabajo en vivo durante la consulta",
      description:
        "Cola de pacientes en tiempo real, búsqueda y vista previa de pacientes, videollamada (Jitsi/JaaS) sin sala de espera previa con chat y fondo virtual, panel de \"Acción Inmediata\" (Archivos/Historial/Informe/Notas), alertas clínicas del paciente y layout de widgets personalizable.",
      status: "disponible",
      icon: Stethoscope,
    },
    {
      id: "medico-recetas",
      side: "medico",
      category: "Recetas",
      title: "Recetario digital",
      description:
        "Múltiples medicamentos por receta con autocompletado contra vademécum, firma del médico (texto o imagen) insertada automáticamente, generación de PDF, envío por email al paciente y guardado en la historia clínica.",
      status: "disponible",
      icon: Pill,
    },
    {
      id: "medico-estudios",
      side: "medico",
      category: "Estudios",
      title: "Solicitud de estudios médicos",
      description:
        "Catálogo de estudios por categoría más etiquetas personalizadas reutilizables, selección múltiple, observaciones para el laboratorio, PDF firmado y guardado automático en la historia clínica del paciente.",
      status: "disponible",
      icon: FlaskConical,
    },
    {
      id: "medico-informe-ia",
      side: "medico",
      category: "Informe clínico (IA)",
      title: "Informe clínico asistido por IA",
      description:
        "Dictado por voz o texto de la consulta, generación de informe estructurado vía IA (con borrador local de respaldo si se agota la cuota), edición antes de guardar, PDF con firma, y resumen SOAP generado por IA.",
      status: "disponible",
      icon: Sparkles,
    },
    {
      id: "medico-historia",
      side: "medico",
      category: "Notas e historia clínica",
      title: "Notas de consulta e historia clínica completa",
      description:
        "Editor de notas en vivo durante la consulta (con dictado), línea de tiempo completa de la historia clínica del paciente (recetas, estudios, informes, notas) con borrado y exportación a PDF, y panel de documentos subidos por el paciente.",
      status: "disponible",
      icon: NotebookText,
    },
    {
      id: "medico-notificaciones",
      side: "medico",
      category: "Notificaciones",
      title: "Campana de notificaciones",
      description:
        "Avisos de documento subido por el paciente, paciente esperando, pago por Mercado Pago o transferencia pendiente, con deep-link a la pantalla correspondiente y marcado de leído. Tiempo real vía Supabase en modo plataforma.",
      status: "disponible",
      icon: Bell,
    },
    {
      id: "medico-agenda",
      side: "medico",
      category: "Agenda y turnos",
      title: "Configuración de agenda y gestión de turnos",
      description:
        "Disponibilidad por día de la semana con múltiples franjas, duración de turno configurable, días libres/feriados, asignación manual de turnos, calendario de turnos programados y cancelación con reembolso (Mercado Pago o transferencia manual).",
      status: "disponible",
      icon: CalendarDays,
    },
    {
      id: "medico-cobros",
      side: "medico",
      category: "Cobros",
      title: "Cobros y validación de pagos",
      description:
        "Listado de pagos filtrable por estado, validación automática de comprobantes de transferencia con IA, aprobación/rechazo manual, contacto por WhatsApp, conexión OAuth con Mercado Pago propio, cuenta bancaria alternativa, y libro contable de pagos.",
      status: "disponible",
      icon: CreditCard,
    },
    {
      id: "medico-interconsultas",
      side: "medico",
      category: "Interconsultas",
      title: "Chat entre colegas (Nodo Chat)",
      description:
        "Chat del ecosistema Nodo con presencia en línea y directorio de contactos, embebido o flotante. Requiere plan Pro — los médicos sin ese plan ven una pantalla de upsell en su lugar.",
      status: "parcial",
      icon: MessagesSquare,
    },
    {
      id: "medico-configuracion",
      side: "medico",
      category: "Configuración",
      title: "Configuración de cuenta y consultorio",
      description:
        "Perfil (matrícula, especialidades, foto, firma, calendario de Google), cobros, días libres, apariencia del panel, suscripción personal a Nodo Clínica y suscripción de la clínica a la plataforma (Nodo Core) — dos sistemas de facturación distintos en la misma pantalla.",
      status: "disponible",
      icon: Settings,
    },
    {
      id: "medico-integraciones",
      side: "medico",
      category: "Integraciones de plataforma",
      title: "Directorios y catálogos compartidos",
      description:
        "Directorio médico y farmacias de turno (alimentan el portal del paciente), catálogo de obras sociales para el onboarding, y directorio de médicos para la búsqueda del paciente — actualizados por tareas programadas (cron).",
      status: "disponible",
      icon: Plug,
    },

    // ── PACIENTE ─────────────────────────────────────────────────────────────
    {
      id: "paciente-cuenta",
      side: "paciente",
      category: "Cuenta y acceso",
      title: "Registro, login y onboarding",
      description:
        "Login separado en /login/paciente, registro con DNI, dirección y búsqueda de obra social, detección de DNI duplicado, acceso público a \"pedir turno\" sin estar logueado, y foto de perfil desde el header.",
      status: "disponible",
      icon: UserRound,
    },
    {
      id: "paciente-inicio",
      side: "paciente",
      category: "Inicio",
      title: "Dashboard con accesos rápidos y datos útiles",
      description:
        "Saludo personalizado, 4 accesos directos (Turnos, Estudios, Historial, Buscar médico), calendario de farmacia de turno con geolocalización \"más cercana\", y widgets de laboratorios/diagnóstico por imágenes cercanos.",
      status: "disponible",
      icon: Home,
    },
    {
      id: "paciente-buscar-medico",
      side: "paciente",
      category: "Buscar médico y reservar turno",
      title: "Directorio de médicos y wizard de reserva",
      description:
        "Búsqueda por nombre/especialidad/matrícula con filtro de especialidad, y un wizard de reserva de varios pasos: horario, pago (Mercado Pago o transferencia con comprobante validado por IA), motivo de consulta (con dictado por voz), estudios previos opcionales, y confirmación.",
      status: "disponible",
      icon: Search,
    },
    {
      id: "paciente-turnos",
      side: "paciente",
      category: "Mis turnos",
      title: "Gestión de turnos propios",
      description:
        "Listado de turnos con estados (programado, en espera, en consulta, pago pendiente, en revisión, cancelado), acceso directo a la sala de espera o a completar el pago pendiente, y eliminación de turnos.",
      status: "disponible",
      icon: CalendarCheck,
    },
    {
      id: "paciente-sala-espera",
      side: "paciente",
      category: "Sala de espera",
      title: "Sala de espera con pago, intake y videollamada",
      description:
        "Estados de pago con validación automática por IA, posición en la cola, motivo de consulta (texto o voz), carga de estudios previos con vista previa, detección automática de cuándo el médico está listo, videollamada sin sala previa, y documentos emitidos en vivo por el médico.",
      status: "disponible",
      icon: Video,
    },
    {
      id: "paciente-estudios",
      side: "paciente",
      category: "Mis estudios",
      title: "Repositorio de estudios propios",
      description:
        "Pantalla \"estamos trabajando en este módulo\" — la interfaz de carga de archivos ya existe (drag & drop, PDF/imágenes/DICOM hasta 20MB) pero todavía no persiste ni envía nada.",
      status: "proximamente",
      icon: FlaskConical,
    },
    {
      id: "paciente-historial",
      side: "paciente",
      category: "Historial clínico",
      title: "Línea de tiempo de la historia clínica",
      description:
        "Vista cronológica completa de consultas, recetas, estudios e informes. Disponible solo para pacientes con Plan Pago — el plan Gratuito ve una pantalla de bloqueo.",
      status: "parcial",
      icon: History,
    },
    {
      id: "paciente-salud",
      side: "paciente",
      category: "Mi salud",
      title: "Ficha de salud",
      description:
        "Fecha de nacimiento, sexo, altura/peso con IMC autocalculado, grupo sanguíneo, alergias, antecedentes crónicos, medicación actual y contacto de emergencia — se usa automáticamente en las alertas clínicas que ve el médico durante la consulta.",
      status: "disponible",
      icon: Heart,
    },
    {
      id: "paciente-configuracion",
      side: "paciente",
      category: "Configuración",
      title: "Configuración de cuenta",
      description:
        "Perfil (datos personales, contraseña), obra social y ficha de salud, personalización de apariencia del portal, integraciones (placeholder \"próximamente\"), y suscripción con checkout de Mercado Pago para pasar a Plan Pago.",
      status: "parcial",
      icon: Settings,
    },
    {
      id: "paciente-documentos",
      side: "paciente",
      category: "Documentos y comprobantes",
      title: "Documentos emitidos y comprobantes",
      description:
        "Vista previa de PDFs/imágenes emitidos por el médico, reenvío de email de confirmación de turno, y tarjeta reutilizable de validación de comprobante de pago con el veredicto de la IA.",
      status: "disponible",
      icon: FileDown,
    },
    {
      id: "paciente-portal-legacy",
      side: "paciente",
      category: "Portal legacy",
      title: "Implementación anterior de una sola pantalla",
      description:
        "paciente-portal.tsx parece ser una versión previa que combinaba todo (turnos, pagos, médicos, historial) en una sola pantalla, con un texto placeholder sin terminar. A confirmar si sigue siendo alcanzable desde algún punto de entrada actual.",
      status: "proximamente",
      icon: TriangleAlert,
    },

    // ── COMPARTIDO ───────────────────────────────────────────────────────────
    {
      id: "compartido-video",
      side: "compartido",
      category: "Videoconsulta",
      title: "Videollamadas Jitsi/JaaS",
      description:
        "Misma experiencia de ingreso directo (sin sala de espera técnica) para médico y paciente, con chat en la llamada y fondo virtual de marca.",
      status: "disponible",
      icon: Video,
    },
    {
      id: "compartido-dictado",
      side: "compartido",
      category: "Dictado por voz",
      title: "Transcripción de voz reutilizada en toda la app",
      description:
        "Se usa en notas clínicas, dictado del informe con IA y motivo de consulta del paciente. Funciona en Chrome/Edge; en iOS se sugiere escribir o pegar texto.",
      status: "disponible",
      icon: Mic,
    },
    {
      id: "compartido-ia",
      side: "compartido",
      category: "Inteligencia artificial",
      title: "Funciones con IA (Gemini)",
      description:
        "Generación de informe clínico y resumen SOAP, y lectura/validación automática de comprobantes de pago — todas con comportamiento de respaldo cuando se agota la cuota de IA.",
      status: "disponible",
      icon: Sparkles,
    },
    {
      id: "compartido-pdf",
      side: "compartido",
      category: "Documentos PDF",
      title: "Generación de PDF con firma",
      description:
        "Recetas, órdenes de estudio e informes clínicos se generan como PDF en el cliente, con la firma del médico estampada automáticamente.",
      status: "disponible",
      icon: FileDown,
    },
    {
      id: "compartido-apariencia",
      side: "compartido",
      category: "Personalización",
      title: "Apariencia configurable por portal",
      description:
        "Colores y tipografía configurables de forma independiente para el panel del médico y el portal del paciente, ambos con botón de restablecer al tema por defecto de Nodo.",
      status: "disponible",
      icon: Palette,
    },
    {
      id: "compartido-mercadopago",
      side: "compartido",
      category: "Pagos",
      title: "Integraciones de Mercado Pago",
      description:
        "Checkout Pro, vinculación OAuth de la cuenta del médico, webhooks, reembolsos, y checkout de suscripción tanto para el plan del médico como para el plan del paciente — varios flujos de MP distintos conviviendo en la misma app.",
      status: "disponible",
      icon: CreditCard,
    },
    {
      id: "compartido-realtime",
      side: "compartido",
      category: "Tiempo real",
      title: "Actualizaciones en vivo",
      description:
        "Canales de Supabase Realtime para turnos y documentos en modo plataforma; polling de intervalo corto en modo local/demo.",
      status: "disponible",
      icon: Radio,
    },
    {
      id: "compartido-modo-datos",
      side: "compartido",
      category: "Modo de datos",
      title: "Dos modos de persistencia",
      description:
        "JSON local (desarrollo/demo) vs. Supabase (producción) — el comportamiento de algunas pantallas difiere sutilmente entre modos (por ejemplo, la pestaña \"Archivos\" o la edición inline del informe). Conviene probar ambos modos cuando sea posible.",
      status: "disponible",
      icon: Database,
    },
    {
      id: "compartido-terminos",
      side: "compartido",
      category: "Legal",
      title: "Aceptación de términos y condiciones",
      description:
        "Modal de aceptación durante el onboarding, tanto para médicos como para pacientes.",
      status: "disponible",
      icon: FileCheck,
    },
    {
      id: "compartido-notificaciones-email",
      side: "compartido",
      category: "Notificaciones por email",
      title: "Emails transaccionales",
      description:
        "Confirmación de turno (con reenvío manual), recordatorio de turno con envío de prueba, y receta enviada por email.",
      status: "disponible",
      icon: Mail,
    },
  ],
};
