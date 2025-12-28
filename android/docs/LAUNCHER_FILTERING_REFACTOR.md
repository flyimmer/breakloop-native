# Launcher Filtering Architecture Refactor

## Overview

This document explains the refactoring of launcher event filtering from the native Android AccessibilityService layer to the JavaScript OS Trigger Brain layer.

---

## What Changed

### 1. Native Layer (ForegroundDetectionService.kt)

**Before:**
```kotlin
// Filtered launchers at native level
if (isLauncher(packageName)) {
    Log.d(TAG, "🏠 Launcher detected, ignoring: $packageName")
    return  // Don't update lastPackageName, don't emit
}
```

**After:**
```kotlin
// Reports ALL foreground changes (including launchers)
Log.i(TAG, "📱 Foreground app changed: $packageName")

// Only suppresses duplicate consecutive events
if (packageName == lastPackageName) {
    return
}
```

**Key Changes:**
- ❌ Removed `LAUNCHER_PACKAGES` set (13 launchers)
- ❌ Removed `isLauncher()` function
- ❌ Removed launcher filtering logic
- ✅ Reports ALL package changes to upper layers
- ✅ Still suppresses duplicate consecutive events (native normalization)

**Native Layer Responsibility:**
- Detect raw OS-level foreground changes
- Suppress duplicate consecutive events only
- Report all meaningful transitions

---

### 2. OS Trigger Brain (osTriggerBrain.ts)

**Added:**
```typescript
// Launcher package set (same 13 launchers)
const LAUNCHER_PACKAGES = new Set([
  'com.android.launcher',
  'com.hihonor.android.launcher',
  // ... + 11 more
]);

function isLauncher(packageName: string): boolean {
  return LAUNCHER_PACKAGES.has(packageName);
}
```

**New State Tracking:**
```typescript
// Raw tracking (includes launchers)
let lastForegroundApp: string | null = null;
const lastExitTimestamps: Map<string, number> = new Map();

// Meaningful tracking (excludes launchers)
let lastMeaningfulApp: string | null = null;
const lastMeaningfulExitTimestamps: Map<string, number> = new Map();
```

**Semantic Filtering in handleForegroundAppChange():**
```typescript
// Step 1: Record raw exit (all apps)
if (lastForegroundApp !== null && lastForegroundApp !== packageName) {
  lastExitTimestamps.set(lastForegroundApp, timestamp);
}

// Step 2: Launcher filtering
if (isLauncher(packageName)) {
  if (__DEV__) {
    console.log('[OS Trigger Brain] Launcher event ignored for semantics');
  }
  lastForegroundApp = packageName;  // Update raw tracking
  return;  // Don't update meaningful tracking or run intervention logic
}

// Step 3: Handle meaningful app entry
if (lastMeaningfulApp !== null && lastMeaningfulApp !== packageName) {
  lastMeaningfulExitTimestamps.set(lastMeaningfulApp, timestamp);
}

// Step 4: Run intervention logic (only for meaningful apps)
// ...check monitored app, timers, intervals...

// Update both tracking states
lastForegroundApp = packageName;
lastMeaningfulApp = packageName;
```

**OS Trigger Brain Responsibility:**
- Filter launchers semantically
- Track meaningful app transitions
- Calculate app switch intervals between meaningful apps
- Decide when interventions are needed

---

## Why This Architecture

### Separation of Concerns

| Layer | Responsibility | Should Know About |
|-------|----------------|-------------------|
| **Native (AccessibilityService)** | Detect raw OS events | Window state changes, package names |
| **OS Trigger Brain (JS)** | Business logic & semantics | What's a "meaningful" app, intervention rules |

### Benefits of JS-Layer Filtering

#### 1. **Business Logic Belongs in Business Layer**
```
Native:  "Instagram is now foreground"
JS:      "Is Instagram meaningful? Yes. Was user just in Instagram? No. Trigger intervention."

Native:  "Launcher is now foreground"
JS:      "Is launcher meaningful? No. Ignore."
```

#### 2. **Easier to Maintain Launcher List**
- **Before:** Update Kotlin code, recompile, reinstall APK
- **After:** Update TypeScript code, Metro hot-reloads instantly

#### 3. **Platform Independence**
- Same launcher filtering logic works for:
  - Android (current)
  - iOS (future)
  - Web (future)
- Only need to maintain one launcher list

#### 4. **Testable Business Logic**
```typescript
// Easy to unit test in JS
describe('handleForegroundAppChange', () => {
  it('should ignore launcher events', () => {
    handleForegroundAppChange({ 
      packageName: 'com.hihonor.android.launcher', 
      timestamp: 1000 
    });
    expect(getCurrentMeaningfulApp()).toBeNull();
  });
  
  it('should track meaningful app transitions', () => {
    handleForegroundAppChange({ 
      packageName: 'com.instagram.android', 
      timestamp: 1000 
    });
    expect(getCurrentMeaningfulApp()).toBe('com.instagram.android');
  });
});
```

#### 5. **Flexibility in Semantic Rules**
```typescript
// Easy to add more semantic filtering
if (isLauncher(packageName)) return;
if (isSystemApp(packageName)) return;
if (isTransientDialog(packageName)) return;
// All in one place, all testable
```

---

## Behavior Examples

### Example 1: Launcher Bounce During Transition

**User Action:** Opens Instagram from home screen

**Native Layer Emits:**
```
📱 Foreground app changed: com.instagram.android
📱 Foreground app changed: com.hihonor.android.launcher
📱 Foreground app changed: com.instagram.android  (duplicate, suppressed)
```

**OS Trigger Brain Processes:**
```
✅ Instagram → Meaningful app entry → Check intervention rules
🏠 Launcher → Ignored for semantics (DEV log only)
```

**Result:**
- `lastForegroundApp`: `"com.hihonor.android.launcher"` (raw)
- `lastMeaningfulApp`: `"com.instagram.android"` (semantic)
- Intervention logic runs only once for Instagram

### Example 2: Home Button Press

**User Action:** Instagram → Press Home → YouTube

**Native Layer Emits:**
```
📱 Foreground app changed: com.hihonor.android.launcher
📱 Foreground app changed: com.youtube.android
```

**OS Trigger Brain Processes:**
```
🏠 Launcher → Ignored, Instagram still considered "last meaningful app"
✅ YouTube → Meaningful transition from Instagram to YouTube
```

**Result:**
- App switch interval calculated from Instagram exit to YouTube entry
- Launcher time doesn't count toward interval

### Example 3: Rapid App Switching

**User Action:** Instagram → Recent Apps → YouTube

**Native Layer Emits:**
```
📱 Foreground app changed: com.hihonor.android.launcher
📱 Foreground app changed: com.youtube.android
```

**OS Trigger Brain Processes:**
```
🏠 Launcher → Ignored
✅ YouTube → Direct transition from Instagram to YouTube (semantically)
```

**Result:**
- Clean transition log
- Correct interval calculation

---

## Implementation Details

### Dual Tracking Strategy

**Why track both raw and meaningful?**

1. **Raw tracking (`lastForegroundApp`):**
   - Needed to infer exits correctly
   - Native events are sequential: A→B means A exited
   - Must track ALL events (including launchers) to know when apps exit

2. **Meaningful tracking (`lastMeaningfulApp`):**
   - Used for intervention decisions
   - Used for app switch interval calculations
   - Represents user perception of "current app"

**Example:**
```
Instagram → Launcher → YouTube

Raw:        Instagram → Launcher → YouTube
Meaningful: Instagram --------→ YouTube

lastForegroundApp:  "com.youtube.android"
lastMeaningfulApp:  "com.youtube.android"
```

### Exit Timestamp Logic

**Dual exit maps:**
```typescript
// Track ALL exits (for native event inference)
lastExitTimestamps.set('com.instagram.android', timestamp);

// Track meaningful exits (for interval calculation)
lastMeaningfulExitTimestamps.set('com.instagram.android', timestamp);
```

**Why separate?**
- App switch interval uses meaningful exits
- Native exit inference needs all transitions

---

## Logging Behavior

### Native Layer Logs

```bash
adb logcat -s ForegroundDetection:I
```

**Output:**
```
ForegroundDetection: 📱 Foreground app changed: com.instagram.android
ForegroundDetection: 📱 Foreground app changed: com.hihonor.android.launcher
ForegroundDetection: 📱 Foreground app changed: com.youtube.android
```

**All apps logged** - no filtering at native level.

### JS Layer Logs

**Production (non-DEV):**
```
[OS Trigger Brain] App entered foreground: {"packageName":"com.instagram.android",...}
[OS Trigger Brain] App entered foreground: {"packageName":"com.youtube.android",...}
```

**Launchers NOT logged** in production - silent filtering.

**Development (__DEV__):**
```
[OS Trigger Brain] App entered foreground: {"packageName":"com.instagram.android",...}
[OS Trigger Brain] Launcher event ignored for semantics: {"packageName":"com.hihonor.android.launcher",...}
[OS Trigger Brain] App entered foreground: {"packageName":"com.youtube.android",...}
```

**Launchers logged in DEV** - helps debugging.

---

## Testing

### Test 1: Launcher Filtering

**Steps:**
1. Open Instagram
2. Press Home
3. Open YouTube

**Verify:**
```typescript
// Native logs show all 3 events
📱 com.instagram.android
📱 com.hihonor.android.launcher
📱 com.youtube.android

// JS logs (DEV) show filtering
[OS Trigger Brain] App entered foreground: Instagram
[OS Trigger Brain] Launcher event ignored for semantics: Launcher
[OS Trigger Brain] App entered foreground: YouTube

// State checks
getCurrentForegroundApp() === 'com.youtube.android'
getCurrentMeaningfulApp() === 'com.youtube.android'
```

### Test 2: App Switch Interval

**Steps:**
1. Open Instagram (monitored)
2. Exit to launcher (wait 1s)
3. Open Instagram again

**Verify:**
```
[OS Trigger Brain] Re-entry within app switch interval — no intervention
  timeSinceExitMs: 1000
  intervalMs: 30000
```

**Key:** Interval calculated from Instagram exit, NOT from launcher entry.

### Test 3: Rapid Transitions

**Steps:**
1. Open Instagram
2. Immediately switch to YouTube (via recent apps)

**Verify:**
- Only 2-3 native events (Instagram, maybe launcher, YouTube)
- Only 2 meaningful transitions (Instagram → YouTube)
- No intervention spam from launcher bounces

---

## Migration Notes

### Breaking Changes

**None.** This is a pure refactoring with identical external behavior.

### Internal API Changes

**Added:**
```typescript
export function getCurrentMeaningfulApp(): string | null;
```

**Updated:**
```typescript
export function resetTrackingState(): void {
  // Now clears both raw and meaningful tracking
}
```

### Compatibility

- ✅ Existing intervention logic unchanged
- ✅ Timer behavior unchanged
- ✅ App switch interval logic unchanged
- ✅ Only **where** filtering happens changed, not **what** is filtered

---

## Future Enhancements

### Easy to Add More Semantic Filters

```typescript
// System dialogs
const SYSTEM_DIALOGS = new Set([
  'com.android.systemui',
  'com.android.permissioncontroller',
]);

// Transient overlays
const TRANSIENT_APPS = new Set([
  'com.android.incallui',  // Phone call UI
]);

function isMeaningfulApp(packageName: string): boolean {
  if (isLauncher(packageName)) return false;
  if (SYSTEM_DIALOGS.has(packageName)) return false;
  if (TRANSIENT_APPS.has(packageName)) return false;
  return true;
}
```

### Platform-Specific Filtering

```typescript
if (Platform.OS === 'ios') {
  if (isSpringBoard(packageName)) return;  // iOS launcher
}
```

### Dynamic Launcher Detection

```typescript
// Query installed launchers at runtime
async function detectInstalledLaunchers(): Promise<Set<string>> {
  const launchers = await NativeLauncher.getInstalledLaunchers();
  return new Set(launchers);
}
```

---

## Summary

**What moved:**
- Launcher filtering logic: Native → JS
- Launcher package list: Kotlin → TypeScript

**Why it moved:**
- Business logic belongs in business layer
- Easier maintenance and testing
- Platform independence
- Better separation of concerns

**Impact:**
- ✅ Native reports raw OS events (simpler, focused)
- ✅ JS handles semantics (flexible, testable)
- ✅ Identical user-facing behavior
- ✅ Better foundation for multi-platform support

**Trade-offs:**
- Slightly more events cross native→JS boundary (includes launchers)
- More complex state tracking in JS (dual tracking)
- **But:** Better architecture, easier to maintain, more testable

---

## References

- Native implementation: `android/app/src/main/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
- JS implementation: `src/os/osTriggerBrain.ts`
- Config: `src/os/osConfig.ts`

