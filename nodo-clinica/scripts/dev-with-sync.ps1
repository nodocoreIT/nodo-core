# Levanta Next.js en local y sincroniza GitHub cada hora en segundo plano.
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "  Clínica Virtual — dev local + sync cada 1 h" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor Green
Write-Host "  GitHub -> git pull cada hora (rama main)" -ForegroundColor DarkGray
Write-Host ""

$syncScript = Join-Path $Root "scripts\git-sync-hourly.ps1"
$syncProcess = Start-Process powershell `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$syncScript`"" `
    -PassThru `
    -WindowStyle Minimized

try {
    npm run dev
} finally {
    if ($syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
