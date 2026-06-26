# Deploy Clínica Virtual a Fly.io (Windows)
# Ejecutar: powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1

$ErrorActionPreference = "Stop"
$flyBin = "$env:USERPROFILE\.fly\bin\flyctl.exe"

if (-not (Test-Path $flyBin)) {
    Write-Host "Instalando Fly CLI..." -ForegroundColor Cyan
    iwr https://fly.io/install.ps1 -useb | iex
}

if (-not (Test-Path $flyBin)) {
    Write-Host "Error: no se pudo instalar flyctl. Reiniciá PowerShell e intentá de nuevo." -ForegroundColor Red
    exit 1
}

Write-Host "Login en Fly (se abre el navegador)..." -ForegroundColor Cyan
& $flyBin auth login

Write-Host "Verificando volumen clinica_data..." -ForegroundColor Cyan
$volumes = & $flyBin volumes list -a nodo-clinica 2>&1
if ($volumes -notmatch "clinica_data") {
    Write-Host "Creando volumen clinica_data en gru..." -ForegroundColor Yellow
    & $flyBin volumes create clinica_data --region gru --size 1 -a nodo-clinica
}

Write-Host "Desplegando nodo-clinica..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\..
& $flyBin deploy -a nodo-clinica

Write-Host ""
Write-Host "Listo! Abrí:" -ForegroundColor Green
Write-Host "  https://nodo-clinica.fly.dev/login/paciente"
Write-Host "  https://nodo-clinica.fly.dev/login/medico"
