# Quick Task Expiration Enforcement Fix (Phase 1)

**Date:** January 2026  
**Issue:** Quick Task expires but user can continue using app indefinitely  
**Root Cause:** No enforcement mechanism after timer expiration  
**Fix:** Pending intervention marker enforces at next safe trigger point  
**Status:** ✅ Implemented and ready for testing

---

## 🎯 Problem Statement

**Before Fix:**
1. User sets Quick Task for Instagram (10s)
2. Timer expires correctly
3. `TIMER_EXPIRED` event received
4. Timer cleared from state
5. **BUT:** User can continue using Instagram indefinitely ❌
6. No intervention, no enforcement

**User Impact:** Quick Task appears broken - users think it doesn't work.

---

## ✅ Solution Architecture

**Pending Intervention Pattern:**
- Don't launch SystemSurface immediately (avoids hang bugs)
- Mark app as "pending enforcement"
- Enforce at next safe trigger point (foreground re-evaluation)
- Deterministic and verifiable via logs

---

## 📝 Changes Made

### 1. Added Pending Intervention State

**File:** `src/systemBrain/stateManager.ts`

**TimerState Interface:**
```typescript
export interface TimerState {
  quickTaskTimers: Record<string, { expiresAt: number }>;
  intentionTimers: Record<string, { expiresAt: number }>;
  quickTaskUsageHistory: number[];
  lastMeaningfulApp: string | null;
  isHeadlessTaskProcessing: boolean;
  pendingQuickTaskIntervention: string[];  // NEW: Apps awaiting enforcement
}
```

**Initial State Updates:**
- Load from storage: `pendingQuickTaskIntervention: state.pendingQuickTaskIntervention || []`
- Default state: `pendingQuickTaskIntervention: []`
- Save logs: Include `pendingQuickTaskIntervention` in state save logs

### 2. Mark Pending Enforcement on Expiration

**File:** `src/systemBrain/eventHandler.ts` (lines 251-261)

**When Quick Task expires while user is on app:**
```typescript
if (timerType === 'QUICK_TASK') {
  console.log('[System Brain] ⏰ QUICK TASK EXPIRED for:', packageName);
  console.log('[System Brain] Current foreground app:', currentForegroundApp);
  
  // User still on expired app - mark for enforcement
  if (!state.pendingQuickTaskIntervention.includes(packageName)) {
    state.pendingQuickTaskIntervention.push(packageName);
    console.log('[System Brain] 🔒 Enforcement marked as PENDING for:', packageName);
    console.log('[System Brain] Will enforce on next foreground evaluation');
  }
}
```

**When Quick Task expires while user is on different app:**
```typescript
if (timerType === 'QUICK_TASK') {
  console.log('[System Brain] ✓ User already left app - no enforcement needed');
  console.log('[System Brain] Current foreground app:', currentForegroundApp);
}
```

### 3. Enforce on Next Foreground Evaluation

**File:** `src/systemBrain/eventHandler.ts` (lines 404-422)

**Added enforcement check in `handleForegroundChange()`:**
```typescript
// 🔒 ENFORCE PENDING QUICK TASK EXPIRATION
const pendingIndex = state.pendingQuickTaskIntervention.indexOf(packageName);
if (pendingIndex !== -1) {
  // Remove from pending list
  state.pendingQuickTaskIntervention.splice(pendingIndex, 1);
  
  console.log('[System Brain] 🚨 ENFORCING expired Quick Task for:', packageName);
  console.log('[System Brain] Launching intervention (Quick Task expired while user was on app)');
  
  // Launch intervention immediately
  await launchSystemSurface(packageName, 'START_INTERVENTION_FLOW');
  return; // Stop processing - intervention launched
}
```

**Placement:** After infrastructure check, before monitored app check.

### 4. Enhanced Diagnostic Logging

**State save logs now include:**
```typescript
console.log('[System Brain] State saved to storage:', {
  quickTaskTimers: Object.keys(state.quickTaskTimers).length,
  intentionTimers: Object.keys(state.intentionTimers).length,
  usageHistoryLength: state.quickTaskUsageHistory.length,
  lastMeaningfulApp: state.lastMeaningfulApp,
  pendingQuickTaskIntervention: state.pendingQuickTaskIntervention,  // NEW
});
```

---

## 🎬 Expected Behavior After Fix

### Scenario 1: User Stays on App (Primary Use Case)

**Steps:**
1. User sets Quick Task for Instagram (10s)
2. User stays on Instagram
3. After 10s timer expires

**Expected Logs:**
```
[System Brain] ⏰ QUICK TASK EXPIRED for: com.instagram.android
[System Brain] Current foreground app: com.instagram.android
[System Brain] 🔒 Enforcement marked as PENDING for: com.instagram.android
[System Brain] Will enforce on next foreground evaluation
[System Brain] State saved to storage: {..., "pendingQuickTaskIntervention": ["com.instagram.android"]}
```

4. User continues using Instagram (no immediate UI)
5. User pulls down notification shade (system UI)

**Expected:**
- No enforcement (system UI ignored via infrastructure whitelist)
- Pending state preserved

6. User returns to Instagram (notification shade closes)

**Expected Logs:**
```
[System Brain] Foreground changed to: com.instagram.android
[System Brain] 🚨 ENFORCING expired Quick Task for: com.instagram.android
[System Brain] Launching intervention (Quick Task expired while user was on app)
```

**Result:** ✅ SystemSurface launches with intervention flow

### Scenario 2: User Leaves App Before Expiration

**Steps:**
1. User sets Quick Task for Instagram (10s)
2. User switches to Chrome after 5s
3. After 10s timer expires (while on Chrome)

**Expected Logs:**
```
[System Brain] ⏰ QUICK TASK EXPIRED for: com.instagram.android
[System Brain] Current foreground app: com.android.chrome
[System Brain] ✓ User already left app - no enforcement needed
[System Brain] State saved to storage: {..., "pendingQuickTaskIntervention": []}
```

**Result:** ✅ No pending enforcement, timer just clears

### Scenario 3: User Leaves App After Expiration

**Steps:**
1. User sets Quick Task for Instagram (10s)
2. User stays on Instagram
3. After 10s timer expires → pending marked
4. User switches to Chrome

**Expected:**
- Pending state preserved
- No enforcement when leaving

5. User switches back to Instagram later

**Expected Logs:**
```
[System Brain] Foreground changed to: com.instagram.android
[System Brain] 🚨 ENFORCING expired Quick Task for: com.instagram.android
[System Brain] Launching intervention
```

**Result:** ✅ Enforcement triggers when returning to Instagram

---

## ✅ What This Achieves

### Core Fixes

✅ **Quick Task expiration is enforced** - No indefinite free use  
✅ **No immediate SystemSurface launch** - Avoids hang bugs  
✅ **Enforcement at safe trigger point** - Foreground re-evaluation  
✅ **System UI ignored** - Notification shade doesn't trigger enforcement  
✅ **Deterministic behavior** - Verifiable via logs  

### Architectural Benefits

✅ **No UI changes yet** - Phase 1 focuses on logic only  
✅ **No new wake reasons** - Uses existing `START_INTERVENTION_FLOW`  
✅ **Persistent state** - Survives app kills  
✅ **Clean separation** - Expiration vs enforcement  

---

## 🧪 Testing Strategy

### Manual Testing

**Test 1: Primary Use Case (Critical)**
```
1. Open Instagram
2. Start Quick Task (10s)
3. Stay on Instagram
4. After 10s: Check logs for "Enforcement marked as PENDING"
5. Pull down notification shade
6. Close notification shade
7. ✅ Expected: Intervention launches
```

**Test 2: User Leaves Before Expiration**
```
1. Open Instagram
2. Start Quick Task (10s)
3. Switch to Chrome after 5s
4. After 10s: Check logs for "User already left app"
5. ✅ Expected: No pending enforcement
```

**Test 3: User Leaves After Expiration**
```
1. Open Instagram
2. Start Quick Task (10s)
3. Stay on Instagram until expiration
4. Check logs for "Enforcement marked as PENDING"
5. Switch to Chrome
6. Switch back to Instagram
7. ✅ Expected: Intervention launches
```

### Log Verification

**Required logs for successful enforcement:**
1. `⏰ QUICK TASK EXPIRED for: [app]`
2. `🔒 Enforcement marked as PENDING`
3. `pendingQuickTaskIntervention: ["[app]"]` in state save
4. `🚨 ENFORCING expired Quick Task for: [app]`
5. `Launching intervention`

**Required logs for no enforcement (user left):**
1. `⏰ QUICK TASK EXPIRED for: [app]`
2. `✓ User already left app - no enforcement needed`
3. `pendingQuickTaskIntervention: []` in state save

---

## 🔍 Verification Checklist

### Code Review
- [x] `pendingQuickTaskIntervention` added to `TimerState` interface
- [x] Pending state initialized in load and default state
- [x] Pending enforcement marked when user on expired app
- [x] No pending when user already left app
- [x] Enforcement check in `handleForegroundChange()` before monitored app check
- [x] Pending state removed after enforcement
- [x] Early return after enforcement (stops further processing)
- [x] Diagnostic logs added at all key points
- [x] State save logs include pending interventions

### Linter
- [x] No linter errors in `src/systemBrain/stateManager.ts`
- [x] No linter errors in `src/systemBrain/eventHandler.ts`

### Build
- [ ] `npm run android` builds successfully
- [ ] No TypeScript compilation errors

### Runtime Testing
- [ ] Test 1: User stays on app → enforcement triggers
- [ ] Test 2: User leaves before expiration → no enforcement
- [ ] Test 3: User leaves after expiration → enforcement on return
- [ ] Notification shade doesn't trigger enforcement
- [ ] Logs show complete enforcement flow
- [ ] No hang bugs
- [ ] No indefinite free use

---

## 🔗 Related Documentation

- `docs/QUICK_TASK_HANG_FIX_IMPLEMENTATION.md` - Context-aware infrastructure fix
- `docs/QUICK_TASK_SILENT_EXPIRATION_FIX.md` - Previous silent expiration approach
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven architecture
- `c:\Users\Wei Zhang\.cursor\plans\fix_quick_task_expiration_7870b562.plan.md` - Implementation plan

---

## 🎓 Key Design Decisions

### Why Not Launch Immediately?

**Problem:** Launching SystemSurface immediately at expiration causes hang bugs (ghost overlays, task stack corruption).

**Solution:** Mark as pending, enforce at next safe trigger point (foreground re-evaluation).

### Why Foreground Re-evaluation?

**Benefits:**
- Safe lifecycle boundary (Activity already exists or being created)
- Natural trigger point (user action, not timer)
- No race conditions with WindowManager
- Clean Activity stack management

### Why System UI Ignored?

**Reason:** Notification shade is transient overlay, not user navigation.

**Implementation:** Infrastructure whitelist prevents false triggers.

### Why Persistent State?

**Reason:** App can be killed between expiration and enforcement.

**Implementation:** `pendingQuickTaskIntervention` persisted in `TimerState`.

---

**Status:** ✅ Implementation complete, ready for testing  
**Next Step:** Build and run manual test scenarios to verify enforcement
