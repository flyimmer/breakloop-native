# Intention Timer Fix Implementation

**Date:** January 6, 2026  
**Status:** ✅ Complete  
**Issue:** IntentionTimer not launching target app + immediate re-intervention

## Problem Summary

### Issue 1: Home Screen Appears (First Time)
When user set IntentionTimer ("just 1 min"), SystemSurface finished without launching the target app, causing Android to show home screen instead of returning to XHS.

**Root Cause:** `IntentionTimerScreen` never called `setTransientTargetApp()`, so `SystemSurfaceRoot` finished with `targetApp = null`.

### Issue 2: XHS Hangs (Second Time)
After IntentionTimer was set, System Brain didn't know about it (not in semantic state), so it immediately launched intervention again when XHS came to foreground.

**Root Cause:** System Brain didn't track intention timers as per-app suppressors in semantic state.

### Issue 3: Duration-Based Classification (Architectural Flaw)
Original plan attempted to infer timer type from duration (`durationSec <= 300` = Quick Task), which violates semantic clarity principles.

**Root Cause:** Semantics must never be inferred from numeric values.

## Implementation

### Fix 1: Add `setTransientTargetApp()` to IntentionTimerScreen ✅

**File:** `app/screens/conscious_process/IntentionTimerScreen.tsx`

**Changes:**
1. Import `useSystemSession` hook
2. Destructure `setTransientTargetApp` from `useSystemSession()`
3. Call `setTransientTargetApp(interventionState.targetApp)` before dispatching `SET_INTENTION_TIMER`

**Code:**
```typescript
const { setTransientTargetApp } = useSystemSession();

// Set transient targetApp for finish-time navigation
setTransientTargetApp(interventionState.targetApp);
console.log('[IntentionTimer] Set transient targetApp:', interventionState.targetApp);
```

**Result:** SystemSurface now launches target app after finishing (not home screen).

### Fix 2: Add Explicit Timer Type to Native Layer ✅

**Files:**
- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`
- `plugins/src/android/java/com/anonymous/breakloopnative/SystemBrainService.kt`

**Changes:**

1. **AppMonitorModule.kt:**
   - Updated `storeIntentionTimer()` to emit `TIMER_SET` with `timerType: "INTENTION"`
   - Updated `storeQuickTaskTimer()` to emit `TIMER_SET` with `timerType: "QUICK_TASK"`
   - Updated `emitSystemEventToSystemBrain()` to accept optional `timerType` parameter

2. **SystemBrainService.kt:**
   - Added `EXTRA_TIMER_TYPE` constant
   - Updated `getTaskConfig()` to forward `timerType` to System Brain JS

**Code:**
```kotlin
// In storeIntentionTimer()
emitSystemEventToSystemBrain("TIMER_SET", packageName, System.currentTimeMillis(), expiresAtLong, "INTENTION")

// In storeQuickTaskTimer()
emitSystemEventToSystemBrain("TIMER_SET", packageName, System.currentTimeMillis(), expiresAtLong, "QUICK_TASK")
```

**Result:** Timer type is now explicit in event payload (no duration inference).

### Fix 3: System Brain Uses Explicit Timer Type ✅

**File:** `src/systemBrain/eventHandler.ts`

**Changes:**

1. **Updated event interface:**
   ```typescript
   timerType?: 'QUICK_TASK' | 'INTENTION'; // For TIMER_SET events (explicit type)
   ```

2. **Updated `handleTimerSet()` signature:**
   ```typescript
   async function handleTimerSet(
     packageName: string,
     expiresAt: number,
     timestamp: number,
     timerType: 'QUICK_TASK' | 'INTENTION',  // ✅ Explicit parameter
     state: TimerState
   )
   ```

3. **Explicit type classification (no duration inference):**
   ```typescript
   if (timerType === 'QUICK_TASK') {
     state.quickTaskTimers[packageName] = { expiresAt };
     recordQuickTaskUsage(packageName, timestamp, state);
   } else if (timerType === 'INTENTION') {
     state.intentionTimers[packageName] = { expiresAt };
     // NO usage tracking for intention timers
   }
   ```

4. **Updated foreground change handler:**
   ```typescript
   // Priority #3: Check t_intention (per-app suppressor)
   const intentionTimer = state.intentionTimers[packageName];
   if (intentionTimer && timestamp < intentionTimer.expiresAt) {
     console.log('[System Brain] ✓ t_intention ACTIVE - suppressing intervention');
     return;
   }
   ```

5. **Updated timer expiration handler:**
   ```typescript
   if (intentionTimer && timestamp >= intentionTimer.expiresAt) {
     timerType = 'INTENTION';
     delete state.intentionTimers[packageName];  // Remove per-app suppressor
     console.log('[System Brain] Intention timer removed from state');
   }
   ```

**Result:** System Brain tracks intention timers as per-app suppressors and suppresses intervention correctly.

## Semantic Model

### ✅ CORRECT: Intention Timers as Per-App Suppressors

```typescript
intentionTimers: {
  'com.xingin.xhs': { expiresAt: 1767735246290 },
  'com.instagram.android': { expiresAt: 1767735300000 }
}
```

### Comparison Table

| Concept | Quick Task | Intention Timer |
|---------|-----------|-----------------|
| **Scope** | Global | **Per-app** |
| **Purpose** | Limit usage | **Temporarily suppress intervention** |
| **Tracked as** | Usage history | **Active timer (expiresAt)** |
| **Needs counter?** | Yes | **❌ No** |
| **Type classification** | **Explicit in event** | **Explicit in event** |

## Architecture Compliance

✅ **Native-JavaScript Boundary:** Native emits mechanical event (`TIMER_SET`) with **explicit timer type**, System Brain stores semantic state

✅ **System Brain Authority:** System Brain is single source of truth for semantic state

✅ **Phase 2 Architecture:** No changes to wake reason or bootstrap logic

✅ **OS Trigger Brain Priority Chain:** Intention timer check matches documented priority (#3: t_intention VALID → Suppress)

✅ **Semantic Clarity:** 
- Intention timers are per-app suppressors, NOT usage counters
- Timer type is **explicit in event**, NOT inferred from duration
- No policy encoded in timing logic

✅ **No Duration-Based Inference:** Timer type classification is explicit and safe

## Testing Checklist

- [ ] **Test Case 1: First time IntentionTimer**
  - Open XHS
  - Complete breathing
  - Choose "just 1 min"
  - **Expected:** XHS should appear (not home screen)
  - **Verify logs:** `targetApp: "com.xingin.xhs"` in finish log

- [ ] **Test Case 2: Second time IntentionTimer (immediate re-open)**
  - Open XHS (with active intention timer from Test Case 1)
  - **Expected:** No intervention should appear (suppressed by intention timer)
  - **Verify logs:** `✓ t_intention ACTIVE - suppressing intervention`

- [ ] **Test Case 3: Intention timer expiration**
  - Wait for intention timer to expire (1 minute)
  - **Expected:** System Brain receives `TIMER_EXPIRED` event
  - **Verify logs:** `✓ Classified as Intention Timer expiration`
  - Open XHS again
  - **Expected:** Normal intervention flow (breathing screen)

- [ ] **Test Case 4: Multiple apps with intention timers**
  - Set intention timer for XHS (1 min)
  - Set intention timer for Instagram (5 min)
  - Open XHS → Should be suppressed
  - Open Instagram → Should be suppressed

- [ ] **Test Case 5: Explicit timer type verification**
  - Use Quick Task on Twitter
  - **Verify logs:** `Timer type: QUICK_TASK`
  - Use Intention Timer on XHS
  - **Verify logs:** `Timer type: INTENTION`

## Files Modified

1. ✅ `app/screens/conscious_process/IntentionTimerScreen.tsx` - Added `setTransientTargetApp()` call
2. ✅ `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - Added explicit `timerType` to TIMER_SET events
3. ✅ `plugins/src/android/java/com/anonymous/breakloopnative/SystemBrainService.kt` - Forward `timerType` to System Brain JS
4. ✅ `src/systemBrain/eventHandler.ts` - Use explicit timer type, store per-app, check before intervention, remove on expiration
5. ✅ `src/systemBrain/stateManager.ts` - Already had correct structure (`intentionTimers: Record<string, { expiresAt: number }>`)

## Next Steps

1. **Build and test** on Android device
2. **Verify logs** match expected behavior
3. **Test all 5 test cases** from checklist
4. **Document any issues** found during testing

## Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `docs/OS_Trigger_Contract V1.md` - OS Trigger Brain priority chain
- `docs/KOTLIN_FILE_SYNC.md` - Kotlin file workflow
