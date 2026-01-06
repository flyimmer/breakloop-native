# Native Module Registration - Prevention Checklist

## Why This Matters

The "Enable Accessibility Service" button failed because `AppMonitorPackage` wasn't registered in `MainApplication.kt`. This is a **critical but silent failure** that's easy to miss.

## What We've Implemented

### ✅ 1. Plugin Auto-Registration

**File:** `plugins/withForegroundService.js`

The plugin now automatically registers `AppMonitorPackage` during `expo prebuild`:

```javascript
function registerAppMonitorPackage(projectRoot) {
  // Modifies MainApplication.kt to add:
  // add(AppMonitorPackage())
}
```

**Verification:** Look for this log during prebuild:
```
[withForegroundService] ✅ Registered AppMonitorPackage in MainApplication.kt
```

### ✅ 2. Build-Time Validation

**File:** `scripts/validate-native-modules.js`

Runs automatically before every Android build via `npm run android`.

**What it checks:**
- `MainApplication.kt` exists
- `add(AppMonitorPackage())` is present
- All required native modules are registered

**Output:**
```
🔍 Validating native module registration...

Checking required packages:

✅ AppMonitorPackage
   Core native module for app monitoring and interventions

────────────────────────────────────────────────────────────
📊 Summary: 1/1 packages registered

✅ All native modules are properly registered!
```

**If it fails:**
```
❌ AppMonitorPackage
   Missing: add(AppMonitorPackage())
   Purpose: Core native module for app monitoring and interventions

❌ Native module validation failed!

🔧 To fix:
   1. Run: npx expo prebuild --clean
   2. Check that plugins/withForegroundService.js is working correctly
   3. Verify the plugin logs show: "✅ Registered AppMonitorPackage"
```

### ✅ 3. Runtime Validation (Optional)

**File:** `scripts/check-native-modules-startup.ts`

Can be added to `app/App.tsx` to check modules at startup:

```typescript
import { checkNativeModules } from '@/scripts/check-native-modules-startup';

useEffect(() => {
  checkNativeModules();
}, []);
```

**Benefits:**
- Catches missing modules immediately on app start
- Shows dev alert if critical modules are missing
- Provides clear fix instructions

### ✅ 4. Enhanced Error Handling

**File:** `app/screens/mainAPP/Settings/SettingsScreen.tsx`

The button now has better error handling:

```typescript
if (!AppMonitorModule) {
  Alert.alert(
    'Error', 
    'Native module not available. Please rebuild:\n' +
    '1. npx expo prebuild --clean\n' +
    '2. npm run android'
  );
  return;
}
```

### ✅ 5. Documentation

**Files:**
- `docs/NATIVE_MODULE_REGISTRATION_FIX.md` - Complete explanation
- `docs/PREVENTION_CHECKLIST.md` - This file
- `docs/KOTLIN_FILE_SYNC.md` - Kotlin workflow

## How to Use

### Normal Development

Just use the normal commands - validation happens automatically:

```bash
# Edit Kotlin files in plugins/src/
npm run android
# ✅ Syncs Kotlin files
# ✅ Validates native modules
# ✅ Builds app
```

### After Pulling Changes

If someone updated the plugin or native code:

```bash
npx expo prebuild --clean
npm run android
```

### Manual Validation

Check native modules without building:

```bash
npm run validate:native
```

### Troubleshooting

If validation fails:

1. **Clean rebuild:**
   ```bash
   npx expo prebuild --clean
   npm run android
   ```

2. **Check plugin logs:**
   Look for `[withForegroundService] ✅ Registered AppMonitorPackage`

3. **Manual verification:**
   ```bash
   grep "add(AppMonitorPackage())" android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt
   ```

## Prevention Workflow

### When Adding a New Native Module

1. **Create the module:**
   ```kotlin
   // plugins/src/android/java/.../MyNewModule.kt
   class MyNewModule(reactContext: ReactApplicationContext) 
     : ReactContextBaseJavaModule(reactContext) {
     // ...
   }
   ```

2. **Create the package:**
   ```kotlin
   // plugins/src/android/java/.../MyNewPackage.kt
   class MyNewPackage : ReactPackage {
     override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
       return listOf(MyNewModule(reactContext))
     }
   }
   ```

3. **Update the plugin:**
   ```javascript
   // plugins/withForegroundService.js
   
   // Add to copyKotlinFiles():
   if (fs.existsSync(sourcePaths.myNewModule)) {
     fs.copyFileSync(sourcePaths.myNewModule, destPaths.myNewModule);
   }
   
   // Add to registerAppMonitorPackage() or create new function:
   content = content.replace(
     applyBlockPattern,
     '$1              add(MyNewPackage())\n$2'
   );
   ```

4. **Update validation script:**
   ```javascript
   // scripts/validate-native-modules.js
   
   const requiredPackages = [
     {
       name: 'AppMonitorPackage',
       registration: 'add(AppMonitorPackage())',
       description: '...',
     },
     {
       name: 'MyNewPackage',  // Add this
       registration: 'add(MyNewPackage())',
       description: 'My new native module',
     },
   ];
   ```

5. **Test:**
   ```bash
   npx expo prebuild --clean
   npm run validate:native  # Should pass
   npm run android
   ```

## Red Flags to Watch For

### 🚩 "Module not available" errors
- Means native module isn't registered
- Run `npm run validate:native`

### 🚩 Plugin logs missing registration message
- During `expo prebuild`, you should see:
  ```
  [withForegroundService] ✅ Registered AppMonitorPackage
  ```
- If missing, plugin registration failed

### 🚩 NativeModules.X is undefined
- Check if module is registered in `MainApplication.kt`
- Run validation script

### 🚩 Features work after prebuild but not after regular build
- Suggests plugin isn't running
- Make sure to use `npm run android`, not `expo run:android` directly

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run android` | Build app (includes validation) |
| `npm run validate:native` | Check native module registration |
| `npm run validate:kotlin` | Check Kotlin files are in plugin |
| `npm run sync:kotlin` | Sync Kotlin files manually |
| `npx expo prebuild --clean` | Regenerate android folder |

## Files Modified

### Plugin
- ✅ `plugins/withForegroundService.js` - Added `registerAppMonitorPackage()`

### Scripts
- ✅ `scripts/validate-native-modules.js` - Build-time validation
- ✅ `scripts/check-native-modules-startup.ts` - Runtime validation (optional)

### Configuration
- ✅ `package.json` - Added `validate:native` to `android` script

### Documentation
- ✅ `docs/NATIVE_MODULE_REGISTRATION_FIX.md` - Complete explanation
- ✅ `docs/PREVENTION_CHECKLIST.md` - This file

### UI
- ✅ `app/screens/mainAPP/Settings/SettingsScreen.tsx` - Better error handling

## Summary

**Before:** Plugin copied files but didn't register the package → Silent failure  
**After:** Plugin registers package + validation catches issues → Fail fast with clear errors

**Key Principle:** **Fail loudly and early** rather than silently at runtime.
