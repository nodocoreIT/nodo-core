# Sincroniza el repo con GitHub cada hora (rama main).
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Sync-Repo {
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
    if ($branch -ne "main") {
        Write-Host "sync: rama actual $branch (esperaba main)" -ForegroundColor Yellow
    }

    git fetch origin 2>&1 | Out-Host
    $before = git rev-parse HEAD 2>$null
    git pull origin main 2>&1 | Out-Host
    $after = git rev-parse HEAD 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "sync: git pull fallo - revisa credenciales o conflictos" -ForegroundColor Red
        return
    }

    if ($before -ne $after) {
        $b = $before.Substring(0, 7)
        $a = $after.Substring(0, 7)
        Write-Host "sync: codigo actualizado $b -> $a" -ForegroundColor Green
        Write-Host "sync: Next.js recarga solo si el dev server esta corriendo" -ForegroundColor Cyan
    } else {
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "sync: sin cambios ($time)" -ForegroundColor DarkGray
    }
}

Write-Host "sync: inicio - $Root" -ForegroundColor Cyan
Write-Host "sync: primera sincronizacion..." -ForegroundColor Cyan
Sync-Repo

while ($true) {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "sync: proximo pull en 1 hora ($time)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 3600
    Sync-Repo
}
