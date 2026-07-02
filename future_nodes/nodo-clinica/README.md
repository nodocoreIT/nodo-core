# Clínica Virtual

Plataforma HealthTech de telemedicina construida con **Next.js 16**, **Tailwind CSS**, **ShadcnUI** y **Supabase**.

## Características

- **Ciclo de vida del paciente**: En espera → En consulta → Finalizada
- **Panel del médico**: Dashboard con cola, video Jitsi, historial clínico, transcripción en tiempo real y notas con autoguardado
- **Recetario digital**: Generación de PDF con firma y envío por email (Resend)
- **Solicitud de estudios**: Buscador de exámenes frecuentes con orden imprimible
- **Resumen SOAP con IA**: Generación automática vía Gemini API
- **Sala de espera virtual**: Posición en fila, carga de estudios previos, magic link seguro
- **Notificaciones en tiempo real**: Alertas cuando el paciente sube documentos
- **Seguridad RLS**: Row Level Security en todas las tablas de Supabase

## Inicio rápido

```bash
npm install
cp env.example .env.local   # Windows: copy env.example .env.local
# Configurar variables de entorno

npm run dev
```

Abrir [http://localhost:3002](http://localhost:3002)

## Deploy personal (GitHub + Vercel)

Ver **[SETUP-PERSONAL.md](./SETUP-PERSONAL.md)** — repo propio, Vercel Blob, Gemini para comprobantes.

**Mercado Pago OAuth (cobro por médico):** ver **[MERCADOPAGO-OAUTH.md](./MERCADOPAGO-OAUTH.md)**.

## Configuración de Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar la migración en `supabase/migrations/001_initial_schema.sql`
3. Habilitar Realtime en las tablas `appointments` y `patient_documents`
4. Configurar Auth con Magic Link habilitado

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/auth/login` | Login médico (Magic Link) |
| `/medico/dashboard` | Panel del médico |
| `/paciente/sala/[token]` | Sala de espera del paciente |

## API Routes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/appointments` | POST | Crear turno y enviar email |
| `/api/soap/generate` | POST | Generar resumen SOAP con Gemini |
| `/api/prescriptions` | POST | Guardar receta |
| `/api/prescriptions/send` | POST | Enviar receta por email |
| `/api/study-orders` | POST | Guardar orden de estudios |

## Stack

- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, ShadcnUI
- **Estado**: Zustand
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Video**: Jitsi Meet (embed)
- **IA**: Google Gemini
- **Email**: Resend
- **PDF**: jsPDF

## Modo demo

En desarrollo, `/medico/dashboard` funciona sin autenticación con datos demo.

## Licencia

Privado — uso interno.
