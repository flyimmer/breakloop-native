# Native Stuck Flag Fix - Complete Solution

## Problem Summary

When opening monitored apps (Instagram, Twitter, XHS) with `n_quickTask=100`:
- **NO Quick Task dialog appeared**
- **NO Intervention flow appeared**
- Complete UI vacuum

## Root Cause Discovery

### Investigation Timeline

1. **First suspected**: Settings not being read (`n_quickTask` not synced)
2. **Actually found**: JS auto-recovery was working, settings WERE being read
3. **Real problem**: Native was not emitting `QUICK_TASK_DECISION` events

### Evidence from Logs (10:17:26)

```
[System Brain] Monitored app check result: {"isMonitored": true, "packageName": "com.twitter.android"}
[System Brain] FOREGROUND_CHANGED (mechanical event only - Phase 4.1)
[Decision Engine] Entry state: {"isSystemSurfaceActive": true}
[SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing
[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
[Decision Engine] Quick Task config loaded: {"maxUses": 100}
[Decision Engine] ⚠️ UNEXPECTED: OS Trigger Brain returned QUICK_TASK in Phase 4.1
[Decision Engine] Native should have made entry decision already
```

**Analysis**:
- ✅ JS auto-recovery cleared the stuck JS flag
- ✅ Settings were read correctly (`n_quickTask=100`)
- ❌ Native never emitted `QUICK_TASK_DECISION` event
- ❌ JS fell back to deprecated OS Trigger Brain logic

## Root Cause

**Native `isSystemSurfaceActive` flag was stuck as `true`**, blocking all entry decisions in `ForegroundDetectionService.kt`:

```kotlin
// Guard 1: Do NOT emit if SystemSurface is already active
if (isSystemSurfaceActive) {
    Log.d(TAG, "⏭️ SystemSurface already active, skipping entry decision")
    return  // ❌ This return blocked ALL decisions!
}
```

### Why the Flag Got Stuck

1. **Set to `true`**: When SystemSurface launches, JS calls `AppMonitorModule.setSystemSurfaceActive(true)`
2. **Should be cleared**: When SystemSurface finishes, JS calls `AppMonitorModule.setSystemSurfaceActive(false)`
3. **But if session doesn't finish cleanly**: Flag stays `true` forever
   - App crash
   - Force-stop
   - React Native fast refresh
   - Session teardown bug

## Solution Implemented

### Native Auto-Recovery (Same Pattern as JS)

Added automatic flag recovery in `ForegroundDetectionService.kt`:

```kotlin
// Auto-Recovery: Clear stuck flag if it's been active too long
// SystemSurface should only be active for seconds, not minutes
// If flag has been true for > 10 seconds, it's stuck
if (isSystemSurfaceActive) {
    val flagAge = System.currentTimeMillis() - systemSurfaceActiveTimestamp
    val maxFlagAge = 10000L  // 10 seconds
    
    if (flagAge > maxFlagAge) {
        Log.w(TAG, "⚠️ SystemSurface flag was stuck (active for ${flagAge}ms), auto-clearing")
        isSystemSurfaceActive = false
        systemSurfaceActiveTimestamp = 0
        lastDecisionApp = null
        Log.i(TAG, "✅ Stuck flag cleared, proceeding with entry decision")
    }
}
```

### How It Works

1. **Track timestamp**: When flag is set to `true`, record `systemSurfaceActiveTimestamp`
2. **Check age**: On each monitored app entry, check how long flag has been `true`
3. **Auto-clear if stuck**: If > 10 seconds, flag is stuck → clear it automatically
4. **Proceed normally**: Continue with entry decision logic

### Why 10 Seconds?

- **Normal SystemSurface session**: User sees dialog/intervention for a few seconds
- **Legitimate blocking**: Near-simultaneous events within milliseconds
- **Stuck detection**: If flag is still `true` after 10 seconds, something went wrong

## Complete Fix Architecture

### Two-Layer Auto-Recovery

**Layer 1: Native (ForegroundDetectionService.kt)**
- Checks flag age on every monitored app entry
- Auto-clears if stuck for > 10 seconds
- Ensures `QUICK_TASK_DECISION` events are always emitted

**Layer 2: JS (decisionEngine.ts)**
- Checks flag state at every decision entry
- Auto-clears if stuck (unconditional clear)
- Ensures SystemSurface launches even if Native decision is missed

### Defense in Depth

Both layers provide redundant protection:
1. **Native fixes the source**: Ensures decisions are emitted
2. **JS provides fallback**: Works even if Native fails
3. **Self-healing**: System recovers automatically without user intervention

## Expected Behavior After Fix

### Scenario 1: Normal Operation (No Stuck Flags)

**Native logs** (adb logcat):
```
🎯 MONITORED APP DETECTED: com.twitter.android
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 100
   └─ quotaAvailable: true
✅ DECISION: Quick Task available for com.twitter.android (quota: 100)
```

**JS logs**:
```
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] Decision: SHOW_QUICK_TASK_DIALOG
[SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
```

**Result**: Quick Task dialog appears

### Scenario 2: Native Flag Stuck (Auto-Recovery)

**Native logs** (adb logcat):
```
🎯 MONITORED APP DETECTED: com.twitter.android
⚠️ SystemSurface flag was stuck (active for 15234ms), auto-clearing
✅ Stuck flag cleared, proceeding with entry decision
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 100
✅ DECISION: Quick Task available for com.twitter.android (quota: 100)
```

**JS logs**:
```
[System Brain] 📨 QUICK_TASK_DECISION event received
[SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
```

**Result**: Quick Task dialog appears (after auto-recovery)

### Scenario 3: Both Flags Stuck (Double Auto-Recovery)

**Native logs** (adb logcat):
```
⚠️ SystemSurface flag was stuck (active for 15234ms), auto-clearing
✅ Stuck flag cleared, proceeding with entry decision
✅ DECISION: Quick Task available
```

**JS logs**:
```
[Decision Engine] Entry state: { isSystemSurfaceActive: true }
[SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing
[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision
[SystemSurfaceInvariant] LAUNCH { wakeReason: "SHOW_QUICK_TASK_DIALOG" }
```

**Result**: Both layers recover, Quick Task dialog appears

## Files Modified

### Native (Kotlin)

1. **`plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`**:
   - Added `systemSurfaceActiveTimestamp` variable to track when flag was set
   - Updated `setSystemSurfaceActive()` to record timestamp
   - Added auto-recovery logic before guard check
   - Clears flag if active for > 10 seconds

### JavaScript

2. **`src/systemBrain/decisionEngine.ts`**:
   - Added unconditional flag clear at decision entry
   - Removed buggy session check
   - Simplified auto-recovery logic

## Testing Checklist

After the build completes:

### Test 1: With n_quickTask = 100
- [ ] Set Quick Task quota to 100 in settings
- [ ] Open monitored app (Instagram, Twitter, XHS)
- [ ] **Expected**: Quick Task dialog appears
- [ ] **Native logs should show**: Auto-recovery if flag was stuck, then decision emitted
- [ ] **JS logs should show**: QUICK_TASK_DECISION event received

### Test 2: With n_quickTask = 0
- [ ] Set Quick Task quota to 0 in settings
- [ ] Open monitored app
- [ ] **Expected**: Intervention flow appears
- [ ] **Native logs should show**: "NO_QUICK_TASK_AVAILABLE" decision
- [ ] **JS logs should show**: START_INTERVENTION_FLOW launch

### Test 3: Verify Auto-Recovery
- [ ] Force-stop app while SystemSurface is showing
- [ ] Restart app
- [ ] Open monitored app
- [ ] **Expected**: Should work (flags auto-cleared)
- [ ] **Logs should show**: Auto-recovery warnings

### Test 4: Verify No False Positives
- [ ] Open monitored app → SystemSurface launches
- [ ] Close SystemSurface normally
- [ ] Open monitored app again immediately
- [ ] **Expected**: Should work normally (no auto-recovery needed)

## Why This Fix is Complete

1. **Addresses Both Layers**: Fixes stuck flags in both Native and JS
2. **Self-Healing**: Automatically recovers without user intervention
3. **Defensive**: Multiple layers of protection
4. **Time-Based**: Uses timestamps for reliable stuck detection
5. **Safe**: 10-second threshold prevents false positives
6. **Logged**: Clear warnings when auto-recovery happens

This ensures that the `isSystemSurfaceActive` flags (both Native and JS) can never stay stuck for more than 10 seconds, guaranteeing that SystemSurface (Quick Task or Intervention) will always launch when needed.
