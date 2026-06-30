# Exporta nodo-clinica a un repo GitHub personal (standalone).
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl
)

$ErrorActionPreference = "Stop"
$monorepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

Set-Location $monorepoRoot

Write-Host "Monorepo: $monorepoRoot" -ForegroundColor Cyan
Write-Host "Destino:  $RepoUrl" -ForegroundColor Cyan

$branch = "nodo-clinica-personal"
$remote = "clinica-personal"

git fetch origin 2>$null

Write-Host "Creando rama subtree '$branch'..." -ForegroundColor Yellow
git subtree split --prefix=nodo-clinica -b $branch

$remotes = git remote
if ($remotes -notcontains $remote) {
  git remote add $remote $RepoUrl
  Write-Host "Remote '$remote' agregado." -ForegroundColor Green
} else {
  git remote set-url $remote $RepoUrl
  Write-Host "Remote '$remote' actualizado." -ForegroundColor Green
}

Write-Host "Push a $RepoUrl (main)..." -ForegroundColor Yellow
git push -u $remote "${branch}:main" --force

Write-Host ""
Write-Host "Listo. Siguiente paso:" -ForegroundColor Green
Write-Host "  1. vercel.com/new -> importar tu repo"
Write-Host "  2. Storage -> Blob -> Connect to Project"
Write-Host "  3. Variables de entorno (ver SETUP-PERSONAL.md)"
Write-Host "  4. Redeploy"
