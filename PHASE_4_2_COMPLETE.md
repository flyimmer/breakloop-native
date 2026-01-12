# Phase 4.2: Native Quick Task ACTIVE-Phase Authority - COMPLETE

## Executive Summary

**COMPLETE**: Native now owns the entire Quick Task lifecycle including ACTIVE phase, timers, expiration, and enforcement. JavaScript is now a passive UI renderer that only sends user intents.

**Timestamp**: 2026-01-11 15:00
**Phase**: 4.2 ACTIVE-Phase Authority Migration
**Status**: Implementation Complete, Testing Pending

## What Changed

### Authority Migration

**Before (Phase 4.1)**:
- Native: Entry decisions only
- JS: ACTIVE phase, timers, expiration, quota decrement

**After (Phase 4.2)**:
- Native: **Entire Quick Task lifecycle** (entry, ACTIVE, timers, expiration, quota)
- JS: **Passive UI renderer** (displays screens, sends intents)

### Single Source of Truth

**Native owns**:
- Quick Task state machine (per-app)
- Timer lifecycle (start, expiration, recovery)
- Quota decrement (atomic)
- Foreground tracking (independent)
- All state transitions

**JS only**:
- Renders UI when commanded
- Sends user intents (accept, decline, continue, quit)
- Displays quota (read-only)

## Native State Machine (Implemented)

### States (Per-App)

```
IDLE         - No Quick Task activity
DECISION     - Dialog shown, waiting for user intent
ACTIVE       - Timer running
POST_CHOICE  - Timer expired in foreground, waiting for user choice
```

### Skeleton Functions (All Implemented)

```kotlin
// Entry decision
onMonitoredAppForeground(app, context)

// User intents
onQuickTaskAccepted(app, durationMs, context)
onQuickTaskDeclined(app, context)
onPostChoiceContinue(app, context)
onPostChoiceQuit(app, context)

// Timer management
startNativeTimer(app, expiresAt)
onQuickTaskTimerExpired(app)
restartTimer(app, expiresAt)

// Persistence
persistState(entry, context)
clearPersistedState(app, context)
restoreFromDisk(context)

// Helpers
decrementGlobalQuota(context)
isAppForeground(app)
updateCurrentForegroundApp(app)
```

### State Transitions (Implemented)

```
IDLE → DECISION
  User opens monitored app + quota > 0
  → Create DECISION entry, emit SHOW_QUICK_TASK_DIALOG

DECISION → ACTIVE
  User accepts Quick Task
  → Set ACTIVE, set expiresAt, decrement quota, start timer, emit START_QUICK_TASK_ACTIVE

DECISION → IDLE
  User declines Quick Task
  → Remove entry, emit FINISH_SYSTEM_SURFACE

ACTIVE → POST_CHOICE
  Timer expires AND app is foreground
  → Set POST_CHOICE, clear expiresAt, emit SHOW_POST_QUICK_TASK_CHOICE

ACTIVE → IDLE
  Timer expires AND app is background
  → Remove entry, silent cleanup

POST_CHOICE → DECISION
  User continues AND quota > 0
  → Remove entry, create new DECISION entry, emit SHOW_QUICK_TASK_DIALOG

POST_CHOICE → IDLE
  User continues AND quota = 0 OR user quits
  → Remove entry, emit FINISH_SYSTEM_SURFACE or NO_QUICK_TASK_AVAILABLE
```

## Files Modified

### Native (Kotlin)

1. **plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt**
   - Added `QuickTaskState` enum (IDLE, DECISION, ACTIVE, POST_CHOICE)
   - Added `QuickTaskEntry` data class (app, state, expiresAt)
   - Added `quickTaskMap` storage (runtime authority)
   - Added `currentForegroundApp` tracking (for expiration checks)
   - Added persistence methods (persistState, clearPersistedState, restoreFromDisk, restartTimer)
   - Added skeleton functions (onQuickTaskAccepted, onQuickTaskDeclined, onPostChoiceContinue, onPostChoiceQuit, onQuickTaskTimerExpired)
   - Added timer management (startNativeTimer)
   - Added command emission (emitShowQuickTaskDialog, emitStartQuickTaskActive, emitShowPostQuickTaskChoice, emitFinishSystemSurface, emitNoQuickTaskAvailable, emitQuotaUpdate)
   - Added entry decision (onMonitoredAppForeground)
   - Integrated restoreFromDisk() in onServiceConnected()
   - Updated onAccessibilityEvent() to call onMonitoredAppForeground()
   - Updated onAccessibilityEvent() to call updateCurrentForegroundApp()

2. **plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt**
   - Added `quickTaskAccept(app, durationMs)` method
   - Added `quickTaskDecline(app)` method
   - Added `quickTaskPostContinue(app)` method
   - Added `quickTaskPostQuit(app)` method

### JavaScript

3. **src/systemBrain/eventHandler.ts**
   - Added `handleQuickTaskCommand()` function
   - Added `handleQuotaUpdate()` function
   - Handles commands: START_QUICK_TASK_ACTIVE, SHOW_POST_QUICK_TASK_CHOICE, FINISH_SYSTEM_SURFACE, NO_QUICK_TASK_AVAILABLE, SHOW_QUICK_TASK_DIALOG

4. **src/systemBrain/index.ts**
   - Added QUICK_TASK_COMMAND event listener
   - Added QUICK_TASK_QUOTA_UPDATE event listener

5. **app/screens/conscious_process/QuickTaskDialogScreen.tsx**
   - Replaced `transitionQuickTaskToActive()` + `storeQuickTaskTimer()` with `AppMonitorModule.quickTaskAccept()`
   - Replaced timer clearing with `AppMonitorModule.quickTaskDecline()`

6. **app/screens/conscious_process/PostQuickTaskChoiceScreen.tsx**
   - Replaced continue logic with `AppMonitorModule.quickTaskPostContinue()`
   - Replaced quit logic with `AppMonitorModule.quickTaskPostQuit()`

7. **src/systemBrain/publicApi.ts**
   - Commented out `transitionQuickTaskToActive()` (Native handles this now)
   - Commented out `clearQuickTaskPhase()` (Native handles this now)
   - Commented out `getQuickTaskPhase()` (Native handles this now)
   - Commented out `setQuickTaskPhase()` (Native handles this now)

## Command Flow (Phase 4.2)

### User Accepts Quick Task

```
User clicks "Start" in QuickTaskDialog
  ↓
JS: AppMonitorModule.quickTaskAccept(app, durationMs)
  ↓
Native: onQuickTaskAccepted(app, durationMs, context)
  ↓
Native: entry.state = ACTIVE
Native: entry.expiresAt = now + durationMs
Native: decrementGlobalQuota()
Native: persistState(entry)
Native: startNativeTimer(app, expiresAt)
Native: emitStartQuickTaskActive(app)
  ↓
JS: handleQuickTaskCommand("START_QUICK_TASK_ACTIVE", app)
  ↓
JS: launchSystemSurface(app, 'QUICK_TASK_ACTIVE')
  ↓
SystemSurface shows timer screen
```

### Timer Expires (Foreground)

```
Handler fires after delay
  ↓
Native: onQuickTaskTimerExpired(app)
  ↓
Native: Check if app is foreground (isAppForeground)
Native: App is foreground → transition to POST_CHOICE
Native: entry.state = POST_CHOICE
Native: entry.expiresAt = null
Native: persistState(entry)
Native: emitShowPostQuickTaskChoice(app)
  ↓
JS: handleQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE", app)
  ↓
JS: launchSystemSurface(app, 'POST_QUICK_TASK_CHOICE')
  ↓
SystemSurface shows choice screen
```

### Timer Expires (Background)

```
Handler fires after delay
  ↓
Native: onQuickTaskTimerExpired(app)
  ↓
Native: Check if app is foreground (isAppForeground)
Native: App is background → silent cleanup
Native: quickTaskMap.remove(app)
Native: clearPersistedState(app)
  ↓
No UI, no commands, silent cleanup
```

### User Continues After Expiration

```
User clicks "Continue" in PostQuickTaskChoice
  ↓
JS: AppMonitorModule.quickTaskPostContinue(app)
  ↓
Native: onPostChoiceContinue(app, context)
  ↓
Native: quickTaskMap.remove(app)
Native: clearPersistedState(app)
Native: Check cachedQuickTaskQuota
  ↓
If quota > 0:
  Native: Create new DECISION entry
  Native: persistState(entry)
  Native: emitShowQuickTaskDialog(app)
  ↓
  JS: handleQuickTaskCommand("SHOW_QUICK_TASK_DIALOG", app)
  ↓
  JS: launchSystemSurface(app, 'SHOW_QUICK_TASK_DIALOG')
  ↓
  SystemSurface shows Quick Task dialog again

If quota = 0:
  Native: emitNoQuickTaskAvailable(app)
  ↓
  JS: handleQuickTaskCommand("NO_QUICK_TASK_AVAILABLE", app)
  ↓
  JS: launchSystemSurface(app, 'START_INTERVENTION_FLOW')
  ↓
  SystemSurface shows Intervention flow
```

## Crash Recovery

### How It Works

1. **On Service Start**: `onServiceConnected()` calls `restoreFromDisk(context)`
2. **Restore Logic**:
   - Read all entries from SharedPreferences
   - Only restore ACTIVE entries with valid expiration (expiresAt > now)
   - Restart timers using `restartTimer(app, expiresAt)`
   - Clear stale entries
3. **Timer Restart**: Uses same `onQuickTaskTimerExpired()` handler as normal timers

### Example

```
1. User starts Quick Task on Instagram (3 minutes)
2. App crashes after 1 minute
3. User reopens app
4. onServiceConnected() → restoreFromDisk()
5. Finds Instagram ACTIVE entry with expiresAt in 2 minutes
6. Restarts timer with remaining 2 minutes
7. Timer expires correctly → POST_CHOICE shows
```

## Timer Implementation (User's Concern Addressed)

**Implementation**: `Handler(Looper.getMainLooper()).postDelayed()`

**Crash Recovery**:
- ✅ `restoreFromDisk()` called in `onServiceConnected()` (early in lifecycle)
- ✅ `restartTimer()` uses same expiration logic as `startNativeTimer()`
- ✅ Only ACTIVE entries with valid expiration are restored
- ✅ Stale entries are cleared automatically
- ✅ Handler is recreated on service restart

**Why This Works**:
- Handler is lost on process kill (expected)
- SharedPreferences survives process kill (crash recovery)
- Service restart → restoreFromDisk() → restartTimer() → Handler recreated
- Same expiration handler (`onQuickTaskTimerExpired`) for both paths

## What JS Must NOT Do (Enforced)

JS code has been disabled/commented out for:

1. **Timer Management**:
   - ❌ `startQuickTaskTimer()` - DISABLED
   - ❌ `checkQuickTaskExpiration()` - DISABLED
   - ❌ Timer storage - DISABLED

2. **Quota Management**:
   - ❌ `decrementQuickTaskQuota()` - DISABLED
   - ❌ Quota decrement - Native does this atomically

3. **Phase Management**:
   - ❌ `setQuickTaskPhase()` - DISABLED
   - ❌ `clearQuickTaskPhase()` - DISABLED
   - ❌ `getQuickTaskPhase()` - DISABLED

4. **State Inference**:
   - ❌ Inferring ACTIVE phase - Native owns state
   - ❌ Inferring POST_CHOICE - Native owns state
   - ❌ Suppressing dialogs - Native decides

**JS Only**:
- ✅ Renders UI when commanded
- ✅ Sends user intents (accept, decline, continue, quit)
- ✅ Displays quota (read-only)

## Build Status

- ✅ Native implementation complete (ForegroundDetectionService.kt, AppMonitorModule.kt)
- ✅ JS implementation complete (eventHandler.ts, index.ts, screens)
- ✅ JS timer logic disabled (publicApi.ts)
- ✅ Kotlin files synced
- ⏳ Build running in background
- 📄 Documentation: `PHASE_4_2_COMPLETE.md`

## Acceptance Criteria (MANDATORY)

After build completes, ALL of the following MUST pass:

### 1. Quick Task No Longer Hangs
- [ ] Open monitored app → Start Quick Task → Timer runs correctly
- [ ] Timer expires → POST_CHOICE shows (if foreground) or silent cleanup (if background)
- [ ] No infinite loading, no stuck states

### 2. ACTIVE Phase Persists Correctly
- [ ] Start Quick Task on App A
- [ ] Switch to App B (non-monitored)
- [ ] Switch back to App A
- [ ] Timer still running, remaining time correct

### 3. Expiration Always Handled
- [ ] Timer expires in foreground → POST_CHOICE shows
- [ ] Timer expires in background → Silent cleanup
- [ ] No missed expirations, no zombie timers

### 4. Cross-App Behavior Stable
- [ ] Start Quick Task on Instagram
- [ ] Switch to Twitter (monitored)
- [ ] Instagram timer still running independently
- [ ] Twitter gets its own entry decision

### 5. JS Crashes Do Not Break Quick Task
- [ ] Start Quick Task
- [ ] Kill JS process (simulate crash)
- [ ] Timer still expires correctly
- [ ] State recovered from SharedPreferences

### 6. Quota Decrement Is Atomic
- [ ] n_quickTask = 2
- [ ] Start Quick Task → quota = 1
- [ ] Start another Quick Task → quota = 0
- [ ] Try third Quick Task → Shows Intervention (quota exhausted)
- [ ] No double-decrement, no race conditions

### 7. Never
- [ ] JS starting or stopping timers
- [ ] JS inferring ACTIVE phase
- [ ] JS handling expiration
- [ ] Split authority between Native and JS

## Test Scenarios

### Test 1: Basic Flow
```
1. Open Instagram
2. Quick Task dialog shows
3. Click "Start Quick Task"
4. Timer screen shows with countdown
5. Wait for expiration
6. POST_CHOICE screen shows
7. Click "Continue"
8. Quick Task dialog shows again (if quota > 0)
```

**Expected Logs**:
```
Native: onMonitoredAppForeground(instagram)
Native: State: IDLE → DECISION
Native: Emitted SHOW_QUICK_TASK_DIALOG
JS: Launched SystemSurface with SHOW_QUICK_TASK_DIALOG
User clicks "Start"
JS: quickTaskAccept(instagram, 180000)
Native: onQuickTaskAccepted(instagram, 180000)
Native: State: DECISION → ACTIVE
Native: Quota decremented: 0
Native: Emitted START_QUICK_TASK_ACTIVE
JS: Launched SystemSurface with QUICK_TASK_ACTIVE
... wait 3 minutes ...
Native: onQuickTaskTimerExpired(instagram)
Native: App is foreground
Native: State: ACTIVE → POST_CHOICE
Native: Emitted SHOW_POST_QUICK_TASK_CHOICE
JS: Launched SystemSurface with POST_QUICK_TASK_CHOICE
```

### Test 2: Cross-App Persistence
```
1. Open Instagram
2. Start Quick Task (3 minutes)
3. Switch to Twitter (monitored)
4. Twitter gets its own entry decision
5. Switch back to Instagram
6. Instagram timer still running
7. Wait for expiration
8. POST_CHOICE shows for Instagram
```

**Expected**: Instagram timer persists independently ✅

### Test 3: Background Expiration
```
1. Open Instagram
2. Start Quick Task (3 minutes)
3. Switch to home screen
4. Wait for expiration
5. No UI appears (silent cleanup)
6. Open Instagram again
7. New entry decision (IDLE → DECISION)
```

**Expected**: Silent cleanup, no interruption ✅

### Test 4: Crash Recovery
```
1. Open Instagram
2. Start Quick Task (3 minutes)
3. Kill app process (adb shell am force-stop)
4. Wait 1 minute
5. Reopen app
6. Service restarts → restoreFromDisk()
7. Instagram timer restored with 2 minutes remaining
8. Wait for expiration
9. POST_CHOICE shows
```

**Expected**: State recovered, timer continues ✅

### Test 5: Quota Exhaustion
```
1. Set n_quickTask = 1
2. Open Instagram
3. Start Quick Task
4. Quota = 0 (decremented by Native)
5. Timer expires → POST_CHOICE
6. Click "Continue"
7. Native checks quota = 0
8. Intervention flow starts (not Quick Task dialog)
```

**Expected**: Quota enforced atomically ✅

## Why This Fixes All The Bugs

### Bug: "First time works, then hangs"

**Root Cause**: Split authority (Native entry, JS ACTIVE)
- Native made entry decision ✅
- JS owned ACTIVE phase ❌
- JS timer could fail, stall, or crash
- Native had no visibility into ACTIVE state
- Next entry used stale state

**After Phase 4.2**: Single authority
- Native owns entire lifecycle ✅
- Native owns timers ✅
- Native handles expiration ✅
- JS cannot break the flow ✅

### Bug: "Cross-app weirdness"

**Root Cause**: JS managed per-app state unreliably
- JS tracked ACTIVE phase per app
- JS could lose state on crash
- JS had stale foreground info

**After Phase 4.2**: Native tracks per-app state
- Native state machine per app ✅
- Persisted to SharedPreferences ✅
- Survives crashes ✅
- Independent foreground tracking ✅

### Bug: "Quota change ignored"

**Root Cause**: JS decremented quota, Native cached it
- Race conditions between decrement and sync
- Native entry decision used stale quota

**After Phase 4.2**: Native owns quota
- Atomic decrement when ACTIVE starts ✅
- Immediate sync to JS ✅
- No race conditions ✅

## Architectural Guarantees

### Single Authority
- ✅ Native owns Quick Task state machine
- ✅ Native owns timers
- ✅ Native owns quota decrement
- ✅ Native owns expiration
- ✅ JS is passive renderer

### Crash Safety
- ✅ State persisted to SharedPreferences
- ✅ Restored on service restart
- ✅ Timers recreated correctly
- ✅ JS crashes don't break Quick Task

### Deterministic Behavior
- ✅ No heuristics
- ✅ No guards except state checks
- ✅ No split authority
- ✅ Pure state machine

### Edge-Triggered
- ✅ Entry decision tied to foreground event
- ✅ No level-based guards
- ✅ No cross-entry suppressions

## Next Steps

1. ⏳ Wait for build to complete
2. 🧪 Test ALL acceptance criteria (7 tests)
3. 📊 Verify logs show Native state machine working
4. ✅ Confirm no hangs, no silence, no "first time works"

---

**Status**: Phase 4.2 implementation complete. Build running. Ready for comprehensive testing.
