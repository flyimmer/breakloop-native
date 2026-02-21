@echo off
echo 🔍 Checking if Metro Bundler (npm start) is running...

:: Check if any process is listening on port 8081
netstat -ano | find "8081" >nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ WARNING: Metro Bundler is NOT running on port 8081!
    echo Please open a second terminal tab, run 'npm start', and try again.
    exit /b 1
)
echo ✅ Metro Bundler is active. Proceeding with Native build...

echo 🔨 Building Kotlin Native...
:: Step INTO the android folder
cd android
:: Run the build command
call gradlew.bat installDebug
:: Step BACK OUT to the main folder
cd ..

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build Failed. Check terminal output.
    exit /b %ERRORLEVEL%
)

echo ✅ Build Successful. Launching App...
:: Note: Ensure you replace 'com.example.yourapp' with your actual package name!
adb shell am start -n com.anonymous.breakloopnative/.MainActivity

echo 🚀 App Running. Grabbing error logs...
adb logcat -c 
adb logcat -d *:E > crash_report.txt

echo 📝 Logs captured in crash_report.txt