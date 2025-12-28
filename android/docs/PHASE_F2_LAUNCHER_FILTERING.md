# Phase F2: Launcher Event Filtering

## Overview

Phase F2 extends the AccessibilityService to **suppress launcher events**, preventing false "app switch" detections that occur during app transitions on OEM devices.

## Problem Statement

### The Launcher Bounce Issue

On some OEM Android devices (particularly Huawei/Honor, Xiaomi MIUI, Samsung One UI), the launcher briefly regains focus during app transitions:

**Example Sequence Without Filtering:**
```
1. User opens Instagram from home screen
2. Launcher regains focus for ~100ms (OEM behavior)
3. Instagram takes full foreground

Detected sequence: Instagram → Launcher → Instagram
```

**This creates two problems:**
1. **False app switches** - The system thinks the user returned to the launcher
2. **Stuck on launcher** - If the bounce happens after the real app, the "current foreground app" becomes the launcher even though the user sees Instagram

### Why This Happens

OEM launchers implement custom animations and window management that causes them to temporarily regain focus during transitions. This is OS-level behavior that cannot be prevented, only filtered.

---

## Solution: Launcher Filtering

### Implementation

**Location:** `ForegroundDetectionService.kt`

**Key Changes:**

1. **Launcher Package List** (13 launchers covered):
```kotlin
private val LAUNCHER_PACKAGES = setOf(
    "com.android.launcher",           // AOSP
    "com.android.launcher3",          // Pixel
    "com.google.android.launcher",    // Google
    "com.hihonor.android.launcher",   // Honor ← User's device
    "com.huawei.android.launcher",    // Huawei
    "com.miui.home",                  // Xiaomi MIUI
    "com.samsung.android.app.launcher", // Samsung One UI
    "com.oppo.launcher",              // OPPO ColorOS
    "com.vivo.launcher",              // Vivo
    "com.oneplus.launcher",           // OnePlus
    "com.teslacoilsw.launcher",       // Nova Launcher
    "com.microsoft.launcher",         // Microsoft Launcher
    "com.actionlauncher.playstore"    // Action Launcher
)
```

2. **Filtering Logic** (in `onAccessibilityEvent`):
```kotlin
// Extract package name
val packageName = event.packageName?.toString()

// Filter out launchers
if (isLauncher(packageName)) {
    Log.d(TAG, "🏠 Launcher detected, ignoring: $packageName")
    return  // Do NOT update lastPackageName, do NOT emit event
}

// Existing normalization (duplicate suppression)
if (packageName == lastPackageName) {
    return
}

// Update and emit (only for non-launcher apps)
lastPackageName = packageName
Log.i(TAG, "📱 Foreground app changed: $packageName")
```

### Filtering Rules

| Event | Action | Reason |
|-------|--------|--------|
| Launcher detected | **IGNORE** | Not a real user-initiated app switch |
| Duplicate package | **IGNORE** | Existing normalization (unchanged) |
| New non-launcher app | **EMIT** | Real foreground change |

---

## Behavior Changes

### Before Phase F2

**User Action:** Opens Instagram from home screen

**Detected Events:**
```
📱 Foreground app changed: com.instagram.android
📱 Foreground app changed: com.hihonor.android.launcher  ← False positive
📱 Foreground app changed: com.instagram.android
```

**Current Foreground:** `com.hihonor.android.launcher` (incorrect!)

### After Phase F2

**User Action:** Opens Instagram from home screen

**Detected Events:**
```
📱 Foreground app changed: com.instagram.android
🏠 Launcher detected, ignoring: com.hihonor.android.launcher  ← Filtered
```

**Current Foreground:** `com.instagram.android` ✅ (correct!)

---

## Testing Phase F2

### Test Setup

1. **Rebuild and reinstall:**
```bash
npm run android
```

2. **Monitor logs with launcher filtering visible:**
```bash
adb logcat -s ForegroundDetection:*
```

This shows both 📱 (app changes) and 🏠 (launcher ignored) events.

### Test Cases

#### Test 1: Basic Launcher Filtering
**Steps:**
1. Open Instagram
2. Press home button
3. Open YouTube

**Expected Output:**
```
📱 Foreground app changed: com.instagram.android
🏠 Launcher detected, ignoring: com.hihonor.android.launcher
📱 Foreground app changed: com.youtube.android
```

**Verify:** No 📱 for launcher, only 🏠

#### Test 2: Launcher Bounce During App Launch
**Steps:**
1. Close all apps
2. Open Instagram from home screen
3. Wait 2 seconds

**Expected Output (OEM devices):**
```
📱 Foreground app changed: com.instagram.android
🏠 Launcher detected, ignoring: com.hihonor.android.launcher
```

**Verify:** Instagram remains current foreground (no second 📱 for Instagram)

#### Test 3: Rapid App Switching
**Steps:**
1. Open Instagram
2. Quickly open YouTube (via recent apps)
3. Quickly open Chrome

**Expected Output:**
```
📱 Foreground app changed: com.instagram.android
📱 Foreground app changed: com.youtube.android
📱 Foreground app changed: com.android.chrome
```

**Verify:** No launcher events, clean app transitions

#### Test 4: Long Press Home (Recent Apps)
**Steps:**
1. Open Instagram
2. Open recent apps menu
3. Select YouTube

**Expected Output:**
```
📱 Foreground app changed: com.instagram.android
🏠 Launcher detected, ignoring: com.hihonor.android.launcher
📱 Foreground app changed: com.youtube.android
```

**Verify:** Launcher event between apps is filtered

---

## Implementation Details

### Why Set<String> for Launcher Packages

```kotlin
private val LAUNCHER_PACKAGES = setOf(...)
```

- **Fast lookup:** O(1) contains check
- **Immutable:** Set is read-only, thread-safe
- **Clear intent:** Explicitly declares this is a collection of unique values

### Why Check Happens Before Duplicate Check

**Order matters:**

```kotlin
// 1. Filter launchers first
if (isLauncher(packageName)) return

// 2. Then check duplicates
if (packageName == lastPackageName) return

// 3. Update and emit
lastPackageName = packageName
```

**Reason:** We never want `lastPackageName` to be a launcher. If we checked duplicates first, a launcher could become the "last package" and suppress the next real app.

**Example of wrong order:**
```
Instagram → Launcher (becomes lastPackageName) → Instagram (duplicate, ignored!)
```

**Correct order (current implementation):**
```
Instagram → Launcher (filtered, NOT stored) → Instagram (duplicate, ignored) ✅
```

### Debug Logging

**New log format:**
```
🏠 Launcher detected, ignoring: com.hihonor.android.launcher
```

- **🏠 emoji:** Clearly marks launcher events
- **"ignoring":** Explicitly states the action taken
- **Debug level:** Won't spam production logs (use `-s ForegroundDetection:I` to hide)

---

## Coverage

### Launchers Covered (13 total)

| OEM | Package Name | Coverage |
|-----|--------------|----------|
| AOSP | `com.android.launcher` | ✅ |
| Google Pixel | `com.android.launcher3` | ✅ |
| Google | `com.google.android.launcher` | ✅ |
| Honor | `com.hihonor.android.launcher` | ✅ (User's device) |
| Huawei | `com.huawei.android.launcher` | ✅ |
| Xiaomi | `com.miui.home` | ✅ |
| Samsung | `com.samsung.android.app.launcher` | ✅ |
| OPPO | `com.oppo.launcher` | ✅ |
| Vivo | `com.vivo.launcher` | ✅ |
| OnePlus | `com.oneplus.launcher` | ✅ |
| Nova | `com.teslacoilsw.launcher` | ✅ |
| Microsoft | `com.microsoft.launcher` | ✅ |
| Action | `com.actionlauncher.playstore` | ✅ |

### Adding New Launchers

If a new launcher needs to be added:

1. **Identify package name:**
```bash
adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'
```

2. **Add to set in `ForegroundDetectionService.kt`:**
```kotlin
private val LAUNCHER_PACKAGES = setOf(
    // ... existing launchers ...
    "com.newlauncher.package"  // New launcher
)
```

3. **Rebuild and test**

---

## Impact on Future Phases

### Phase F3: React Native Bridge
- Launcher filtering ensures JS only receives real app switches
- No changes needed to bridge implementation

### Phase F4: Monitored App Checking
- Launchers won't trigger monitored app checks
- Intervention logic remains clean

### Phase F5: Intervention Triggers
- Users won't see interventions for launcher "apps"
- UX stays focused on actual monitored apps

---

## Design Rationale

### Why Suppress Instead of Special-Case?

**Option 1: Treat launcher as special app**
```kotlin
if (isLauncher(packageName)) {
    lastPackageName = "LAUNCHER"
    emitLauncherEvent()
}
```
❌ Still creates false events, just labeled differently

**Option 2: Suppress completely (current)**
```kotlin
if (isLauncher(packageName)) {
    return  // Ignore entirely
}
```
✅ Reflects user perception - launcher isn't a "foreground app"

### Why Not Timer-Based Debouncing?

**Alternative approach:**
```kotlin
// Wait 500ms before emitting event
handler.postDelayed({ emitEvent() }, 500)
```

**Problems:**
- ❌ Adds artificial delay to real app switches
- ❌ Doesn't solve the problem, just hides it
- ❌ Increases complexity (timers, cancellation, etc.)
- ❌ Battery impact from timer management

**Launcher filtering:**
- ✅ Zero delay
- ✅ Solves root cause
- ✅ Simple, deterministic logic
- ✅ No battery impact

---

## Summary

**Phase F2 Complete ✅**

**What Changed:**
- ✅ Added launcher package set (13 launchers)
- ✅ Filter launchers in `onAccessibilityEvent`
- ✅ Debug logging for filtered events
- ✅ Comprehensive documentation

**What Didn't Change:**
- ✅ No timers or delays added
- ✅ Existing duplicate suppression unchanged
- ✅ No React Native changes
- ✅ No changes to service lifecycle

**Result:**
- Users see correct foreground app at all times
- No false "launcher" detections
- Clean event stream for future phases

**Next Steps:**
- Test on Honor device with Instagram/YouTube
- Verify 🏠 logs appear but 📱 does not for launchers
- Proceed to Phase F3 (React Native bridge) when ready

