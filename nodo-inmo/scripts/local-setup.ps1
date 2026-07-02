# Setup local Nodo Inmo (Windows + Supabase local)
#
# Requisitos: Docker Desktop + Supabase CLI
#   winget install Docker.DockerDesktop
#   winget install Supabase.CLI
# Reiniciá la terminal después de instalar.

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $Root -Parent

$SupabaseUrl = "http://127.0.0.1:54321"
$ServiceRole = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsnas3sdNHCVM"
$DatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$AdminEmail = "admin@nodoinmo.test"
$AdminPassword = "local-dev-only"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "Falta '$name'. Instalalo y reiniciá la terminal." -ForegroundColor Red
    exit 1
  }
}

Write-Host "==> Verificando Docker y Supabase CLI..." -ForegroundColor Cyan
Require-Command docker
Require-Command supabase

Write-Host "==> Iniciando Supabase local (nodo-inmo)..." -ForegroundColor Cyan
Set-Location $Root
supabase start

Write-Host "==> Aplicando migraciones..." -ForegroundColor Cyan
supabase db reset --yes

$env:SUPABASE_URL = $SupabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $ServiceRole
$env:DATABASE_URL = $DatabaseUrl
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword
$env:ORG_NAME = "Agencia Local Pro"

Write-Host "==> Creando admin de prueba..." -ForegroundColor Cyan
pnpm exec tsx scripts/bootstrap-admin.ts

Write-Host "==> Activando Plan Pro + Nodo ID..." -ForegroundColor Cyan
pnpm exec tsx scripts/set-pro-plan-local.ts

Write-Host ""
Write-Host "Listo. Para probar:" -ForegroundColor Green
Write-Host "  Terminal 1: cd `"$RepoRoot`" ; pnpm dev:inmo"
Write-Host "  Terminal 2: cd `"$RepoRoot\nodo-landing`" ; pnpm dev"
Write-Host ""
Write-Host "  Login: $AdminEmail / $AdminPassword"
Write-Host "  URL:   http://localhost:3000/nodo-inmo/login"
Write-Host ""
