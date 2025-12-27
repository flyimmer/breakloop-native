# Testing App Monitor Service

## Setup Complete ✅

The following has been implemented:

1. **AppMonitorService.kt** - Foreground service that polls usage stats every second
2. **AppMonitorModule.kt** - TurboModule that starts/stops the service
3. **AndroidManifest.xml** - Service declaration with foregroundServiceType
4. **Permissions** - FOREGROUND_SERVICE, POST_NOTIFICATIONS, PACKAGE_USAGE_STATS

## How to Test

### 1. Reconnect your phone
```bash
adb devices
```
Should show your device listed.

### 2. Deploy the app
```bash
npx expo run:android
```

### 3. Watch the logs

**In Metro bundler**, you should see:
```
LOG  [AppMonitor] TEMP DEBUG: Starting monitoring...
LOG  [AppMonitor] TEMP DEBUG: Monitoring started: {"message": "App monitoring started", "success": true}
```

**In Android logcat** (open a new terminal):
```bash
adb logcat -s AppMonitorService:D AppMonitorModule:D ReactNativeJS:D
```

You should see:
```
AppMonitorModule: startMonitoring called
AppMonitorModule: Usage Stats permission granted, starting service
AppMonitorModule: Monitoring service start command sent
AppMonitorService: onCreate called
AppMonitorService: Service created, isRunning = true
AppMonitorService: onStartCommand called
AppMonitorService: Foreground service started with notification
AppMonitorService: Monitoring runnable posted
AppMonitorService: checkForegroundApp called
AppMonitorService: Usage stats size: X
AppMonitorService: Current app: com.anonymous.breakloopnative, Last app: null
```

### 4. Switch apps to trigger event

1. Press Home button or open another app (Instagram, Chrome, etc.)
2. **Expected behavior:**
   - In logcat: `AppMonitorService: Foreground app changed: com.anonymous.breakloopnative -> com.instagram.android`
   - In logcat: `AppMonitorService: Event emitted: com.instagram.android`
   - In Metro: `LOG  [AppMonitor] Foreground app changed: {packageName: "com.instagram.android", timestamp: 1234567890}`

## Troubleshooting

### If Usage Stats permission is not granted:
```bash
# Check if permission is granted
adb shell appops get com.anonymous.breakloopnative GET_USAGE_STATS

# If it shows "default", you need to grant it:
# 1. Open Settings > Apps > Special access > Usage access
# 2. Enable BreakLoop Native
```

### If service doesn't start:
- Check logcat for errors: `adb logcat | Select-String "AppMonitor|ERROR"`
- Verify notification appears in status bar
- Check service is running: `adb shell dumpsys activity services | Select-String "AppMonitorService"`

### If no events are emitted:
- Verify React context is set: Check logs for "ReactContext is null"
- Verify Usage Stats returns data: Check logs for "Usage stats size: 0"
- Switch to a different app and back to trigger change detection

## Expected Output (Success Case)

```
# Start monitoring
[AppMonitor] TEMP DEBUG: Monitoring started: {"success": true}

# Switch to Instagram
[AppMonitor] Foreground app changed: {
  packageName: "com.instagram.android",
  timestamp: 1735311234567
}

# Switch to Chrome
[AppMonitor] Foreground app changed: {
  packageName: "com.android.chrome", 
  timestamp: 1735311245678
}

# Switch back to BreakLoop
[AppMonitor] Foreground app changed: {
  packageName: "com.anonymous.breakloopnative",
  timestamp: 1735311256789
}
```

## Implementation Details

### Polling Mechanism
- Service polls every 1 second (POLL_INTERVAL_MS = 1000)
- Queries usage stats for last 10 seconds
- Finds most recently used app by lastTimeUsed timestamp
- Only emits event when app changes

### Event Format
```javascript
{
  packageName: string,  // e.g., "com.instagram.android"
  timestamp: number     // Unix timestamp in milliseconds
}
```

### Service Lifecycle
- **START_STICKY**: Service restarts if killed by system
- **Foreground Service**: Shows persistent notification
- **React Context**: Set via AppMonitorModule init, used to emit events

