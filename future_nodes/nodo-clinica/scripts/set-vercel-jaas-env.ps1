# Configura variables JaaS en Vercel (proyecto nodo-salud).
# Requiere: npx vercel login previo, ejecutar desde future_nodes/nodo-clinica
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$appId = "vpaas-magic-cookie-c935764c77244fe384665537f295395c"
$kid = "vpaas-magic-cookie-c935764c77244fe384665537f295395c/3e40f5"
$keyFile = Join-Path $PSScriptRoot "..\jaasauth.key"

if (-not (Test-Path $keyFile)) {
  Write-Error "Falta jaasauth.key en la raíz de nodo-clinica"
}

$priv = (Get-Content $keyFile -Raw).Trim()
$privB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($priv))

function Set-VercelEnv($name, $value) {
  Write-Host "Setting $name ..."
  $value | npx --yes vercel env rm $name production --yes 2>$null
  $value | npx --yes vercel env add $name production
}

Set-VercelEnv "NEXT_PUBLIC_JAAS_APP_ID" $appId
Set-VercelEnv "JAAS_APP_ID" $appId
Set-VercelEnv "JAAS_API_KEY_ID" $kid
Set-VercelEnv "NEXT_PUBLIC_JITSI_DOMAIN" "8x8.vc"
Set-VercelEnv "NEXT_PUBLIC_APP_URL" "https://nodo-salud.vercel.app"
# Base64 evita problemas con saltos de línea en el dashboard de Vercel
Set-VercelEnv "JAAS_PRIVATE_KEY_BASE64" $privB64
# Limpiar variable legacy si existía mal formateada
npx --yes vercel env rm JAAS_PRIVATE_KEY production --yes 2>$null

Write-Host "Listo. Redeploy: npx vercel --prod" -ForegroundColor Green
