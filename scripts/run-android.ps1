# PowerShell wrapper script for expo run:android
# Ensures Kotlin validation runs before build

Write-Host "🔍 Running Kotlin validation before build..." -ForegroundColor Cyan

npm run validate:kotlin

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build aborted: Kotlin plugin validation failed" -ForegroundColor Red
    Write-Host "   Fix the issues above, then try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Validation passed, starting build..." -ForegroundColor Green
npx expo run:android

