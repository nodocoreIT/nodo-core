# Clínica Virtual — despliegue online

## Alternativas gratuitas (Render ocupado)

| Plataforma | Gratis | Mejor para este proyecto | Persistencia datos |
|------------|--------|--------------------------|-------------------|
| **[Fly.io](https://fly.io)** | Sí (~3 apps pequeñas) | **Recomendada** — igual que local con JSON | Disco persistente `/data` |
| **[Vercel](https://vercel.com)** | Sí | Next.js nativo, deploy en 2 min | No guarda `clinic.json` (necesita Supabase) |
| **[Koyeb](https://koyeb.com)** | Sí (limitado) | Docker como Fly | Disco efímero |
| **[Railway](https://railway.app)** | Crédito trial | Fácil si tenés crédito | Volumen de pago |

**Recomendación:** usar **Fly.io** con el `Dockerfile` incluido. No requiere Supabase y los datos quedan guardados en un volumen.

---

## Opción A — Fly.io (recomendada)

### 1. Instalar CLI

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Crear cuenta en [fly.io](https://fly.io) y login:

```bash
fly auth login
```

### 2. Crear app y volumen

Desde la carpeta del proyecto:

```bash
fly launch --no-deploy
```

- Elegí un nombre único (ej. `clinica-mauro`)
- Región: `gru` (São Paulo, cerca de Argentina)
- No crear Postgres

Crear volumen para la base de datos local:

```bash
fly volumes create clinica_data --region gru --size 1
```

### 3. Variables de entorno (opcional)

```bash
fly secrets set GEMINI_API_KEY=tu-clave-gemini
```

### 4. Deploy

```bash
fly deploy
```

La URL queda en `https://nodo-clinica.fly.dev` (o el nombre de tu app).

> **Nota:** `data/clinic.json` no va en la imagen Docker (está en `.gitignore`).
> Al primer arranque la app crea la base en el volumen `/data` con las cuentas demo.
> Si el build falla con `"/app/data": not found`, actualizá el Dockerfile (ya corregido).

### Crear volumen (solo la primera vez)

```bash
fly volumes list -a nodo-clinica
fly volumes create clinica_data --region gru --size 1 -a nodo-clinica
```

### 5. Probar

- Paciente: `https://tu-app.fly.dev/login/paciente`
- Médico: `https://tu-app.fly.dev/login/medico`
- Cuentas demo: ver `docs/DATABASE.md` — `doc.demo1@nodo.demo` / `paciente1@nodo.demo` — contraseña `Probando1`

---

## Opción B — Vercel (rápida, sin disco)

Ideal si más adelante conectás **Supabase** (plan gratis).

1. Subí el repo a GitHub
2. [vercel.com/new](https://vercel.com/new) → importar repo
3. Variables de entorno:

```
CLINIC_MODE=local
NEXT_PUBLIC_CLINIC_MODE=local
GEMINI_API_KEY=...
```

> **Importante:** en Vercel el archivo `data/clinic.json` **no persiste** entre reinicios. Para producción real usá Supabase o Fly.io.

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `CLINIC_MODE=local` | Modo JSON local (sin Supabase) |
| `CLINIC_DATA_DIR=/data` | Carpeta de datos (Fly volume) |
| `NEXT_PUBLIC_CLINIC_MODE=local` | Modo local en el cliente |
| `GEMINI_API_KEY` | Informes SOAP / IA (opcional) |
| `NEXT_PUBLIC_JITSI_DOMAIN` | Default: `meet.jit.si` |

Copiá `.env.example` a `.env.local` para desarrollo.

---

## Fin de videollamada

Al colgar, paciente y médico ven pantalla de cierre y redirección automática al portal (3–5 segundos).
