# App Monitor Module - Quick Reference Card

## 🚀 Quick Start (Copy & Paste)

### 1. Build & Install
```bash
cd android && ./gradlew clean && cd .. && npm run android
```

### 2. Grant Permission
Settings → Apps → Special app access → Usage access → BreakLoop → Enable

### 3. Basic Usage in Your App
```typescript
import { useAppMonitor } from './hooks/useAppMonitor';

function MyApp() {
  useAppMonitor({
    autoStart: true,
    onAppChanged: (packageName, timestamp) => {
      console.log('App changed:', packageName);
      // Your logic here
    },
  });
  
  return <YourNavigator />;
}
```

## 📦 Module API

### AppMonitorModule (Native)
```typescript
import { AppMonitorModule } from './src/native-modules/AppMonitorModule';

// Start monitoring
await AppMonitorModule.startMonitoring();
// Returns: { success: true, message: "..." }

// Stop monitoring
await AppMonitorModule.stopMonitoring();
// Returns: { success: true, message: "..." }

// Check status
const isActive = await AppMonitorModule.isMonitoring();
// Returns: boolean
```

### useAppMonitor Hook
```typescript
import { useAppMonitor } from './hooks/useAppMonitor';

const {
  currentApp,        // string | null - Current foreground app
  isMonitoring,      // boolean - Is monitoring active?
  startMonitoring,   // () => Promise<void>
  stopMonitoring,    // () => Promise<void>
  checkStatus,       // () => Promise<void>
  error,             // string | null - Last error
} = useAppMonitor({
  onAppChanged: (packageName, timestamp) => {
    // Called when foreground app changes
  },
  autoStart: true,   // Optional: Start monitoring on mount
});
```

### Event Data
```typescript
interface ForegroundAppEvent {
  packageName: string;  // e.g., "com.instagram.android"
  timestamp: number;    // milliseconds since epoch
}
```

## 🔧 Common Tasks

### Task: Start monitoring when app launches
```typescript
useAppMonitor({
  autoStart: true,
  onAppChanged: (pkg, ts) => console.log(pkg),
});
```

### Task: Trigger intervention when monitored app opens
```typescript
const monitoredApps = ['com.instagram.android', 'com.tiktok'];

useAppMonitor({
  autoStart: true,
  onAppChanged: (packageName, timestamp) => {
    if (monitoredApps.includes(packageName)) {
      if (interventionState.state === 'idle') {
        dispatchIntervention({ 
          type: 'BEGIN_INTERVENTION',
          appPackageName: packageName,
          timestamp,
        });
      }
    }
  },
});
```

### Task: Add monitoring toggle in Settings
```typescript
import { AppMonitorModule } from './src/native-modules/AppMonitorModule';

const [enabled, setEnabled] = useState(false);

const toggle = async () => {
  if (enabled) {
    await AppMonitorModule.stopMonitoring();
    setEnabled(false);
  } else {
    await AppMonitorModule.startMonitoring();
    setEnabled(true);
  }
};

return (
  <Switch value={enabled} onValueChange={toggle} />
);
```

### Task: Open permission settings
```typescript
import { Linking } from 'react-native';

function openPermissionSettings() {
  Linking.openSettings();
  // User must navigate to: Special app access → Usage access → BreakLoop
}
```

### Task: Log all app switches
```typescript
useAppMonitor({
  onAppChanged: (packageName, timestamp) => {
    console.log(`[${new Date(timestamp).toLocaleTimeString()}] ${packageName}`);
  },
});
```

### Task: Debounce events (ignore rapid switches)
```typescript
const lastApp = useRef<string | null>(null);
const lastTime = useRef(0);

useAppMonitor({
  onAppChanged: (packageName, timestamp) => {
    // Ignore if same app within 3 seconds
    if (packageName === lastApp.current && 
        timestamp - lastTime.current < 3000) {
      return;
    }
    
    lastApp.current = packageName;
    lastTime.current = timestamp;
    
    // Handle app change
    console.log('App changed:', packageName);
  },
});
```

## 🐛 Debug Commands

### Check if service is running
```bash
adb shell dumpsys activity services | grep AppMonitorService
```

### View logs
```bash
adb logcat | grep AppMonitor
```

### Check permission status
```bash
adb shell appops get com.anonymous.breakloopnative PACKAGE_USAGE_STATS
# Expected: "allow"
```

### Force stop service
```bash
adb shell am stopservice com.anonymous.breakloopnative/.AppMonitorService
```

### Clear app data (reset state)
```bash
adb shell pm clear com.anonymous.breakloopnative
```

## 📱 Common Package Names

```typescript
const commonApps = {
  instagram: 'com.instagram.android',
  tiktok: 'com.zhiliaoapp.musically', // or com.ss.android.ugc.tiktok
  facebook: 'com.facebook.katana',
  youtube: 'com.google.android.youtube',
  chrome: 'com.android.chrome',
  whatsapp: 'com.whatsapp',
  twitter: 'com.twitter.android',
  snapchat: 'com.snapchat.android',
  reddit: 'com.reddit.frontpage',
  netflix: 'com.netflix.mediaclient',
};
```

## 📊 Files Location

```
android/app/src/main/java/com/anonymous/breakloopnative/
├── AppMonitorService.kt    # Foreground service
├── AppMonitorModule.kt     # React Native bridge
└── AppMonitorPackage.kt    # Package registration

src/native-modules/
└── AppMonitorModule.ts     # TypeScript interface

hooks/
└── useAppMonitor.ts        # React hook

app/screens/
└── AppMonitorExample.tsx   # Example component
```

## 🔗 Documentation Links

- **Full README**: `android/APP_MONITOR_README.md`
- **Integration Guide**: `INTEGRATION_GUIDE_APP_MONITOR.md`
- **Build Guide**: `BUILD_AND_TEST_GUIDE.md`
- **Architecture**: `android/APP_MONITOR_ARCHITECTURE_DIAGRAM.txt`
- **Summary**: `APP_MONITOR_IMPLEMENTATION_SUMMARY.md`

## ⚡ Performance Tips

### Reduce battery usage
```kotlin
// In AppMonitorService.kt, change:
private const val POLL_INTERVAL_MS = 2000L  // From 1000L to 2000L
```

### Only monitor when screen is on
```kotlin
// Add PowerManager check in checkForegroundApp()
val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
if (!powerManager.isInteractive) return  // Skip if screen off
```

### Filter apps at native level (advanced)
```kotlin
// In checkForegroundApp(), before emitting:
val monitoredApps = setOf("com.instagram.android", "com.tiktok")
if (foregroundPackage !in monitoredApps) return
```

## 🎯 Integration Patterns

### Pattern 1: Global Monitoring (Recommended)
```typescript
// In App.tsx
useAppMonitor({ autoStart: true, onAppChanged: handleAppChange });
```

### Pattern 2: Conditional Monitoring
```typescript
// Only monitor when user enables it
const { monitoringEnabled } = useSettings();
useAppMonitor({ 
  autoStart: monitoringEnabled, 
  onAppChanged: handleAppChange 
});
```

### Pattern 3: Manual Control
```typescript
// User manually starts/stops via button
const { startMonitoring, stopMonitoring } = useAppMonitor({
  onAppChanged: handleAppChange
});
// Don't use autoStart: true
```

## ✅ Verification Checklist (1-Minute)

```bash
# 1. Build
npm run android

# 2. Check module exists
adb shell am broadcast -a com.anonymous.breakloopnative.CHECK_MODULE
# Should not crash

# 3. Grant permission
# Settings → Apps → Special app access → Usage access → BreakLoop → ON

# 4. Test monitoring
# Open app → Start monitoring → Switch apps → Check logs
adb logcat | grep AppMonitor

# Expected output:
# D/AppMonitorService: Foreground app changed: com.instagram.android
```

## 🎉 Quick Success Test

```typescript
// Add this anywhere in your app
useEffect(() => {
  const test = async () => {
    await AppMonitorModule.startMonitoring();
    console.log('✅ Monitoring started');
    
    setTimeout(async () => {
      const status = await AppMonitorModule.isMonitoring();
      console.log('✅ Status:', status);
      
      await AppMonitorModule.stopMonitoring();
      console.log('✅ Monitoring stopped');
    }, 3000);
  };
  
  test();
}, []);
```

Expected console output:
```
✅ Monitoring started
✅ Status: true
✅ Monitoring stopped
```

---

**Need Help?** Check the full documentation in `BUILD_AND_TEST_GUIDE.md`

