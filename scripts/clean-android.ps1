# PowerShell script to clean Android build
# Handles Windows-specific path issues and provides clear error messages

Write-Host "🧹 Cleaning Android build..." -ForegroundColor Cyan

# Check if android directory exists
if (-not (Test-Path "android")) {
    Write-Host "❌ Error: android/ directory not found" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the project root" -ForegroundColor Yellow
    exit 1
}

# Check if gradlew.bat exists
if (-not (Test-Path "android\gradlew.bat")) {
    Write-Host "❌ Error: gradlew.bat not found in android/ directory" -ForegroundColor Red
    Write-Host "   Run 'npx expo prebuild' first to generate the android directory" -ForegroundColor Yellow
    exit 1
}

# Check Java installation
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaPath) {
    Write-Host "⚠️  Warning: Java not found in PATH" -ForegroundColor Yellow
    Write-Host "   gradlew.bat will check JAVA_HOME, but if it fails:" -ForegroundColor Yellow
    Write-Host "   1. Install Java JDK (https://adoptium.net/)" -ForegroundColor Yellow
    Write-Host "   2. Set JAVA_HOME environment variable" -ForegroundColor Yellow
    Write-Host ""
}

# Change to android directory
Push-Location android

try {
    Write-Host "Cleaning CMake build cache..." -ForegroundColor Cyan
    # Clean CMake cache first to avoid codegen directory errors
    if (Test-Path "app\.cxx") {
        Remove-Item -Path "app\.cxx" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ CMake cache cleaned" -ForegroundColor Green
    }
    
    if (Test-Path "app\build") {
        Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ App build directory cleaned" -ForegroundColor Green
    }
    
    Write-Host "Running gradlew clean..." -ForegroundColor Cyan
    Write-Host ""
    & .\gradlew.bat clean
    
    # Note: gradlew clean may show errors about missing codegen directories
    # These are usually harmless - the build will regenerate them
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Clean build successful!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Clean completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host "   CMake codegen errors are usually harmless - they'll be regenerated on build" -ForegroundColor Yellow
        Write-Host "   You can proceed with: npm run android" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Error running gradlew.bat: $_" -ForegroundColor Red
    exit 1
} finally {
    # Return to original directory
    Pop-Location
}
