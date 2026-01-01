# Local CI Script - Mirrors GitHub Actions workflow (PowerShell version)
# Run this before pushing to catch issues early
#
# Usage: .\scripts\ci-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  Hush Web Client - Local CI Check"
Write-Host "========================================"
Write-Host ""

$startTime = Get-Date

# Step 1: Install dependencies
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm ci failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Lint
Write-Host "[2/4] Running ESLint..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lint failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Lint passed" -ForegroundColor Green
Write-Host ""

# Step 3: Tests
Write-Host "[3/4] Running tests..." -ForegroundColor Yellow
npm run test:run
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Tests failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Tests passed" -ForegroundColor Green
Write-Host ""

# Step 4: Build
Write-Host "[4/4] Building for production..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build succeeded" -ForegroundColor Green
Write-Host ""

# Calculate elapsed time
$elapsed = (Get-Date) - $startTime

Write-Host "========================================"
Write-Host "  All checks passed!" -ForegroundColor Green
Write-Host "  Total time: $([math]::Round($elapsed.TotalSeconds))s"
Write-Host "========================================"
Write-Host ""
Write-Host "Ready to push to GitHub."
