# Desplegar nodo-clinica en Fly.io — pasos finales

El código **ya está corregido** en GitHub (`fix: Docker build sin carpeta data`).

## Opción 1 — Un solo comando (en tu PC)

Abrí PowerShell en la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1
```

Eso instala Fly CLI, crea el volumen si falta y despliega.

---

## Opción 2 — Solo desde la web (sin instalar nada)

### A) Crear volumen (obligatorio, solo una vez)

1. Entrá a https://fly.io/dashboard
2. Abrí la app **nodo-clinica**
3. Menú **Volumes** → **Create volume**
   - Name: `clinica_data`
   - Region: **gru**
   - Size: **1 GB**
4. Guardar

### B) Redesplegar

1. En **nodo-clinica** → **Deployments**
2. Clic en **Deploy app** (o **Redeploy**)
3. Esperá que el build termine en verde

---

## Opción 3 — Deploy automático con GitHub Actions

1. En Fly, crear token de deploy:
   ```powershell
   flyctl tokens create deploy -a nodo-clinica
   ```
2. En GitHub → repo **nodo-salud** → **Settings** → **Secrets** → **Actions**
3. Nuevo secret: `FLY_API_TOKEN` = el token copiado
4. Cada `git push` a `main` despliega solo

---

## Probar

| Rol | URL |
|-----|-----|
| Paciente | https://nodo-clinica.fly.dev/login/paciente |
| Médico | https://nodo-clinica.fly.dev/login/medico |

**Demo:** `doc.demo1@nodo.demo` / `paciente1@nodo.demo` — contraseña `Probando1`

---

## Error `"/app/data": not found` al deployar

**No es un bug actual** — Fly está reintentando un **build viejo**.

Señales en el log:
- Aparece `COPY --from=builder /app/data ./data`
- Solo ~25 rutas (falta `/api/clinic/documents`)

**Qué hacer:**

1. **No uses "Retry"** en un deployment fallido antiguo.
2. Subí el código:
   ```powershell
   git push origin main
   ```
3. En Fly → **nodo-clinica** → **Deploy app** → deploy **nuevo** (no retry).
4. O GitHub → **Actions** → **Deploy to Fly.io** → **Run workflow**.

El Dockerfile correcto usa volumen `/data` y **no** copia carpeta `data/`.
