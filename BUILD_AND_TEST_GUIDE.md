# ✅ App Monitor Module - Final Checklist & Build Instructions

## 📋 Implementation Checklist

### ✅ Android Native Files (Kotlin)
- [x] `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorService.kt`
- [x] `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
- [x] `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorPackage.kt`
- [x] `android/app/src/main/AndroidManifest.xml` (permissions + service declaration)
- [x] `android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt` (package registration)

### ✅ React Native Files (TypeScript)
- [x] `src/native-modules/AppMonitorModule.ts` (TypeScript interface)
- [x] `hooks/useAppMonitor.ts` (React hook)
- [x] `app/screens/AppMonitorExample.tsx` (example component)

### ✅ Documentation
- [x] `android/APP_MONITOR_README.md` (comprehensive documentation)
- [x] `INTEGRATION_GUIDE_APP_MONITOR.md` (quick integration guide)
- [x] `APP_MONITOR_IMPLEMENTATION_SUMMARY.md` (implementation summary)
- [x] `android/APP_MONITOR_ARCHITECTURE_DIAGRAM.txt` (visual architecture)

### ✅ Code Quality
- [x] No lint errors in Kotlin files
- [x] No lint errors in TypeScript files
- [x] All files have comprehensive comments
- [x] Type safety with TypeScript interfaces

## 🔨 Build Instructions

### Step 1: Clean Build

**Windows (PowerShell):**
```powershell
cd android
.\gradlew.bat clean
cd ..

# Clear Metro cache
npm start -- --reset-cache
# Press Ctrl+C to stop after cache is cleared
```

**Unix/Mac:**
```bash
cd android
./gradlew clean
cd ..

# Clear Metro cache
npm start -- --reset-cache
# Press Ctrl+C to stop after cache is cleared
```

**Troubleshooting:**

**CMake Codegen Errors (Common):**
If you see errors about missing codegen directories during clean:
```powershell
# Remove CMake cache first, then clean
cd android
Remove-Item -Path "app\.cxx" -Recurse -Force -ErrorAction SilentlyContinue
.\gradlew.bat clean
cd ..
```
Or use the helper script: `.\scripts\clean-android.ps1`

**Java Issues:**
- If you see "JAVA_HOME is not set", ensure Java is installed and JAVA_HOME points to your Java installation
- On Windows, prefer `.\gradlew.bat` or `gradlew.bat` over `./gradlew`
- If `gradlew.bat` doesn't work, try: `gradlew clean` (without `.\`)

### Step 2: Build & Install

#### Option A: Build & Install via npm (Recommended)
```bash
npm run android
```

#### Option B: Build via Gradle + Install
```bash
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
cd ..
```

#### Option C: Build & Run via Expo CLI
```bash
npx expo run:android
```

### Step 3: Start Metro Bundler (if not already running)
```bash
npm start
```

### Step 4: Verify Build Success

Check for these indicators:
- ✅ Build completes without errors
- ✅ App installs on device/emulator
- ✅ App launches successfully
- ✅ No crash on startup

## 🧪 Testing Instructions

### Test 1: Verify Module is Accessible

Add this to any screen (e.g., `App.tsx`):

```typescript
import { AppMonitorModule } from './src/native-modules/AppMonitorModule';
import { useEffect } from 'react';

useEffect(() => {
  console.log('AppMonitorModule:', AppMonitorModule);
  AppMonitorModule.isMonitoring()
    .then(status => console.log('Monitoring status:', status))
    .catch(err => console.error('Module error:', err));
}, []);
```

Expected output in logs:
```
AppMonitorModule: { startMonitoring: [Function], stopMonitoring: [Function], isMonitoring: [Function] }
Monitoring status: false
```

### Test 2: Add Example Screen to Navigator

In your `RootNavigator.tsx` or equivalent:

```typescript
import { AppMonitorExample } from '../screens/AppMonitorExample';

// Add to your stack
<Stack.Screen 
  name="AppMonitorExample" 
  component={AppMonitorExample}
  options={{ title: 'App Monitor Demo' }}
/>
```

Or create a temporary test navigator:

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppMonitorExample } from './app/screens/AppMonitorExample';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="AppMonitorExample" 
          component={AppMonitorExample} 
          options={{ title: 'App Monitor Demo' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### Test 3: Grant Permission

1. Open the app and navigate to AppMonitorExample screen
2. Tap "Grant Permission" button
3. In Android Settings:
   - Go to: Apps → Special app access → Usage access
   - OR: Apps → BreakLoop → Advanced → Usage access
4. Find "BreakLoop" in the list
5. Toggle "Permit usage access" to **ON**
6. Return to the app

### Test 4: Start Monitoring

1. In AppMonitorExample screen, tap "Start Monitoring"
2. Verify:
   - ✅ Status shows "✅ Monitoring"
   - ✅ Notification appears: "BreakLoop Active - Monitoring app usage"
   - ✅ No error message displayed

### Test 5: Test Event Emission

1. With monitoring active, press Home button
2. Open Instagram (or any other app)
3. Wait 1-2 seconds
4. Return to BreakLoop app
5. Verify:
   - ✅ "Current App" shows "com.instagram.android" (or the app you opened)
   - ✅ Recent Events list shows the app switch
   - ✅ Timestamp is correct

6. Switch to a few more apps (Chrome, YouTube, etc.)
7. Return to BreakLoop
8. Verify:
   - ✅ All app switches are logged in Recent Events
   - ✅ Timestamps are sequential

### Test 6: Stop Monitoring

1. Tap "Stop Monitoring"
2. Verify:
   - ✅ Status shows "❌ Stopped"
   - ✅ Notification disappears
   - ✅ No more events are logged when switching apps

### Test 7: Check Logs (via adb logcat)

```bash
# Filter logs for AppMonitor
adb logcat | grep -i appmonitor
```

Expected output when monitoring starts:
```
D/AppMonitorService: Service created
D/AppMonitorService: Monitoring started
```

Expected output when app switches (e.g., to Instagram):
```
D/AppMonitorService: Foreground app changed: com.instagram.android
D/AppMonitorModule: Emitting event: onForegroundAppChanged
```

### Test 8: Verify Service is Running

```bash
# Check if service is running
adb shell dumpsys activity services | grep AppMonitorService
```

Expected output:
```
* ServiceRecord{...} com.anonymous.breakloopnative/.AppMonitorService
  app=ProcessRecord{...}
  isForeground=true
```

## 🐛 Troubleshooting

### Issue: "Module not found" error

**Symptoms:**
```
ERROR: Can't find variable: AppMonitorModule
```

**Solution:**
```bash
# 1. Clear Metro cache
npm start -- --reset-cache

# 2. Rebuild Android
cd android && ./gradlew clean && cd ..
npm run android
```

### Issue: No events are emitted

**Symptoms:**
- Monitoring status shows "✅ Monitoring"
- Notification is visible
- But no events appear when switching apps

**Causes & Solutions:**

1. **Permission not granted**
   - Go to Settings → Apps → Special app access → Usage access
   - Enable for BreakLoop

2. **Events are being emitted but not received**
   - Check logs: `adb logcat | grep AppMonitor`
   - Should see: "Foreground app changed: ..."

3. **JavaScript bridge not receiving events**
   - Restart app completely (force close + reopen)
   - Check: `adb logcat | grep ReactNative`

### Issue: App crashes on start

**Symptoms:**
```
Fatal Exception: java.lang.RuntimeException
Unable to instantiate application
```

**Solution:**
```bash
# 1. Check AndroidManifest.xml syntax
# Ensure service declaration is correct

# 2. Clean build
cd android
./gradlew clean
./gradlew assembleDebug
cd ..

# 3. Reinstall
adb uninstall com.anonymous.breakloopnative
npm run android
```

### Issue: Notification doesn't appear

**Symptoms:**
- Monitoring starts successfully
- No notification visible

**Solution:**
1. Check notification permissions are granted for the app
2. Verify notification channel is created (Android 8.0+)
3. Check logs: `adb logcat | grep Notification`

### Issue: High battery drain

**Symptoms:**
- Battery drains faster than expected

**Solution:**
1. Check polling interval in `AppMonitorService.kt`:
   ```kotlin
   private const val POLL_INTERVAL_MS = 1000L // Try increasing to 2000L or 3000L
   ```
2. Consider implementing adaptive polling (faster when screen on, slower when screen off)

## 📊 Performance Verification

### Check Battery Usage
```bash
# Check battery stats (requires root or adb)
adb shell dumpsys batterystats | grep -i breakloop
```

### Check Memory Usage
```bash
# Check memory usage
adb shell dumpsys meminfo com.anonymous.breakloopnative
```

Expected:
- **Native Heap**: ~10-15 MB
- **Total PSS**: ~50-70 MB (including React Native overhead)

### Check CPU Usage
```bash
# Monitor CPU usage (run for 30 seconds)
adb shell top | grep breakloop
```

Expected:
- **CPU %**: < 1% average

## 🎯 Integration with Your App

Once testing is complete, integrate with your intervention flow:

### Example Integration (App.tsx)

```typescript
import { useAppMonitor } from './hooks/useAppMonitor';
import { useIntervention } from './src/contexts/InterventionProvider';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);

  // Load monitored apps from storage
  useEffect(() => {
    AsyncStorage.getItem('monitored_apps').then(apps => {
      if (apps) setMonitoredApps(JSON.parse(apps));
    });
  }, []);

  // Start monitoring and handle app changes
  useAppMonitor({
    autoStart: true,
    onAppChanged: (packageName, timestamp) => {
      console.log('📱 App changed:', packageName);

      // Check if this app should trigger intervention
      if (monitoredApps.includes(packageName)) {
        // Only trigger if not already in intervention
        if (interventionState.state === 'idle') {
          console.log('🛑 Triggering intervention for:', packageName);
          dispatchIntervention({
            type: 'BEGIN_INTERVENTION',
            appPackageName: packageName,
            timestamp,
          });
        }
      }
    },
  });

  return <YourNavigator />;
}
```

## ✅ Final Verification Checklist

Before considering the implementation complete:

- [ ] App builds successfully (`npm run android`)
- [ ] No build errors or warnings
- [ ] App installs on device/emulator
- [ ] App launches without crashing
- [ ] AppMonitorExample screen renders correctly
- [ ] "Grant Permission" button opens Settings
- [ ] Permission can be granted successfully
- [ ] "Start Monitoring" starts the service
- [ ] Notification appears when monitoring
- [ ] Events are logged when switching apps
- [ ] Events show correct package names
- [ ] Events show correct timestamps
- [ ] "Stop Monitoring" stops the service
- [ ] Notification disappears when stopped
- [ ] No memory leaks after stopping
- [ ] No crashes during 5-minute test
- [ ] Battery drain is acceptable (<5% per hour)

## 🎉 Success Criteria

The implementation is **complete and successful** when:

1. ✅ All files are created and no lint errors
2. ✅ App builds and installs successfully
3. ✅ Module is accessible from JavaScript
4. ✅ Service starts and shows notification
5. ✅ Events are emitted when apps switch
6. ✅ Events contain correct data (package name + timestamp)
7. ✅ Service stops cleanly
8. ✅ No crashes or memory leaks

## 📚 Next Steps

1. **Test**: Follow the testing instructions above
2. **Integrate**: Add to your intervention flow
3. **Customize**: Adjust polling interval if needed
4. **Optimize**: Implement adaptive polling (future)
5. **Monitor**: Track battery and performance metrics

## 🚀 You're Ready!

All code is written, documented, and ready for testing.

**Start here**: Build the app and test with the AppMonitorExample screen.

Good luck! 🎊

