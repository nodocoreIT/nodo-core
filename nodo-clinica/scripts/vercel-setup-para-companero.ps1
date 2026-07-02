# Checklist deploy Nodo Clínica en nodocore.com.ar
# Ejecutar desde la raíz del monorepo tras merge de feat/clinica-deploy-mp → main.
# Requiere: Vercel CLI (npx vercel) y acceso a proyectos nodo-clinica + nodo-core (landing).

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Nodo Clínica — setup Vercel (nodocore.com.ar) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. GitHub: mergear rama feat/clinica-deploy-mp a main" -ForegroundColor Yellow
Write-Host "   Repo: https://github.com/nodocoreIT/nodo-core"
Write-Host ""

Write-Host "2. Proyecto Vercel: nodo-clinica (nodo-clinica.vercel.app)" -ForegroundColor Yellow
Write-Host "   - Root Directory: nodo-clinica"
Write-Host "   - Include source files outside Root Directory: ON"
Write-Host "   - Install: cd .. && pnpm install --frozen-lockfile (ya en vercel.json)"
Write-Host "   - Variables mínimas Production:"
Write-Host "       CLINIC_MODE=local"
Write-Host "       NEXT_PUBLIC_CLINIC_MODE=local"
Write-Host "       NEXT_PUBLIC_APP_URL=https://www.nodocore.com.ar"
Write-Host "       CLINIC_SESSION_SECRET=<random>"
Write-Host "       BLOB_READ_WRITE_TOKEN=<desde Vercel Blob>"
Write-Host "       GEMINI_API_KEY, JAAS_*, MERCADOPAGO_* (copiar del .env.local del equipo)"
Write-Host "   - Redeploy Production"
Write-Host ""

Write-Host "3. Proyecto Vercel: nodo-core / nodo-landing (nodocore.com.ar)" -ForegroundColor Yellow
Write-Host "   - Root Directory: nodo-landing"
Write-Host "   - Agregar variable Production:"
Write-Host "       NODO_CLINICA_URL=https://nodo-clinica.vercel.app"
Write-Host "   - NO tocar variables NODO_INMO_*"
Write-Host "   - Redeploy Production"
Write-Host ""

Write-Host "4. Probar:" -ForegroundColor Yellow
Write-Host "   https://www.nodocore.com.ar/nodo-clinica/login"
Write-Host "   https://www.nodocore.com.ar/clinica/login/medico"
Write-Host "   Demo médico: doc.demo1@nodo.demo / Probando1"
Write-Host "   Demo paciente: paciente1@nodo.demo / Probando1"
Write-Host ""

Write-Host "Listo. Si el login en /nodo-clinica/login falla, el landing no tiene el deploy nuevo." -ForegroundColor Green
