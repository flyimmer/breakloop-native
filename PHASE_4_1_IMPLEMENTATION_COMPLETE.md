# Phase 4.1 Implementation Complete

**Date:** 2026-01-10  
**Status:** ✅ IMPLEMENTED - Ready for Testing  
**Migration:** Quick Task Entry Decision Authority → Native

---

## What Changed

### Authority Migration

**Before Phase 4.1:**
- JavaScript (System Brain) decided Quick Task entry via OS Trigger Brain
- JavaScript checked n_quickTask quota and timer existence
- JavaScript launched SystemSurface with SHOW_QUICK_TASK_DIALOG

**After Phase 4.1:**
- **Native** decides Quick Task entry (SINGLE AUTHORITY)
- **Native** checks quota and timer existence
- **Native** emits COMMAND: SHOW_QUICK_TASK_DIALOG or NO_QUICK_TASK_AVAILABLE
- **JavaScript** executes command unconditionally (NO re-evaluation)

---

## Files Modified

### Native Layer (Kotlin)

#### 1. `plugins/src/android/java/.../ForegroundDetectionService.kt`

**Added:**
- `cachedQuickTaskQuota: Int` - Runtime cache for n_quickTask (default: 1)
- `lastDecisionApp: String?` - Edge-triggered decision tracking
- `isSystemSurfaceActive: Boolean` - Lifecycle guard
- `updateQuickTaskQuota(quota: Int)` - Sync method from JS
- `setSystemSurfaceActive(active: Boolean)` - Lifecycle notification from JS
- `emitQuickTaskDecisionEvent(packageName, decision)` - Event emission helper

**Modified:**
- `onAccessibilityEvent()` - Replaced `launchInterventionActivity()` with entry decision logic
  - Guards: Check `isSystemSurfaceActive` and `lastDecisionApp`
  - Decision: Check `hasValidQuickTaskTimer()` and `cachedQuickTaskQuota > 0`
  - Emit: `SHOW_QUICK_TASK_DIALOG` or `NO_QUICK_TASK_AVAILABLE`

#### 2. `plugins/src/android/java/.../AppMonitorModule.kt`

**Added:**
- `updateQuickTaskQuota(quota: Int, promise: Promise)` - React method for quota sync
- `setSystemSurfaceActive(active: Boolean, promise: Promise)` - React method for lifecycle notification

---

### JavaScript Layer (TypeScript)

#### 3. `src/systemBrain/decisionEngine.ts`

**Added:**
- `syncQuotaToNative(state: TimerState)` - Syncs quota to Native cache
  - Calculates current quota from usage history
  - Calls `AppMonitorModule.updateQuickTaskQuota()`
  - Called on: app startup, after usage, settings change

**Deprecated:**
- `suppressQuickTaskForApp` - Marked as DEPRECATED (Phase 4.1)
- `clearQuickTaskSuppression()` - Marked as DEPRECATED (Phase 4.1)
- OS Trigger Brain Quick Task checks - Added deprecation warnings
- Quick Task suppression checks - Added deprecation warnings

#### 4. `src/systemBrain/eventHandler.ts`

**Added:**
- `handleQuickTaskDecision(event)` - COMMAND HANDLER for Native decisions
  - `SHOW_QUICK_TASK_DIALOG` → Launch dialog UNCONDITIONALLY
  - `NO_QUICK_TASK_AVAILABLE` → Check t_intention only, then Intervention
  - Notifies Native via `setSystemSurfaceActive(true)` before launch

**Modified:**
- `handleForegroundChange()` - Removed decision engine call for monitored apps
  - Now only tracks state (mechanical event)
  - Added deprecation comments

#### 5. `src/systemBrain/index.ts`

**Added:**
- `initializeSystemBrain()` - Startup initialization function
  - Loads state and syncs quota to Native
  - Runs immediately on module load
- Event listener registration for `QUICK_TASK_DECISION`

#### 6. `src/systemBrain/publicApi.ts`

**Modified:**
- `transitionQuickTaskToActive()` - Added quota sync after usage
  - Calls `syncQuotaToNative(state)` after quota decrement
  - Ensures Native cache is updated immediately

#### 7. `src/contexts/SystemSessionProvider.tsx`

**Modified:**
- Session teardown effect - Added Native notification
  - Calls `AppMonitorModule.setSystemSurfaceActive(false)` on finish
  - Resets Native's edge-triggered guards

---

## Event Flow (Phase 4.1)

### Entry Flow

```
1. User opens Instagram
2. ForegroundDetectionService.onAccessibilityEvent()
   - Checks: isSystemSurfaceActive? (no)
   - Checks: lastDecisionApp === "instagram"? (no)
   - Checks: hasValidQuickTaskTimer("instagram")? (no)
   - Checks: cachedQuickTaskQuota > 0? (yes)
   - Decision: SHOW_QUICK_TASK_DIALOG
   - Sets: lastDecisionApp = "instagram"
   - Emits: QUICK_TASK_DECISION event
3. System Brain handleQuickTaskDecision()
   - Receives: SHOW_QUICK_TASK_DIALOG (COMMAND)
   - Sets: phase = DECISION
   - Calls: AppMonitorModule.setSystemSurfaceActive(true)
   - Launches: SystemSurface with SHOW_QUICK_TASK_DIALOG
4. User sees Quick Task dialog
```

### Quota Sync Flow

```
1. User clicks "Quick Task" button
2. QuickTaskDialogScreen.handleQuickTask()
   - Calls: transitionQuickTaskToActive()
3. transitionQuickTaskToActive()
   - Sets: phase = ACTIVE
   - Decrements: n_quickTask (adds to usage history)
   - Saves: state
   - Calls: syncQuotaToNative(state)
4. syncQuotaToNative()
   - Calculates: remaining quota
   - Calls: AppMonitorModule.updateQuickTaskQuota(remaining)
5. Native cache updated
   - Next entry decision uses new quota
```

### Finish Flow

```
1. User completes intervention/Quick Task
2. SystemSessionProvider teardown effect
   - Calls: clearSystemSurfaceActive() (JS side)
   - Calls: AppMonitorModule.setSystemSurfaceActive(false)
3. Native resets guards
   - Sets: isSystemSurfaceActive = false
   - Clears: lastDecisionApp = null
4. Next app entry can make new decision
```

---

## Critical Invariants Enforced

### Invariant 1: Entry Decision is EDGE-TRIGGERED

**Implementation:**
- Native tracks `isSystemSurfaceActive` and `lastDecisionApp`
- Decision emitted ONCE per app entry
- Decision blocked while SystemSurface is active
- Guards reset when SystemSurface finishes

**Prevents:**
- Duplicate launches
- Race conditions between FOREGROUND_CHANGED and USER_INTERACTION_FOREGROUND
- Re-entry during active session

### Invariant 2: Native Decision is a COMMAND

**Implementation:**
- `handleQuickTaskDecision()` is UNCONDITIONAL
- NO re-evaluation of quota
- NO OS Trigger Brain fallback
- NO suppression logic (except t_intention for NO_QUICK_TASK_AVAILABLE)

**Prevents:**
- Split authority
- JS overriding Native's decision
- Stale suppression flags
- Decision competition

---

## What Remains Unchanged (Phase 4.1 Scope)

- ✅ Quick Task timer storage (still in Native + System Brain)
- ✅ Timer expiration handling (still System Brain)
- ✅ POST_QUICK_TASK_CHOICE flow (unchanged)
- ✅ Phase transitions DECISION → ACTIVE (unchanged)
- ✅ Quota decrement in `transitionQuickTaskToActive()` (unchanged)
- ✅ t_intention checking (still in JS)

---

## Testing Checklist

### Entry Behavior Tests

- [ ] **Fresh app open with quota:**
  - Open Instagram (first time)
  - Verify Native emits `SHOW_QUICK_TASK_DIALOG`
  - Verify Quick Task dialog appears
  - Verify no JS decision logic runs (check logs)

- [ ] **Fresh app open without quota:**
  - Set n_quickTask = 0 (use all Quick Tasks)
  - Open Instagram
  - Verify Native emits `NO_QUICK_TASK_AVAILABLE`
  - Verify JS checks t_intention (none) → Intervention starts
  - Verify no Quick Task dialog appears

- [ ] **App open with active timer:**
  - Start Quick Task for Instagram
  - Switch away and return to Instagram
  - Verify Native emits `NO_QUICK_TASK_AVAILABLE` (timer exists)
  - Verify no duplicate dialog

- [ ] **App open with t_intention:**
  - Complete Intervention, set t_intention
  - Open Instagram
  - Verify Native emits `NO_QUICK_TASK_AVAILABLE`
  - Verify JS checks t_intention (active) → Suppress
  - Verify no UI appears

- [ ] **No immediate quit to home:**
  - Open Instagram
  - Verify app does NOT immediately quit
  - Verify Quick Task dialog or Intervention appears

- [ ] **No duplicate dialogs:**
  - Open Instagram
  - Verify Quick Task dialog appears ONCE
  - Verify no duplicate launches in logs

### Quota Sync Tests

- [ ] **Quota decrements:**
  - Use Quick Task
  - Check logs: verify `syncQuotaToNative()` called
  - Check logs: verify Native receives updated quota
  - Open another monitored app
  - Verify Native uses new quota for decision

- [ ] **Settings change:**
  - Change maxUses in Settings (if implemented)
  - Verify Native receives updated quota
  - Open monitored app
  - Verify Native uses new quota

- [ ] **App startup:**
  - Kill app completely
  - Restart app
  - Check logs: verify `initializeSystemBrain()` runs
  - Check logs: verify quota synced to Native on startup
  - Open monitored app
  - Verify Native has correct quota

---

## Rollback Plan

If Phase 4.1 causes critical issues:

1. **Revert Native decision logic:**
   - Remove entry decision code from `onAccessibilityEvent()`
   - Restore old `launchInterventionActivity()` call
   - Remove `emitQuickTaskDecisionEvent()` helper

2. **Re-enable JS decision logic:**
   - Remove DEPRECATED markers from `decisionEngine.ts`
   - Restore `decideSystemSurfaceAction()` call in `handleForegroundChange()`

3. **Remove event listener:**
   - Remove `QUICK_TASK_DECISION` listener from `index.ts`
   - Remove `handleQuickTaskDecision()` from `eventHandler.ts`

4. **Keep quota sync (harmless):**
   - `syncQuotaToNative()` can stay (no-op if not used)
   - `updateQuickTaskQuota()` can stay (no-op if not called)

---

## Expected Improvements

After Phase 4.1, you should see:

1. ✅ **No more "Instagram quits on open"**
   - Native decides once per entry (edge-triggered)
   - No stale suppression flags

2. ✅ **No more duplicate Quick Task dialogs**
   - Lifecycle guard prevents re-entry
   - `lastDecisionApp` prevents duplicate decisions

3. ✅ **Deterministic Quick Task appearance**
   - Native's decision is final
   - JS does not re-evaluate or suppress

4. ✅ **Clean separation of concerns**
   - Native: Entry decision authority
   - JS: UI rendering + Intervention logic

---

## Known Limitations (Phase 4.1 Scope)

These are intentionally NOT addressed in Phase 4.1:

- Timer expiration still handled by System Brain (Phase 4.2)
- POST_QUICK_TASK_CHOICE still in JS (Phase 4.2)
- Phase state still in JS (Phase 4.2)
- Quota ownership still in JS (Phase 4.2+)

Phase 4.1 is ONLY about entry decision authority.

---

## Next Steps

1. **Test Phase 4.1** using the checklist above
2. **Verify no regressions** in existing flows
3. **Monitor logs** for DEPRECATED warnings (should not appear)
4. **Proceed to Phase 4.2** once Phase 4.1 is stable

---

## Success Criteria (Lock This)

Phase 4.1 succeeds if and only if:

1. ✅ Native decides once per entry (edge-triggered, not level-triggered)
2. ✅ JS obeys without reinterpretation (command, not suggestion)
3. ✅ No immediate quit to home (lifecycle guards work)
4. ✅ No stale suppression (suppressQuickTaskForApp deprecated)
5. ✅ No duplicate dialogs (isSystemSurfaceActive prevents re-entry)

**Anchor sentence:** Phase 4.1 succeeds if Native decides once per entry and JS obeys without reinterpretation.
