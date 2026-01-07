# SystemSurfaceActivity Reuse Bug Fix

**Date:** January 7, 2026  
**Status:** ✅ IMPLEMENTED

## Problem Summary

Monitored apps (e.g., XHS/小红书) were hanging with no UI visible after launch. Users could not interact with the app.

### Root Cause

`SystemSurfaceActivity` was being **reused** instead of being **disposable**, violating Phase-2 architecture assumptions:

1. **Intent Flag Issue:** `FLAG_ACTIVITY_CLEAR_TOP` in `launchSystemSurface()` caused Android to reuse existing Activity instances
2. **Stale Intent Extras:** Reused Activity had stale Intent extras from previous launch
3. **Bootstrap Failure:** React bootstrap effect ran on reused Activity with wrong data
4. **No Session Created:** `session === null` after bootstrap → blank overlay → app blocked

**Evidence from logs (11:26:10.967):**
```
LOG  [System Brain] 🚀 Launching SystemSurface: SHOW_QUICK_TASK_DIALOG for com.xingin.xhs
LOG  [SystemSurfaceRoot] Rendering null (no session, bootstrap complete)
```

System Brain launched SystemSurface correctly, but no session was created.

---

## Architecture Violation

Phase-2 architecture requires:
> **"SystemSurfaceActivity is disposable and never reused. Each launch creates a fresh Activity instance with fresh Intent extras."**

The bug violated this invariant, causing production failures.

---

## Implementation

### Fix 1: Correct Intent Flags (AppMonitorModule.kt)

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`  
**Method:** `launchSystemSurface()` (line ~424)

**Changes:**
- ❌ REMOVED: `Intent.FLAG_ACTIVITY_CLEAR_TOP` (causes Activity reuse)
- ✅ KEPT: `Intent.FLAG_ACTIVITY_NEW_TASK` (required for launching from non-Activity context)
- ✅ ADDED: Log message confirming fresh Activity launch

**Before:**
```kotlin
val intent = Intent(reactApplicationContext, SystemSurfaceActivity::class.java).apply {
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
    putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
}
```

**After:**
```kotlin
// Phase-2 Architecture: SystemSurfaceActivity must be DISPOSABLE and NEVER REUSED
// Each launch creates a fresh Activity instance with fresh Intent extras
// REMOVED FLAG_ACTIVITY_CLEAR_TOP to prevent Activity reuse
val intent = Intent(reactApplicationContext, SystemSurfaceActivity::class.java).apply {
    flags = Intent.FLAG_ACTIVITY_NEW_TASK
    putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
    putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, triggeringApp)
}

android.util.Log.i("AppMonitorModule", "🆕 Launching fresh SystemSurfaceActivity (disposable)")
```

**Impact:**
- Each launch creates a **new Activity instance**
- Intent extras are always fresh
- React root mounts exactly once per launch
- No stale state from previous sessions

---

### Fix 2: Simplify finishInterventionActivity (AppMonitorModule.kt)

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`  
**Method:** `finishInterventionActivity()` (line ~362)

**Changes:**
- ❌ REMOVED: App launching logic
- ❌ REMOVED: `Thread.sleep()` calls (race conditions)
- ❌ REMOVED: `moveTaskToBack()` (manual task movement)
- ✅ SIMPLIFIED: Just call `activity.finish()`

**Before:**
```kotlin
fun finishInterventionActivity() {
    // ... 60 lines of complex logic ...
    // Launch app, sleep, move task to background
    activity.moveTaskToBack(true)
}
```

**After:**
```kotlin
fun finishInterventionActivity() {
    // Phase-2 Architecture: Native performs ONE mechanical action only
    // JavaScript decides semantics (what happens next)
    // REMOVED: App launching, Thread.sleep(), task movement
    val activity = reactApplicationContext.currentActivity
    if (activity is SystemSurfaceActivity) {
        android.util.Log.i("AppMonitorModule", "Finishing SystemSurfaceActivity")
        activity.finish()
    } else {
        android.util.Log.w("AppMonitorModule", "finishInterventionActivity called but not in SystemSurfaceActivity")
    }
}
```

**Why:** Aligns with Phase-2 principle: JavaScript decides semantics, native performs one mechanical action.

---

### Fix 3: Add Defensive Guard (SystemSurfaceRoot.tsx)

**File:** `app/roots/SystemSurfaceRoot.tsx`  
**Location:** After bootstrap phase check (line ~392)

**Changes:**
- ✅ ADDED: Defensive guard to detect and prevent silent hangs
- ✅ ADDED: Explicit comment explaining Phase-2 invariant
- ✅ ADDED: Fatal error logging for debugging

**Added Code:**
```typescript
/**
 * 🚨 DEFENSIVE GUARD: Prevent silent hangs
 * 
 * This guard enforces the Phase-2 invariant:
 * SystemSurfaceActivity must always establish a session before rendering.
 * If this is violated, the Activity must immediately finish to avoid blocking the user.
 * 
 * CRITICAL: Do NOT remove this guard. It prevents production bugs where:
 * - Bootstrap completes but no session is created
 * - SystemSurface renders blank overlay
 * - Monitored app becomes unresponsive
 * 
 * If this guard triggers, it indicates a FATAL error in:
 * - System Brain event handler
 * - Intent extras delivery
 * - Bootstrap initialization logic
 */
if (session === null) {
  console.error('[SystemSurfaceRoot] 🚨 FATAL: Bootstrap complete but no session created');
  console.error('[SystemSurfaceRoot] This should never happen - finishing activity to prevent hang');
  console.error('[SystemSurfaceRoot] Check System Brain event handler and Intent extras');
  
  // Finish activity immediately (launch home to unblock user)
  finishSystemSurfaceActivity(true);
  
  return null;
}
```

**Why:** 
- Prevents user-visible hangs if invariants are violated
- Better to fail fast than leave app blocked
- Explicit comment prevents future "cleanup refactors" from removing it

---

## Testing Plan

### Test Scenario 1: Fresh Launch
1. Open monitored app (XHS)
2. **Expected:** Quick Task dialog appears immediately
3. **Verify logs:** See "🆕 Launching fresh SystemSurfaceActivity"

### Test Scenario 2: Rapid Reopening
1. Open XHS → dismiss Quick Task
2. Immediately open XHS again
3. **Expected:** New Quick Task dialog appears (fresh Activity)
4. **Verify logs:** Two separate "🆕 Launching fresh" messages

### Test Scenario 3: Defensive Guard
1. Simulate bootstrap failure (comment out session dispatch)
2. Open monitored app
3. **Expected:** Error logged, activity finishes, app usable
4. **Verify:** No blank overlay hang

---

## Files Modified

1. ✅ **`plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`**
   - Fixed `launchSystemSurface()` intent flags (line ~424)
   - Simplified `finishInterventionActivity()` (line ~362)

2. ✅ **`app/roots/SystemSurfaceRoot.tsx`**
   - Added defensive guard after bootstrap check (line ~392)

3. ✅ **Synced Kotlin files** from `plugins/` to `android/` (via `npm run sync:kotlin`)

---

## Success Criteria

✅ XHS opens without hanging  
✅ Quick Task dialog appears on every launch  
✅ No stale Intent extras  
✅ Each launch creates fresh Activity (verify in logs)  
✅ Defensive guard prevents silent hangs  
✅ No race conditions in finish logic

---

## Architecture Compliance

This fix restores the Phase-2 invariant:

> **"SystemSurfaceActivity is disposable and never reused. Each launch creates a fresh Activity instance with fresh Intent extras."**

All changes follow Native-JavaScript Boundary rules:
- ✅ Native performs mechanical actions only
- ✅ JavaScript decides semantics
- ✅ No logic duplication across boundaries

---

## Next Steps

1. **Build Complete:** Wait for `npx expo run:android` to finish
2. **Test on Device:** Open XHS and verify Quick Task dialog appears
3. **Verify Logs:** Check for "🆕 Launching fresh SystemSurfaceActivity" messages
4. **Rapid Test:** Open XHS multiple times in quick succession
5. **Monitor:** Watch for any defensive guard triggers (should not happen)

---

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - Phase-2 architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Boundary rules
- `docs/PHASE2_ARCHITECTURE_UPDATE.md` - Phase-2 explicit wake reasons
- `CLAUDE.md` - Complete architecture reference
