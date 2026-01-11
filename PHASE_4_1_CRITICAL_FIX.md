# Phase 4.1 Critical Fix: Native Decision Authority

## Problem Summary

**Critical Blocker**: Quick Task dialog not appearing despite `n_quickTask = 100`.

**Root Causes Identified**:
1. **JS Deprecated Path Bug**: `USER_INTERACTION_FOREGROUND` handler was still calling Decision Engine, which evaluated Quick Task logic (deprecated in Phase 4.1)
2. **Native Emission Working**: Native WAS emitting `QUICK_TASK_DECISION` events, but JS deprecated path was running in parallel

## Evidence from Logs (11:47:16)

```
[11:47:16.889] [System Brain] USER_INTERACTION_FOREGROUND: com.xingin.xhs
[11:47:16.896] [System Brain] UI-safe boundary - calling decision engine
[11:47:16.899] [Decision Engine] Quick Task config loaded: {"maxUses": 100, "source": "quick_task_settings_v1"}
[11:47:16.899] [Decision Engine] Quick Task availability check (GLOBAL): {"maxUses": "100 (from user settings)", "recentUsagesGlobal": 0, "remaining": 100, "windowMinutes": 15}
[11:47:16.900] [Decision Engine] ✓ n_quickTask > 0 - decision: QUICK_TASK (DEPRECATED - should not reach here in Phase 4.1)
[11:47:16.900] [Decision Engine] ⚠️ UNEXPECTED: OS Trigger Brain returned QUICK_TASK in Phase 4.1
[11:47:16.901] [Decision Engine] Native should have made entry decision already
[11:47:16.901] [Decision Engine] This indicates a bug in Phase 4.1 migration
```

**Key Finding**: `n_quickTask` WAS being read correctly (100), but JS was using deprecated path instead of waiting for Native's decision.

## Fixes Implemented

### Fix 1: Remove Deprecated JS Logic in `USER_INTERACTION_FOREGROUND`

**File**: `src/systemBrain/eventHandler.ts`

**Before**:
```typescript
async function handleUserInteraction(...) {
  // ...
  console.log('[System Brain] UI-safe boundary - calling decision engine');
  
  const decision = await decideSystemSurfaceAction(
    { type: 'USER_INTERACTION_FOREGROUND', packageName, timestamp },
    state
  );
  
  if (decision.type === 'LAUNCH') {
    await launchSystemSurface(decision.app, decision.wakeReason);
  }
}
```

**After**:
```typescript
async function handleUserInteraction(...) {
  // ...
  // ============================================================================
  // PHASE 4.1: State tracking only - Native makes entry decisions
  // ============================================================================
  console.log('[System Brain] USER_INTERACTION_FOREGROUND (state tracking only - Phase 4.1)');
  console.log('[System Brain] Entry decisions handled by Native via QUICK_TASK_DECISION events');
  
  // ❌ DO NOT call decideSystemSurfaceAction() - deprecated in Phase 4.1
  // ❌ DO NOT evaluate Quick Task availability
  // ❌ DO NOT launch SystemSurface from this handler
  // ✅ Native emits QUICK_TASK_DECISION events separately
  
  // Future: Add non-entry-decision logic here if needed
}
```

### Fix 2: Add Guard in Decision Engine

**File**: `src/systemBrain/decisionEngine.ts`

**Added at function entry**:
```typescript
export async function decideSystemSurfaceAction(...) {
  // ============================================================================
  // PHASE 4.1 GUARD: Reject foreground events (entry decisions made by Native)
  // ============================================================================
  if (event.type === 'FOREGROUND_CHANGED' || event.type === 'USER_INTERACTION_FOREGROUND') {
    console.error('[Decision Engine] ❌ CRITICAL: Should not be called for foreground events in Phase 4.1');
    console.error('[Decision Engine] Event type:', event.type);
    console.error('[Decision Engine] Native makes entry decisions via QUICK_TASK_DECISION events');
    console.error('[Decision Engine] This indicates a bug in Phase 4.1 migration');
    return { type: 'NONE' };
  }
  
  // ... rest of function
}
```

## Phase 4.1 Contract (Now Enforced)

### Native Responsibilities
- ✅ Emit `QUICK_TASK_DECISION` for EVERY monitored app entry
- ✅ Decision: `SHOW_QUICK_TASK_DIALOG` or `NO_QUICK_TASK_AVAILABLE`
- ✅ Check timers, quota, lifecycle guards
- ✅ Make decision BEFORE JS sees the event

### JS Responsibilities
- ✅ Receive `QUICK_TASK_DECISION` events
- ✅ Execute Native's decision as COMMAND (no re-evaluation)
- ✅ For `SHOW_QUICK_TASK_DIALOG`: Launch SystemSurface unconditionally
- ✅ For `NO_QUICK_TASK_AVAILABLE`: Check t_intention, then launch Intervention
- ❌ NEVER evaluate Quick Task logic for foreground events
- ❌ NEVER call Decision Engine for `USER_INTERACTION_FOREGROUND`

## Expected Behavior After Fix

### Test Scenario: `n_quickTask = 100`

**Native logs (adb logcat)**:
```
📱 Foreground app changed: com.xingin.xhs
🎯 MONITORED APP DETECTED: com.xingin.xhs
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 100
   └─ quotaAvailable: true
✅ DECISION: Quick Task available for com.xingin.xhs (quota: 100)
📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG for com.xingin.xhs
```

**JS logs**:
```
[System Brain] FOREGROUND_CHANGED (mechanical event only - Phase 4.1)
[System Brain] Entry decisions now handled by Native via QUICK_TASK_DECISION events
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] QUICK TASK DECISION (COMMAND FROM NATIVE)
[System Brain] App: com.xingin.xhs
[System Brain] Decision: SHOW_QUICK_TASK_DIALOG
[System Brain] ✅ EXECUTING NATIVE COMMAND: Show Quick Task dialog
[SystemSurfaceInvariant] LAUNCH {"app": "com.xingin.xhs", "wakeReason": "SHOW_QUICK_TASK_DIALOG"}
```

**Result**: Quick Task dialog appears!

### Test Scenario: `n_quickTask = 0`

**Native logs**:
```
📱 Foreground app changed: com.xingin.xhs
🎯 MONITORED APP DETECTED: com.xingin.xhs
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 0
   └─ quotaAvailable: false
❌ DECISION: Quick Task not available for com.xingin.xhs (quota exhausted)
📤 Emitted QUICK_TASK_DECISION: NO_QUICK_TASK_AVAILABLE for com.xingin.xhs
```

**JS logs**:
```
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] Decision: NO_QUICK_TASK_AVAILABLE
[System Brain] Native declined Quick Task
[System Brain] Checking t_intention suppression...
[System Brain] ✓ No t_intention - starting Intervention
[SystemSurfaceInvariant] LAUNCH {"app": "com.xingin.xhs", "wakeReason": "START_INTERVENTION_FLOW"}
```

**Result**: Intervention flow appears!

## Files Changed

1. **`src/systemBrain/eventHandler.ts`**
   - Removed `decideSystemSurfaceAction()` call from `handleUserInteraction()`
   - Made handler state-tracking only

2. **`src/systemBrain/decisionEngine.ts`**
   - Added guard at function entry to reject foreground events
   - Logs error if called with `FOREGROUND_CHANGED` or `USER_INTERACTION_FOREGROUND`

## Testing Checklist

- [ ] Set `n_quickTask = 100` in settings
- [ ] Open monitored app (xhs, Instagram, X, TikTok)
- [ ] Verify Quick Task dialog appears
- [ ] Verify NO deprecated path warnings in logs
- [ ] Set `n_quickTask = 0` in settings
- [ ] Open monitored app
- [ ] Verify Intervention flow appears
- [ ] Verify Native emits `QUICK_TASK_DECISION` for every entry

## Success Criteria

1. ✅ Native emits `QUICK_TASK_DECISION` for every monitored app entry
2. ✅ JS never evaluates Quick Task logic for foreground events
3. ✅ Quick Task dialog appears when `n_quickTask > 0`
4. ✅ Intervention flow appears when `n_quickTask = 0`
5. ✅ No "DEPRECATED" or "UNEXPECTED" warnings in logs

## Build Status

- Kotlin files synced: ✅
- CMake cache cleared: ✅
- Build started: ✅ (running in background)
- Build completed: ⏳ (pending)
- Tests passed: ⏳ (pending)

---

**Implementation Date**: 2026-01-11
**Phase**: 4.1 Critical Fix
**Priority**: BLOCKER
**Status**: Implementation Complete, Testing Pending
