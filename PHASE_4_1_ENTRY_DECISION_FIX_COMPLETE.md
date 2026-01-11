# Phase 4.1 Entry Decision Fix - Complete

## Executive Summary

**Fixed**: Native entry decision logic now emits exactly one decision for EVERY monitored app entry, regardless of which app or how many times it's opened.

**Timestamp**: 2026-01-11 13:00
**Phase**: 4.1 Entry Decision Authority (FINAL FIX)
**Status**: Implementation Complete, Testing Pending

## Problem Identified

### Critical Bug
Native had a **cross-entry suppression guard** that violated Phase 4.1 requirements:

```kotlin
// WRONG: Blocked re-entry to same app
if (lastDecisionApp == packageName) {
    Log.d(TAG, "Already made entry decision for $packageName, skipping")
    return  // Silent failure
}
```

### Broken Scenarios

**Scenario 1: Same App Re-Entry**
```
1. User opens Instagram → lastDecisionApp = "instagram" → Decision emitted ✅
2. User closes Instagram, opens it again
3. Guard blocks: "Already made entry decision for instagram"
4. NO DECISION EMITTED ❌ (Silent failure)
```

**Scenario 2: After Quota Change**
```
1. n_quickTask = 100, open Instagram → Decision emitted ✅
2. Change n_quickTask to 0
3. Open Instagram again
4. Guard blocks: "Already made entry decision for instagram"
5. NO DECISION EMITTED ❌ (Should show Intervention)
```

### Root Cause

`lastDecisionApp` was being used as a **cross-entry guard** when it should only be used for **logging/debugging**.

## The Fix

### Changes Made

**File**: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`

#### 1. Removed Guard 2 (lastDecisionApp check)

**BEFORE**:
```kotlin
// Guard 1: Do NOT emit if SystemSurface is already active
if (isSystemSurfaceActive) {
    Log.d(TAG, "SystemSurface already active, skipping entry decision")
    return
}

// Guard 2: Do NOT emit duplicate decision for same app
if (lastDecisionApp == packageName) {
    Log.d(TAG, "Already made entry decision for $packageName, skipping")
    return  // WRONG
}
```

**AFTER**:
```kotlin
// Guard: Do NOT emit if SystemSurface is already active
// This is the ONLY valid guard - prevents emission while UI is showing
if (isSystemSurfaceActive) {
    Log.d(TAG, "SystemSurface already active, skipping entry decision")
    return
}

// Make entry decision (GUARANTEED EMISSION for every monitored app entry)
```

#### 2. Removed Edge-Triggered Clearing Logic

**BEFORE**:
```kotlin
// Edge-Triggered Guard Clearing: Different app = new entry = clear guards
if (lastDecisionApp != null && lastDecisionApp != packageName) {
    Log.i(TAG, "Different app detected, clearing lastDecisionApp")
    lastDecisionApp = null
}
```

**AFTER**: (Removed completely - no longer needed)

#### 3. Kept lastDecisionApp for Logging Only

```kotlin
// Emit decision (GUARANTEED)
lastDecisionApp = packageName  // Track for logging only, NOT a guard
emitQuickTaskDecisionEvent(packageName, decision)
```

## Architecture After Fix

### Valid Guard (ONLY ONE)

**isSystemSurfaceActive** - Prevents emission while UI is showing:
```kotlin
if (isSystemSurfaceActive) {
    return  // Correct: UI is active, don't emit another decision
}
```

This guard is **reset by JS** when SystemSurface finishes:
```kotlin
// In setSystemSurfaceActive(false)
isSystemSurfaceActive = false
lastDecisionApp = null  // Reset for logging
```

### Decision Emission Logic (GUARANTEED)

For every monitored app entry (when `!isSystemSurfaceActive`):

```kotlin
// Make entry decision (GUARANTEED EMISSION)
val hasActiveTimer = hasValidQuickTaskTimer(packageName)
val quotaAvailable = cachedQuickTaskQuota > 0

// Decision logic: ALWAYS emit exactly one event
val decision = if (!hasActiveTimer && quotaAvailable) {
    "SHOW_QUICK_TASK_DIALOG"
} else {
    "NO_QUICK_TASK_AVAILABLE"
}

// Emit decision (GUARANTEED)
lastDecisionApp = packageName  // Logging only
emitQuickTaskDecisionEvent(packageName, decision)
```

**Key Points**:
- No early returns after this point
- No cross-entry suppression
- `lastDecisionApp` is NOT a guard

## Expected Behavior After Fix

### Test 1: Same App Re-Entry
```
1. Open Instagram → Decision: SHOW_QUICK_TASK_DIALOG ✅
2. Close Instagram
3. Open Instagram again → Decision: SHOW_QUICK_TASK_DIALOG ✅
4. Open Instagram again → Decision: SHOW_QUICK_TASK_DIALOG ✅
```

**Result**: Every entry gets a decision ✅

### Test 2: Different Apps
```
1. Open Instagram → Decision: SHOW_QUICK_TASK_DIALOG ✅
2. Open Twitter → Decision: SHOW_QUICK_TASK_DIALOG ✅
3. Open TikTok → Decision: SHOW_QUICK_TASK_DIALOG ✅
4. Open Instagram → Decision: SHOW_QUICK_TASK_DIALOG ✅
```

**Result**: Every app entry gets a decision ✅

### Test 3: Quota Change
```
1. n_quickTask = 100
2. Open Instagram → Decision: SHOW_QUICK_TASK_DIALOG ✅
3. Change n_quickTask to 0
4. Open Instagram → Decision: NO_QUICK_TASK_AVAILABLE ✅
5. Open Twitter → Decision: NO_QUICK_TASK_AVAILABLE ✅
```

**Result**: Quota change immediately affects next entry ✅

### Test 4: Active SystemSurface (Valid Guard)
```
1. Open Instagram → Decision emitted, SystemSurface launches ✅
2. While dialog is showing, switch to Twitter
3. Guard blocks: "SystemSurface already active" ✅ (Correct)
4. Close dialog → isSystemSurfaceActive = false
5. Open Twitter → Decision: SHOW_QUICK_TASK_DIALOG ✅
```

**Result**: Guard only blocks while UI is active ✅

## Phase 4.1 Compliance

### Requirements Met

1. **Native is sole authority for entry decisions** ✅
   - Native emits `SHOW_QUICK_TASK_DIALOG` or `NO_QUICK_TASK_AVAILABLE`
   - JS only reacts to Native commands

2. **Every monitored app entry gets exactly one decision** ✅
   - No cross-entry suppression
   - No silent failures
   - Same app can be entered multiple times

3. **Guards only prevent duplicate emission within same event** ✅
   - `isSystemSurfaceActive` is the ONLY guard
   - Prevents emission while UI is showing (correct)
   - Does NOT prevent re-entry after UI closes

4. **No state persists across entries** ✅
   - `lastDecisionApp` is logging only, NOT a guard
   - Reset on SystemSurface close (for logging hygiene)

### Non-Negotiable Rules (ALL MET)

- [x] Every app foreground entry is a NEW decision
- [x] Native never suppresses entry decisions across entries
- [x] Native is never silent
- [x] Guards only prevent duplicate emission within same entry event
- [x] lastDecisionApp does NOT survive as a guard across entries
- [x] Quota changes immediately allow new decisions

## Files Changed

1. **plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt**
   - Removed Guard 2 (lastDecisionApp check)
   - Removed edge-triggered clearing logic
   - Kept `isSystemSurfaceActive` guard (only valid guard)
   - Kept `lastDecisionApp` for logging only

## Build Status

- Kotlin files synced: ✅ (ForegroundDetectionService.kt updated)
- Build started: ✅ (running in background)
- Build completed: ⏳ (pending)
- Tests passed: ⏳ (pending)

## Acceptance Criteria (STRICT)

After build completes, ALL of the following MUST pass:

### 1. n_quickTask = 100
- [ ] Open App A → Quick Task dialog
- [ ] Open App B → Quick Task dialog
- [ ] Open App A again → Quick Task dialog

### 2. n_quickTask = 0
- [ ] Open App A → Intervention
- [ ] Open App B → Intervention

### 3. Change n_quickTask 0 → 100
- [ ] Next app entry → Quick Task dialog

### 4. Change n_quickTask 100 → 0
- [ ] Next app entry → Intervention

### 5. Never
- [ ] Silence (no decision emitted)
- [ ] "First time works, second time nothing"
- [ ] Blocked re-entry to same app

## Expected Logs After Fix

### Native (adb logcat)

**Every monitored app entry**:
```
📱 Foreground app changed: com.instagram.android
🎯 MONITORED APP DETECTED: com.instagram.android
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 100
   └─ quotaAvailable: true
✅ DECISION: Quick Task available for com.instagram.android (quota: 100)
📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG for com.instagram.android
```

**Same app re-entry** (NO BLOCKING):
```
📱 Foreground app changed: com.instagram.android
🎯 MONITORED APP DETECTED: com.instagram.android
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 100
   └─ quotaAvailable: true
✅ DECISION: Quick Task available for com.instagram.android (quota: 100)
📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG for com.instagram.android
```

**After quota change to 0**:
```
📱 Foreground app changed: com.instagram.android
🎯 MONITORED APP DETECTED: com.instagram.android
📊 Entry Decision Inputs:
   └─ hasActiveTimer: false
   └─ cachedQuickTaskQuota: 0
   └─ quotaAvailable: false
❌ DECISION: Quick Task not available for com.instagram.android (quota exhausted)
📤 Emitted QUICK_TASK_DECISION: NO_QUICK_TASK_AVAILABLE for com.instagram.android
```

### JS Logs

**Quick Task dialog**:
```
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] Decision: SHOW_QUICK_TASK_DIALOG
[System Brain] ✅ EXECUTING NATIVE COMMAND: Show Quick Task dialog
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] Dispatching START_QUICK_TASK for app: com.instagram.android
[SystemSurfaceRoot] Rendering QuickTaskFlow for app: com.instagram.android
```

**Intervention flow**:
```
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] Decision: NO_QUICK_TASK_AVAILABLE
[System Brain] Native declined Quick Task
[System Brain] ✓ No t_intention - starting Intervention
[SystemSurfaceRoot] Dispatching START_INTERVENTION for app: com.instagram.android
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

## What We Did NOT Change

- Quick Task timer logic (Phase 4.2)
- Timer expiration logic (Phase 4.2)
- Quota sync logic (already fixed in previous session)
- SystemSurfaceRoot session creation (already fixed in previous session)

## Why This Fix Is Correct

### Architectural Principles

1. **Single Guard**: Only `isSystemSurfaceActive` prevents emission (while UI showing)
2. **No Cross-Entry State**: `lastDecisionApp` is logging only, NOT a guard
3. **Guaranteed Emission**: Every monitored app entry → exactly one decision
4. **Immediate Response**: Quota changes affect next entry immediately

### Phase 4.1 Requirements

- Native is sole authority for entry decisions ✅
- Every entry gets exactly one decision ✅
- No silent failures ✅
- No cross-entry suppression ✅

---

**Next Step**: Wait for build to complete, then test ALL acceptance criteria!

If ANY test fails, Phase 4.1 is NOT complete.
