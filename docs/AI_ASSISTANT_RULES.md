# AI Assistant Rules for BreakLoop-Native

## Critical Rules for Native Module Development

### 🚨 MANDATORY CHECKLIST: Adding New Native Modules

When creating or modifying native modules, **ALL** of these steps are REQUIRED:

#### Step 1: Create the Native Module Files
- [ ] Create `plugins/src/android/java/com/anonymous/breakloopnative/YourModule.kt`
- [ ] Create `plugins/src/android/java/com/anonymous/breakloopnative/YourPackage.kt`
- [ ] Add TypeScript interface in `src/native-modules/YourModule.ts`

#### Step 2: Update the Plugin (CRITICAL - DO NOT SKIP)
- [ ] Update `plugins/withForegroundService.js`:
  - [ ] Add source/destination paths in `getSourcePaths()` and `getDestinationPaths()`
  - [ ] Add file copying logic in `copyKotlinFiles()`
  - [ ] Add package registration in `registerAppMonitorPackage()` or create new registration function
  - [ ] Update plugin header comments to document the new module

#### Step 3: Update Validation Script (CRITICAL - DO NOT SKIP)
- [ ] Update `scripts/validate-native-modules.js`:
  - [ ] Add new package to `requiredPackages` array
  - [ ] Include name, registration string, and description

#### Step 4: Test the Implementation
- [ ] Run `npx expo prebuild --clean`
- [ ] Verify plugin logs show registration message
- [ ] Run `npm run validate:native` - MUST PASS
- [ ] Run `npm run android` - MUST BUILD SUCCESSFULLY
- [ ] Test the native module functionality in the app

#### Step 5: Update Documentation
- [ ] Add entry to this file documenting the new module
- [ ] Update `docs/PREVENTION_CHECKLIST.md` if needed
- [ ] Add usage examples in relevant docs

### 🔴 VERIFICATION COMMANDS

After ANY native module changes, run these commands:

```bash
# 1. Regenerate android folder
npx expo prebuild --clean

# 2. Validate native modules (MUST PASS)
npm run validate:native

# 3. Build and test
npm run android
```

**If `npm run validate:native` fails, DO NOT PROCEED with the build.**

### 📋 Example: Adding a New Module

Let's say you're adding `LocationModule`:

#### 1. Create Files

**`plugins/src/android/java/com/anonymous/breakloopnative/LocationModule.kt`:**
```kotlin
package com.anonymous.breakloopnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class LocationModule(reactContext: ReactApplicationContext) 
  : ReactContextBaseJavaModule(reactContext) {
  
  override fun getName(): String {
    return "LocationModule"
  }
  
  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    // Implementation
  }
}
```

**`plugins/src/android/java/com/anonymous/breakloopnative/LocationPackage.kt`:**
```kotlin
package com.anonymous.breakloopnative

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LocationPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(LocationModule(reactContext))
  }
  
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
```

**`src/native-modules/LocationModule.ts`:**
```typescript
import { NativeModules } from 'react-native';

interface ILocationModule {
  getCurrentLocation(): Promise<{ lat: number; lng: number }>;
}

export const LocationModule: ILocationModule = NativeModules.LocationModule;
```

#### 2. Update Plugin

**`plugins/withForegroundService.js`:**

```javascript
// In getSourcePaths():
function getSourcePaths(projectRoot) {
  const javaPath = path.join(pluginSrcPath, 'java', 'com', 'anonymous', 'breakloopnative');
  return {
    foregroundService: path.join(javaPath, 'ForegroundDetectionService.kt'),
    appMonitorModule: path.join(javaPath, 'AppMonitorModule.kt'),
    appMonitorPackage: path.join(javaPath, 'AppMonitorPackage.kt'),
    // ADD THESE:
    locationModule: path.join(javaPath, 'LocationModule.kt'),
    locationPackage: path.join(javaPath, 'LocationPackage.kt'),
    // ... rest
  };
}

// In getDestinationPaths():
function getDestinationPaths(projectRoot) {
  const javaPath = path.join(androidMainPath, 'java', 'com', 'anonymous', 'breakloopnative');
  return {
    foregroundService: path.join(javaPath, 'ForegroundDetectionService.kt'),
    // ... existing files ...
    // ADD THESE:
    locationModule: path.join(javaPath, 'LocationModule.kt'),
    locationPackage: path.join(javaPath, 'LocationPackage.kt'),
    // ... rest
  };
}

// In copyKotlinFiles():
function copyKotlinFiles(projectRoot) {
  // ... existing copy logic ...
  
  // ADD THIS:
  if (fs.existsSync(sourcePaths.locationModule)) {
    fs.copyFileSync(sourcePaths.locationModule, destPaths.locationModule);
    console.log(`[${PLUGIN_NAME}] Copied LocationModule.kt`);
  }
  
  if (fs.existsSync(sourcePaths.locationPackage)) {
    fs.copyFileSync(sourcePaths.locationPackage, destPaths.locationPackage);
    console.log(`[${PLUGIN_NAME}] Copied LocationPackage.kt`);
  }
}

// In registerAppMonitorPackage() or create registerLocationPackage():
function registerLocationPackage(projectRoot) {
  // Similar to registerAppMonitorPackage()
  // Add: add(LocationPackage())
}

// In main plugin function:
const withForegroundService = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      
      copyKotlinFiles(projectRoot);
      copyAccessibilityXml(projectRoot);
      
      registerAppMonitorPackage(projectRoot);
      registerLocationPackage(projectRoot);  // ADD THIS
      
      return config;
    },
  ]);
  
  // ... rest
};
```

#### 3. Update Validation Script

**`scripts/validate-native-modules.js`:**

```javascript
const requiredPackages = [
  {
    name: 'AppMonitorPackage',
    registration: 'add(AppMonitorPackage())',
    description: 'Core native module for app monitoring and interventions',
  },
  // ADD THIS:
  {
    name: 'LocationPackage',
    registration: 'add(LocationPackage())',
    description: 'Location services for activity tracking',
  },
];
```

#### 4. Test

```bash
# Clean rebuild
npx expo prebuild --clean

# Look for these logs:
# [withForegroundService] Copied LocationModule.kt
# [withForegroundService] Copied LocationPackage.kt
# [withForegroundService] ✅ Registered LocationPackage in MainApplication.kt

# Validate (MUST PASS)
npm run validate:native

# Should show:
# ✅ AppMonitorPackage
# ✅ LocationPackage
# ✅ All native modules are properly registered!

# Build
npm run android
```

#### 5. Verify in Code

```bash
# Check MainApplication.kt
grep "add(LocationPackage())" android/app/src/main/java/com/anonymous/breakloopnative/MainApplication.kt

# Should output:
# add(LocationPackage())
```

### 🚫 COMMON MISTAKES TO AVOID

#### ❌ Mistake 1: Forgetting to Update the Plugin
**Problem:** Files copied but package not registered  
**Result:** `NativeModules.YourModule` is `undefined`  
**Fix:** Always update `registerXXXPackage()` function

#### ❌ Mistake 2: Forgetting to Update Validation Script
**Problem:** Validation doesn't check new module  
**Result:** Future issues go undetected  
**Fix:** Always add to `requiredPackages` array

#### ❌ Mistake 3: Editing Files in `android/` Instead of `plugins/`
**Problem:** Changes lost on next `expo prebuild`  
**Result:** Code mysteriously "disappears"  
**Fix:** Always edit in `plugins/src/android/`

#### ❌ Mistake 4: Not Running Validation
**Problem:** Build succeeds but module doesn't work  
**Result:** Runtime errors  
**Fix:** Always run `npm run validate:native`

#### ❌ Mistake 5: Skipping Clean Prebuild
**Problem:** Old files cached  
**Result:** Changes don't appear  
**Fix:** Use `npx expo prebuild --clean`

### 📝 AI Assistant Self-Check

Before marking a native module task as complete, verify:

- [ ] Created files in `plugins/src/android/` (NOT `android/app/`)
- [ ] Updated `getSourcePaths()` and `getDestinationPaths()`
- [ ] Updated `copyKotlinFiles()`
- [ ] Updated or created package registration function
- [ ] Updated `scripts/validate-native-modules.js`
- [ ] Ran `npx expo prebuild --clean`
- [ ] Ran `npm run validate:native` and it PASSED
- [ ] Ran `npm run android` and it built successfully
- [ ] Tested the module functionality
- [ ] Updated documentation

**If ANY checkbox is unchecked, the task is NOT complete.**

### 🔍 How to Verify Plugin Changes

After modifying the plugin, check these indicators:

#### During `expo prebuild`:
```
✅ Look for: [withForegroundService] Copied YourModule.kt
✅ Look for: [withForegroundService] Copied YourPackage.kt
✅ Look for: [withForegroundService] ✅ Registered YourPackage in MainApplication.kt
```

#### During `npm run validate:native`:
```
✅ YourPackage
   Your module description

✅ All native modules are properly registered!
```

#### In `MainApplication.kt`:
```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
      add(AppMonitorPackage())
      add(YourPackage())  // ✅ Should be here
    }
```

### 🎯 Quick Reference Card

| Action | Command | Expected Result |
|--------|---------|-----------------|
| Clean rebuild | `npx expo prebuild --clean` | Plugin logs show file copies and registrations |
| Validate | `npm run validate:native` | All packages show ✅ |
| Build | `npm run android` | Validation runs automatically, build succeeds |
| Check registration | `grep "add(YourPackage())" android/.../MainApplication.kt` | Line found with package name |
| Sync Kotlin | `npm run sync:kotlin` | Files synced from plugins/ to android/ |

### 📚 Related Documentation

- `docs/NATIVE_MODULE_REGISTRATION_FIX.md` - Why this matters
- `docs/PREVENTION_CHECKLIST.md` - Prevention strategies
- `docs/KOTLIN_FILE_SYNC.md` - Kotlin file workflow
- `.cursor/rules/kotlin-plugin.mdc` - Cursor-specific rules

### 🤖 For AI Assistants

**When you see a request to create a native module:**

1. **STOP** - Don't just create the Kotlin files
2. **CHECK** - Review this entire document
3. **PLAN** - List all 5 steps that need to be done
4. **EXECUTE** - Complete ALL steps, not just file creation
5. **VERIFY** - Run validation commands
6. **CONFIRM** - Show validation output to user

**Red flags that indicate incomplete work:**
- Only Kotlin files created, plugin not updated
- Plugin updated but validation script not updated
- Files created in `android/` instead of `plugins/`
- No validation commands run
- No verification of registration in `MainApplication.kt`

**Always ask yourself:**
> "If I run `npm run validate:native` right now, will it pass?"

If the answer is "no" or "I don't know", the work is incomplete.

### 💡 Pro Tips

1. **Use the validation script as your checklist** - If it passes, you did it right
2. **Always do clean rebuilds** - Prevents cached file issues
3. **Check plugin logs** - They tell you exactly what happened
4. **Verify in code** - Don't trust, verify the registration is there
5. **Update docs** - Future you will thank present you

---

**Last Updated:** January 2026  
**Status:** Active - Follow these rules for ALL native module work
