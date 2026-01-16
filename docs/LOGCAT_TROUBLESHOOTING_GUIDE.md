# Logcat Troubleshooting Guide

**Last Updated:** January 15, 2026  
**Issue:** "Logcat stopped showing logs" or "No logs appearing"

## Quick Diagnosis Checklist

Before spending hours debugging, check these common issues:

- [ ] **PowerShell parsing issue** - Are you seeing parser errors? (See Solution 1)
- [ ] **Missing `-d` flag** - Are you using `adb logcat` without `-d` for piping? (See Solution 2)
- [ ] **Buffer was cleared** - Did someone run `adb logcat -c`? (See Solution 3)
- [ ] **Looking in wrong place** - JavaScript logs appear in Metro bundler, not adb logcat (See Solution 4)
- [ ] **Service not started** - Did you restart the device? Service needs to be re-enabled (See Solution 5)

## Common Issues & Solutions

### Issue 1: PowerShell Parser Errors

**Symptoms:**
```
01-15 23:39:18.409  7954  7954 D ForegroundDetection: ...
ParserError: Unexpected token '23:39:18.409' in expression or statement.
```

**Cause:** PowerShell is trying to parse logcat output as PowerShell commands.

**Solution:**
```powershell
# DON'T do this (causes parser errors):
adb logcat | Select-String -Pattern "ForegroundDetection"

# DO this instead (save to file first):
adb logcat -d > logs.txt
Select-String -Path logs.txt -Pattern "ForegroundDetection"

# OR use ADB's built-in filtering:
adb logcat -s ForegroundDetection:*

# OR redirect to Out-Host:
adb logcat -d | Select-String -Pattern "ForegroundDetection" | Out-Host
```

### Issue 2: "Logcat Stopped" - No Logs Appearing

**Symptoms:**
- Logs were appearing, then suddenly stopped
- No new logs even when using the app
- Service seems to be running but no logs

**Diagnosis Steps:**

1. **Check if logs are actually missing or just not visible:**
   ```powershell
   # Save current buffer to file
   adb logcat -d > current_logs.txt
   
   # Check file size
   Get-Item current_logs.txt | Select-Object Length
   
   # If file is empty or very small, logs truly aren't being generated
   # If file is large, logs exist but weren't being displayed properly
   ```

2. **Check if JavaScript vs Native logs:**
   - **JavaScript logs** (React Native) appear in **Metro bundler terminal** (where you ran `npm start`)
   - **Native logs** (Kotlin/Java) appear in **adb logcat**
   
   If you're looking for React Native console.log() in adb logcat, you won't find them!

3. **Check if service is running:**
   ```powershell
   # Check if ForegroundDetectionService is running
   adb shell dumpsys activity services | Select-String -Pattern "ForegroundDetection" -CaseSensitive:$false
   
   # Look for: startForegroundCount > 0 and active connections (not DEAD)
   ```

4. **Check if app process is alive:**
   ```powershell
   adb shell ps | Select-String -Pattern "breakloopnative"
   
   # If no process found, app was killed
   ```

### Issue 3: Buffer Was Cleared

**Symptoms:**
- Logs were working before
- Now no logs appear
- Service is running

**Cause:** Someone ran `adb logcat -c` which clears the buffer. If the service hasn't logged since then, buffer appears empty.

**Solution:**
```powershell
# Trigger new logs by using the app
# Then check:
adb logcat -d > new_logs.txt
Select-String -Path new_logs.txt -Pattern "ForegroundDetection" | Select-Object -Last 50
```

If still no logs, the service isn't executing. See Issue 5.

### Issue 4: Looking in Wrong Place for Logs

**JavaScript vs Native Logs:**

| Log Type | Where to Find It | Example |
|----------|------------------|---------|
| JavaScript (React Native) | Metro bundler terminal | `console.log()`, React errors |
| Native Kotlin | adb logcat | `Log.i()`, `Log.d()`, service logs |
| Native crashes | adb logcat | `FATAL`, `AndroidRuntime` |

**Common mistake:** Looking for React Native console.log() in adb logcat. It won't be there!

### Issue 5: Service Not Running After Device Restart

**Symptoms:**
- Device was restarted
- No logs appearing
- Service shows as enabled but not logging

**Cause:** After device restart, accessibility services need to reconnect. Sometimes they don't start automatically.

**Solution:**
```powershell
# 1. Check if service is enabled
adb shell settings get secure enabled_accessibility_services | Select-String -Pattern "breakloop"

# 2. If enabled but not running, toggle it:
# On device: Settings → Accessibility → BreakLoop
# Turn OFF, wait 5 seconds, turn ON

# 3. Force stop and restart app
adb shell am force-stop com.anonymous.breakloopnative
adb shell am start -n com.anonymous.breakloopnative/.MainActivity

# 4. Check logs
adb logcat -d | Select-String -Pattern "ForegroundDetection.*onServiceConnected"

# Expected: "🟢 ForegroundDetectionService.onServiceConnected() called"
```

### Issue 6: Service Enabled But Lifecycle Methods Not Called

**Symptoms:**
- Service shows as enabled in settings
- `dumpsys` shows service is bound
- But no `onCreate()` or `onServiceConnected()` logs
- `startForegroundCount:0`

**Cause:** Android bound the service but didn't call lifecycle methods. This is an Android framework issue.

**Solution:**
```powershell
# 1. Force stop app
adb shell am force-stop com.anonymous.breakloopnative

# 2. Disable service on device
# Settings → Accessibility → BreakLoop → OFF

# 3. Wait 10 seconds

# 4. Enable service again
# Settings → Accessibility → BreakLoop → ON

# 5. If that doesn't work, restart device
# Sometimes Android's accessibility framework needs a full reset
```

## Proper Logcat Usage Patterns

### Pattern 1: Save to File (Best for Analysis)

```powershell
# Save all logs
adb logcat -d > full_logs.txt

# Then search the file
Select-String -Path full_logs.txt -Pattern "ForegroundDetection" | Select-Object -Last 50
Select-String -Path full_logs.txt -Pattern "Foreground app changed"
Select-String -Path full_logs.txt -Pattern "MONITORED APP DETECTED"
```

### Pattern 2: Real-Time Monitoring (ADB Filtering)

```powershell
# Use ADB's built-in tag filtering (no PowerShell parsing issues)
adb logcat -s ForegroundDetection:* AppMonitorModule:* SystemBrainService:*

# This shows ONLY logs from these tags in real-time
# Press Ctrl+C to stop
```

### Pattern 3: Filtered Dump

```powershell
# Dump buffer with filtering
adb logcat -d | Select-String -Pattern "ForegroundDetection|AppMonitor" | Out-Host

# Or save filtered output
adb logcat -d | Select-String -Pattern "ForegroundDetection" > filtered.txt
```

### Pattern 4: Check Specific Events

```powershell
# Clear logs
adb logcat -c

# Do your test (open Instagram, switch apps, etc.)

# Save logs
adb logcat -d > test_logs.txt

# Search for specific events
Select-String -Path test_logs.txt -Pattern "📱 Foreground app changed:"
Select-String -Path test_logs.txt -Pattern "🎯 MONITORED APP DETECTED:"
Select-String -Path test_logs.txt -Pattern "Launching SystemSurface"
```

## What Logs Should You See?

### When Service Starts

```
🟢 ForegroundDetectionService.onCreate() called
🟢 ForegroundDetectionService.onServiceConnected() called
✅ ForegroundDetectionService connected and ready
✅ Accessibility service configured to receive interaction events
🔵 Attempting to start periodic timer checks...
✅ Timer check mechanism started
🟢 Timer expiration loop confirmed alive
```

### During Normal Operation

```
🔍 Checking Quick Task timer expirations (0 active timers)
⏰ Timer check running (run #76)
📱 Accessibility event: type=WINDOW_CONTENT_CHANGED, package=com.android.systemui
```

### When App Switch Detected

```
📱 Foreground app changed: com.instagram.android
🎯 MONITORED APP DETECTED: com.instagram.android
[Accessibility] Launching SystemSurfaceActivity with WAKE_REASON=MONITORED_APP_FOREGROUND for com.instagram.android
```

### If You Don't See These Logs

1. Service isn't running → See Issue 5
2. Service started but not detecting apps → Check monitored apps list
3. Logs are in Metro bundler → See Issue 4

## Debugging Workflow

### Step 1: Verify Service Status

```powershell
# Check if service is running
adb shell dumpsys activity services | Select-String -Pattern "ForegroundDetection" -CaseSensitive:$false

# Look for:
# - startForegroundCount > 0 (service is active)
# - Active connections (not DEAD)
```

### Step 2: Check Accessibility Service Enabled

```powershell
# Check if enabled
adb shell settings get secure enabled_accessibility_services | Select-String -Pattern "breakloop"

# Should see: com.anonymous.breakloopnative/com.anonymous.breakloopnative.ForegroundDetectionService
```

### Step 3: Check App Process

```powershell
# Check if app is running
adb shell ps | Select-String -Pattern "breakloopnative"

# Should see process with PID
```

### Step 4: Check Logs Exist

```powershell
# Save logs to file
adb logcat -d > diagnostic_logs.txt

# Check file size
Get-Item diagnostic_logs.txt | Select-Object Length

# Search for service logs
Select-String -Path diagnostic_logs.txt -Pattern "ForegroundDetection" | Select-Object -Last 50
```

### Step 5: Trigger New Logs

```powershell
# Clear logs
adb logcat -c

# Toggle accessibility service (on device)
# Settings → Accessibility → BreakLoop → OFF then ON

# Check for service start logs
adb logcat -d | Select-String -Pattern "ForegroundDetection.*onCreate|onServiceConnected"
```

## Common Mistakes to Avoid

1. ❌ **Using `adb logcat` without `-d` in PowerShell pipes**
   - Causes parser errors
   - Use `-d` or save to file first

2. ❌ **Looking for JavaScript logs in adb logcat**
   - JavaScript logs appear in Metro bundler terminal
   - Only native Kotlin logs appear in adb logcat

3. ❌ **Assuming service is running because it's enabled**
   - Check `startForegroundCount` and logs
   - Service can be enabled but not executing

4. ❌ **Not checking if buffer was cleared**
   - If someone ran `adb logcat -c`, all logs are gone
   - Trigger new logs by using the app

5. ❌ **Not restarting service after device restart**
   - Accessibility services may not auto-start
   - Toggle service off/on after restart

## Quick Reference Commands

```powershell
# Save all logs to file
adb logcat -d > logs.txt

# Check service status
adb shell dumpsys activity services | Select-String -Pattern "ForegroundDetection"

# Check if service enabled
adb shell settings get secure enabled_accessibility_services | Select-String -Pattern "breakloop"

# Check app process
adb shell ps | Select-String -Pattern "breakloopnative"

# Monitor logs in real-time (no parsing issues)
adb logcat -s ForegroundDetection:* AppMonitorModule:*

# Search saved logs
Select-String -Path logs.txt -Pattern "Foreground app changed"
Select-String -Path logs.txt -Pattern "MONITORED APP DETECTED"
Select-String -Path logs.txt -Pattern "Launching SystemSurface"

# Force stop and restart app
adb shell am force-stop com.anonymous.breakloopnative
adb shell am start -n com.anonymous.breakloopnative/.MainActivity

# Clear logs and start fresh
adb logcat -c
```

## When to Restart Device

Restart the device if:
- Service is enabled but no logs after toggling
- `startForegroundCount:0` persists after multiple toggles
- Android accessibility framework seems stuck
- Multiple accessibility services are conflicting

After restart:
1. Re-enable accessibility service
2. Open the app
3. Check logs: `adb logcat -d > after_restart.txt`

## Summary

**Most common issue:** PowerShell trying to parse logcat output as commands.

**Solution:** Always save to file first (`adb logcat -d > logs.txt`), then search the file.

**Remember:** 
- JavaScript logs → Metro bundler terminal
- Native logs → adb logcat
- Service needs to be enabled AND running (check `startForegroundCount`)
- After device restart, toggle service off/on

## Related Documentation

- `CLAUDE.md` - Native module development workflow
- `docs/KOTLIN_FILE_SYNC.md` - Kotlin file editing workflow
- `BUILD_AND_TEST_GUIDE.md` - Testing and verification steps
- `ACCESSIBILITY_SERVICE_CHECK.md` - Accessibility service configuration
