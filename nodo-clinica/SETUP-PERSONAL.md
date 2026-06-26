# Nodo Clínica — deploy personal (GitHub + Vercel + Supabase)

Guía para levantar **tu copia** en cuentas de Juan Mendia (no nodocoreIT), trabajar online y probar:

- Wizard de turnos con comprobante de pago (Gemini)
- Vademécum / recetas
- Historial clínico, SOAP al finalizar consulta
- Panel médico y portal paciente

---

## Resumen rápido

| Servicio | Para qué |
|----------|----------|
| **GitHub personal** | Repo solo con `nodo-clinica` |
| **Vercel personal** | Hosting Next.js |
| **Vercel Blob** | Persistir `clinic.json` entre deploys |
| **Gemini API** | Validar comprobantes + informes SOAP |
| **Supabase** | Opcional hoy — el modo activo es **local + JSON** |

> No necesitás Fly.io. No hace falta Supabase para probar turnos, recetas y comprobantes.

---

## Paso 1 — Repo en tu GitHub

### 1a. Crear repo vacío

1. Entrá a [github.com/new](https://github.com/new) con **tu cuenta personal**
2. Nombre sugerido: `nodo-clinica`
3. **Sin** README, .gitignore ni licencia (repo vacío)
4. Copiá la URL, ej. `https://github.com/TU-USUARIO/nodo-clinica.git`

### 1b. Subir solo la carpeta de clínica desde el monorepo

En PowerShell, desde la raíz de `nodo-core`:

```powershell
cd "C:\Users\juanm\Documents\@Desarrollo\nodo-core"

# Rama con solo el contenido de future_nodes/nodo-clinica
git subtree split --prefix=future_nodes/nodo-clinica -b nodo-clinica-personal

# Remote de tu repo personal (cambiar URL)
git remote add clinica-personal https://github.com/TU-USUARIO/nodo-clinica.git

git push -u clinica-personal nodo-clinica-personal:main
```

> **Usuario GitHub:** en tu caso es `Juanmendia` (con J mayúscula):  
> `https://github.com/Juanmendia/nodo-clinica.git`

Si el push dice **Repository not found**:

1. Confirmá que el repo existe en el navegador (logueado como Juan Mendia).
2. Si es **privado**, Git en tu PC debe usar **tu** cuenta (no nodocore):
   ```powershell
   git credential-manager github login
   ```
3. O creá el repo vacío en GitHub si aún no existe y repetí el push.

O usá el script:

```powershell
powershell -ExecutionPolicy Bypass -File future_nodes/nodo-clinica/scripts/export-personal-github.ps1 -RepoUrl "https://github.com/TU-USUARIO/nodo-clinica.git"
```

---

## Paso 2 — Proyecto en Vercel

1. [vercel.com/new](https://vercel.com/new) → importar **tu** repo `Juanmendia/nodo-clinica`
2. **Framework:** elegí **Next.js** (no "Other"). Si no aparece, expandí *Configuración de compilación* y poné:
   - Build: `npm run build`
   - Output: (dejar vacío — Next.js)
3. Root Directory: `./`
4. En **Variables de entorno** pegá las de `env.example` (mínimo `CLINIC_MODE`, `GEMINI_API_KEY`, etc.)
5. Clic en **Desplegar** — el proyecto tiene que existir antes de crear Blob.

> **¿No ves "Storage"?** Esa pestaña **no está** en la pantalla "Nuevo proyecto". Aparece **después** del primer deploy, en el panel del proyecto (barra lateral izquierda → **Storage** / **Almacenamiento**).

---

## Paso 3 — Vercel Blob (persistencia)

**Después** de que el primer deploy termine (aunque falle):

1. Abrí el proyecto `nodo-clinica` en Vercel (no la pantalla de importar).
2. Barra lateral → **Storage** (o **Almacenamiento**).
3. **Create Database** → **Blob** → **Continue**.
4. Access: **Private** → nombre ej. `clinica-data` → **Create**.
5. Marcá **Production** (y Preview si querés) para inyectar el token.
6. **Redeploy** (Deployments → ⋯ → Redeploy).

Vercel agrega `BLOB_READ_WRITE_TOKEN` (y a veces `BLOB_STORE_ID`). Sin redeploy, la app no lo ve.

**Ruta alternativa:** [vercel.com/dashboard/stores](https://vercel.com/dashboard/stores) → Create store → Blob → Connect to Project → elegir `nodo-clinica`.

---

## Paso 4 — Variables de entorno en Vercel

**Settings → Environment Variables → Production** (copiá de `env.example`):

| Variable | Valor | Obligatoria |
|----------|-------|-------------|
| `CLINIC_MODE` | `local` | Sí |
| `NEXT_PUBLIC_CLINIC_MODE` | `local` | Sí |
| `BLOB_READ_WRITE_TOKEN` | (auto al conectar Blob) | Sí |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Sí para comprobantes |
| `NEXT_PUBLIC_CLINIC_STRICT_PAYMENT` | `true` | Sí para validar comprobante real |
| `CLINIC_STRICT_PAYMENT_VALIDATION` | `true` | Sí |
| `NEXT_PUBLIC_APP_URL` | `https://tu-app.vercel.app` | Sí (tu URL final) |
| `NEXT_PUBLIC_JITSI_DOMAIN` | `meet.jit.si` | Opcional |

**No configures** `NEXT_PUBLIC_SUPABASE_URL` si querés seguir en modo local/JSON.

Después: **Deployments → Redeploy** (las variables solo aplican en build nuevo).

---

## Paso 5 — Supabase (preparar para más adelante)

Hoy la app guarda todo en `clinic.json` (Blob). Supabase es el camino a producción multi-tenant.

1. [supabase.com](https://supabase.com) → **New project** (tu cuenta)
2. SQL Editor → ejecutar en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_nodo_clinica_ecosystem_schema.sql`
3. **No** pongas las keys en Vercel hasta migrar el código a modo Supabase.

Cuentas demo (modo local): ver `docs/DATABASE.md` — contraseña `Probando1`.

---

## Paso 6 — Probar en producción

| Rol | URL |
|-----|-----|
| Paciente | `https://TU-APP.vercel.app/login/paciente` |
| Médico | `https://TU-APP.vercel.app/login/medico` |

**Demo:** `doc.demo1@nodo.demo` / `paciente1@nodo.demo` — contraseña `Probando1`

### Probar vademécum

Médico → consultorio → atender paciente → **Receta** → buscá por droga o marca (ej. `ibuprofeno`, `omeprazol`). Los resultados vienen del **vademécum nacional** (precios y laboratorios).

### Probar firma digital

Médico → **Consultorio → Perfil** → cargá texto de firma e imagen (PNG/JPG). Al generar receta o informe, la firma aparece en el PDF.

### Probar comprobante con IA

1. Consultorio → **Cobros**: activá "Exigir pago antes de reservar", honorario (ej. $5000), alias/CBU tuyos de prueba
2. Paciente → reservar turno → subir captura de transferencia
3. Requiere `GEMINI_API_KEY` + `NEXT_PUBLIC_CLINIC_STRICT_PAYMENT=true` en Vercel

---

## Desarrollo local (sigue igual)

```powershell
cd future_nodes/nodo-clinica
copy env.example .env.local
# Editar GEMINI_API_KEY, etc.
npm install
npm run dev
```

Abrir [http://localhost:3002](http://localhost:3002)

---

## Sincronizar cambios monorepo → repo personal

Cuando mejorás clínica en `nodo-core` y querés actualizar tu Vercel:

```powershell
cd nodo-core
git subtree split --prefix=future_nodes/nodo-clinica -b nodo-clinica-personal
git push clinica-personal nodo-clinica-personal:main --force
```

(Vercel redeploya solo al push.)

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Datos se borran al redeploy | Falta `BLOB_READ_WRITE_TOKEN` |
| Comprobante siempre aprueba | Falta `GEMINI_API_KEY` o strict en `false` |
| "Comprobante no encontrado" | Redeploy con versión que guarda `inlineDataBase64` en Vercel |
| Login no carga | Revisá que `CLINIC_MODE=local` esté en Vercel |
