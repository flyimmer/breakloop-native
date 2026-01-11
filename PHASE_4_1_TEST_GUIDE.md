# Phase 4.1 Test Guide

**Purpose:** Verify that Quick Task entry decision authority has successfully moved to Native  
**Date:** 2026-01-10  
**Status:** Ready for Testing

---

## Pre-Test Setup

### 1. Build and Install

```bash
# Sync Kotlin files (already done)
npm run sync:kotlin

# Build and install app
npm run android
```

### 2. Enable Accessibility Service

1. Open Android Settings
2. Go to Accessibility
3. Find "BreakLoop" or "Foreground Detection"
4. Enable the service

### 3. Configure Monitored Apps

1. Open BreakLoop app
2. Go to Settings
3. Add Instagram and TikTok to monitored apps

---

## Test Scenarios

### Scenario 1: Fresh App Open with Quota

**Purpose:** Verify Native decides to show Quick Task dialog

**Steps:**
1. Ensure you have quota (n_quickTask > 0)
2. Open Instagram from home screen
3. Observe behavior

**Expected Results:**
- ✅ Quick Task dialog appears
- ✅ No immediate quit to home
- ✅ Dialog shows correct quota count

**Logs to Check:**
```
[ForegroundDetection] 🎯 MONITORED APP DETECTED: com.instagram.android
[ForegroundDetection] ✅ DECISION: Quick Task available for com.instagram.android (quota: 1)
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG
[System Brain] QUICK TASK DECISION (COMMAND FROM NATIVE)
[System Brain] ✅ EXECUTING NATIVE COMMAND: Show Quick Task dialog
[System Brain] NO re-evaluation, NO suppression, NO fallback
```

**Red Flags:**
- ❌ App quits immediately to home
- ❌ No dialog appears
- ❌ Logs show "OS Trigger Brain" evaluation
- ❌ Logs show "suppressQuickTaskForApp"

---

### Scenario 2: Fresh App Open without Quota

**Purpose:** Verify Native decides to skip Quick Task, JS starts Intervention

**Steps:**
1. Use all Quick Task quota (click Quick Task until quota = 0)
2. Open TikTok from home screen
3. Observe behavior

**Expected Results:**
- ✅ No Quick Task dialog
- ✅ Intervention flow starts immediately (breathing screen)
- ✅ No immediate quit to home

**Logs to Check:**
```
[ForegroundDetection] 🎯 MONITORED APP DETECTED: com.zhiliaoapp.musically
[ForegroundDetection] ❌ DECISION: Quick Task not available (quota exhausted)
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: NO_QUICK_TASK_AVAILABLE
[System Brain] QUICK TASK DECISION (COMMAND FROM NATIVE)
[System Brain] Native declined Quick Task
[System Brain] Checking t_intention suppression...
[System Brain] ✓ No t_intention - starting Intervention
```

**Red Flags:**
- ❌ Quick Task dialog appears (should not)
- ❌ App quits immediately
- ❌ Logs show quota re-checking in JS

---

### Scenario 3: App Open with Active Timer

**Purpose:** Verify Native skips decision when timer is active

**Steps:**
1. Open Instagram
2. Click "Quick Task" button (timer starts)
3. Switch to home screen
4. Return to Instagram (while timer is still active)
5. Observe behavior

**Expected Results:**
- ✅ No Quick Task dialog (timer already active)
- ✅ No Intervention (timer suppresses)
- ✅ Instagram opens normally

**Logs to Check:**
```
[ForegroundDetection] 🎯 MONITORED APP DETECTED: com.instagram.android
[ForegroundDetection] ❌ DECISION: Quick Task not available (timer already active)
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: NO_QUICK_TASK_AVAILABLE
[System Brain] Native declined Quick Task
[System Brain] Checking t_intention suppression...
[System Brain] ✓ No t_intention - starting Intervention
```

**Note:** Intervention may start if t_quickTask expired between steps. This is expected.

**Red Flags:**
- ❌ Duplicate Quick Task dialog
- ❌ Logs show "already made decision" but dialog still appears

---

### Scenario 4: App Open with t_intention

**Purpose:** Verify JS checks t_intention and suppresses

**Steps:**
1. Open Instagram
2. Complete full Intervention flow
3. Choose "I really need to use it" (sets t_intention)
4. App returns to Instagram
5. Switch to home screen
6. Return to Instagram (while t_intention is still active)
7. Observe behavior

**Expected Results:**
- ✅ No Quick Task dialog
- ✅ No Intervention
- ✅ Instagram opens normally (suppressed)

**Logs to Check:**
```
[ForegroundDetection] 🎯 MONITORED APP DETECTED: com.instagram.android
[ForegroundDetection] ❌ DECISION: Quick Task not available (quota exhausted)
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: NO_QUICK_TASK_AVAILABLE
[System Brain] Native declined Quick Task
[System Brain] Checking t_intention suppression...
[System Brain] ✓ t_intention active - suppressing ALL UI
[System Brain] Remaining: XX seconds
```

**Red Flags:**
- ❌ Quick Task dialog appears
- ❌ Intervention starts (should be suppressed)

---

### Scenario 5: No Duplicate Dialogs

**Purpose:** Verify edge-triggered guards prevent duplicates

**Steps:**
1. Open Instagram from home screen
2. Observe Quick Task dialog
3. DO NOT tap any button
4. Wait 5 seconds
5. Observe behavior

**Expected Results:**
- ✅ Dialog appears ONCE
- ✅ No duplicate dialogs
- ✅ No flickering or re-rendering

**Logs to Check:**
```
[ForegroundDetection] ✅ DECISION: Quick Task available
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG
... (later events) ...
[ForegroundDetection] ⏭️ SystemSurface already active, skipping entry decision
```

**Red Flags:**
- ❌ Multiple "QUICK_TASK_DECISION" emissions
- ❌ Dialog disappears and reappears
- ❌ Logs show duplicate launches

---

### Scenario 6: Quota Sync After Usage

**Purpose:** Verify Native cache updates after quota decrement

**Steps:**
1. Start with quota = 1
2. Open Instagram
3. Click "Quick Task" button
4. Wait for timer to expire or manually quit
5. Open TikTok (different monitored app)
6. Observe behavior

**Expected Results:**
- ✅ First app: Quick Task dialog appears (quota = 1)
- ✅ After usage: Logs show quota sync to Native
- ✅ Second app: No Quick Task dialog (quota = 0)
- ✅ Second app: Intervention starts immediately

**Logs to Check:**
```
[QuickTask] Phase transition: DECISION → ACTIVE
[Decision Engine] ✅ Synced quota to Native: 0
[AppMonitorModule] 📊 Quick Task quota updated: 0
... (later) ...
[ForegroundDetection] ❌ DECISION: Quick Task not available (quota exhausted)
```

**Red Flags:**
- ❌ Second app shows Quick Task dialog (Native using stale quota)
- ❌ No quota sync logs
- ❌ Native quota not updated

---

### Scenario 7: App Startup Quota Sync

**Purpose:** Verify quota syncs on app startup

**Steps:**
1. Use Quick Task (quota = 0)
2. Force kill BreakLoop app completely
3. Restart BreakLoop app
4. Check logs immediately
5. Open Instagram
6. Observe behavior

**Expected Results:**
- ✅ Logs show `initializeSystemBrain()` on startup
- ✅ Logs show quota synced to Native
- ✅ Instagram opens with NO Quick Task dialog (quota = 0)
- ✅ Intervention starts immediately

**Logs to Check:**
```
[System Brain] Initializing...
[Decision Engine] ✅ Synced quota to Native: 0
[System Brain] ✅ Initialization complete
... (later) ...
[ForegroundDetection] ❌ DECISION: Quick Task not available (quota exhausted)
```

**Red Flags:**
- ❌ No initialization logs
- ❌ Native uses default quota (1) instead of actual quota (0)
- ❌ Quick Task dialog appears when it shouldn't

---

## Log Patterns to Monitor

### Good Patterns (Phase 4.1 Working)

```
✅ [ForegroundDetection] DECISION: Quick Task available/not available
✅ [System Brain] QUICK TASK DECISION (COMMAND FROM NATIVE)
✅ [System Brain] EXECUTING NATIVE COMMAND
✅ [Decision Engine] Synced quota to Native
✅ [AppMonitorModule] SystemSurface active: true/false
```

### Bad Patterns (Phase 4.1 Not Working)

```
❌ [Decision Engine] OS Trigger Brain: QUICK_TASK
❌ [Decision Engine] Quick Task suppressed for app entry
❌ [Decision Engine] UNEXPECTED: OS Trigger Brain returned QUICK_TASK in Phase 4.1
❌ Multiple QUICK_TASK_DECISION emissions for same app
❌ SystemSurface launches without "COMMAND FROM NATIVE" log
```

---

## Debugging Tips

### If Quick Task Dialog Doesn't Appear

1. Check Native decision logs:
   - Is quota > 0? (`cachedQuickTaskQuota`)
   - Is timer active? (`hasValidQuickTaskTimer`)
   - Is SystemSurface already active? (`isSystemSurfaceActive`)

2. Check JS event reception:
   - Is `QUICK_TASK_DECISION` event received?
   - Is `handleQuickTaskDecision()` called?
   - Is `launchSystemSurface()` called?

3. Check quota sync:
   - Did `initializeSystemBrain()` run on startup?
   - Did `syncQuotaToNative()` run after last usage?
   - Does Native have correct quota value?

### If App Quits Immediately

1. Check Native guards:
   - Is `isSystemSurfaceActive` stuck as true?
   - Is `lastDecisionApp` stuck with stale value?

2. Check JS command execution:
   - Is `handleQuickTaskDecision()` throwing errors?
   - Is `launchSystemSurface()` failing?

3. Check lifecycle notification:
   - Is `setSystemSurfaceActive(true)` called before launch?
   - Is `setSystemSurfaceActive(false)` called on finish?

### If Duplicate Dialogs Appear

1. Check edge-triggered guards:
   - Are guards being checked? (logs should show "already active" or "already decided")
   - Are guards being reset properly on finish?

2. Check event emission:
   - Is Native emitting multiple `QUICK_TASK_DECISION` events?
   - Is JS calling `handleQuickTaskDecision()` multiple times?

---

## Acceptance Criteria

Phase 4.1 is considered successful when:

1. ✅ All 7 test scenarios pass
2. ✅ No DEPRECATED warnings in logs during normal flow
3. ✅ No "UNEXPECTED" warnings in logs
4. ✅ Quota sync logs appear at correct times
5. ✅ Native decision logs appear for every monitored app entry
6. ✅ JS command execution logs appear for every Native decision

**Final verification:** Open Instagram 5 times in a row. Should see consistent behavior with no regressions.
