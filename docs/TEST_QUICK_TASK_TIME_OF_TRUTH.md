# Test Plan: Quick Task Time-of-Truth Fix

## Overview

This test plan verifies the fix for the time-of-truth vs time-of-evaluation bug in Quick Task expiration logic.

**Bug Fixed:** System was checking "where is the user now" instead of "where was the user at the exact moment the timer expired."

## Prerequisites

1. Build and install the app with the fix
2. Configure Quick Task settings:
   - Duration: 2 minutes (for faster testing)
   - Uses per window: 1 or 2
3. Add Instagram (or any monitored app) to monitored apps list
4. Enable detailed logging in terminal

## Test Scenarios

### ✅ Test 1: Foreground Expiration (Primary Bug Fix)

**Objective:** Verify POST_QUICK_TASK_CHOICE appears when timer expires while user is on the app.

**Steps:**
1. Open Instagram
2. Quick Task dialog appears → Select "Quick Task" (2 min)
3. During the 2 minutes:
   - Go to Home screen (wait 10 seconds)
   - Return to Instagram (wait 10 seconds)
   - Go to Home screen again (wait 10 seconds)
   - Return to Instagram
4. Wait for timer to expire while on Instagram

**Expected Result:**
- ✅ POST_QUICK_TASK_CHOICE screen appears
- ✅ Shows two options: "Conscious Process" and "Quick Task" (if available)
- ✅ Quick Task dialog does NOT appear

**Log Verification:**
```
[SystemBrain] TIMER_EXPIRED captured foreground
  packageName: "com.instagram.android"
  foregroundAtExpiration: "com.instagram.android"

[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground)
  Captured foreground at expiration:
    foregroundAppAtExpiration: "com.instagram.android"
```

**Previous Bug:** Quick Task dialog appeared instead of POST_QUICK_TASK_CHOICE

---

### ✅ Test 2: Background Expiration (Should Still Work)

**Objective:** Verify silent cleanup when timer expires while user is NOT on the app.

**Steps:**
1. Open Instagram
2. Quick Task dialog appears → Select "Quick Task" (2 min)
3. Immediately switch to a different app (e.g., Chrome, not Home)
4. Stay in Chrome for 2+ minutes until timer expires
5. Return to Instagram

**Expected Result:**
- ✅ No POST_QUICK_TASK_CHOICE screen
- ✅ Quick Task dialog appears OR Intervention flow starts (based on n_quickTask quota)
- ✅ Normal OS Trigger Brain evaluation

**Log Verification:**
```
[SystemBrain] TIMER_EXPIRED captured foreground
  packageName: "com.instagram.android"
  foregroundAtExpiration: "com.android.chrome"  // Different app!

[QuickTask] User already left app - no enforcement needed
  foregroundAtExpiration: "com.android.chrome"
```

---

### ✅ Test 3: Rapid App Switching During Timer

**Objective:** Verify deterministic behavior with rapid app switching.

**Steps:**
1. Open Instagram
2. Quick Task dialog appears → Select "Quick Task" (2 min)
3. Rapidly switch between apps:
   - Instagram → Home → Instagram → Home → Instagram (repeat)
   - Continue this pattern until timer expires
4. Note which app you're on when timer expires

**Expected Result:**
- ✅ If on Instagram at expiration: POST_QUICK_TASK_CHOICE
- ✅ If on Home at expiration: Silent cleanup, normal flow on next Instagram entry
- ✅ Behavior is deterministic based on foreground app at expiration moment

**Log Verification:**
```
[SystemBrain] TIMER_EXPIRED captured foreground
  foregroundAtExpiration: <app at expiration time>

// If Instagram:
[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground)

// If Home:
[QuickTask] User already left app - no enforcement needed
```

---

### ✅ Test 4: Edge Case - Home Screen Expiration

**Objective:** Verify correct handling when timer expires on Home screen.

**Steps:**
1. Open Instagram
2. Quick Task dialog appears → Select "Quick Task" (2 min)
3. Go to Home screen
4. Stay on Home screen until timer expires (2+ minutes)
5. Open Instagram again

**Expected Result:**
- ✅ No POST_QUICK_TASK_CHOICE screen
- ✅ Quick Task dialog appears OR Intervention flow starts
- ✅ Normal OS Trigger Brain evaluation

**Log Verification:**
```
[SystemBrain] TIMER_EXPIRED captured foreground
  packageName: "com.instagram.android"
  foregroundAtExpiration: "com.hihonor.android.launcher"  // Home screen

[QuickTask] User already left app - no enforcement needed
```

---

### ✅ Test 5: Multiple Quick Tasks (Quota Testing)

**Objective:** Verify time-of-truth capture works across multiple Quick Task uses.

**Steps:**
1. Configure: Uses per window = 2
2. Open Instagram → Quick Task (2 min) → Expire on Instagram
3. POST_QUICK_TASK_CHOICE → Select "Quick Task" again
4. Second Quick Task → Expire on Instagram
5. POST_QUICK_TASK_CHOICE → No Quick Task option (quota exhausted)

**Expected Result:**
- ✅ First expiration: POST_QUICK_TASK_CHOICE with Quick Task option
- ✅ Second expiration: POST_QUICK_TASK_CHOICE with only "Conscious Process"
- ✅ Quota correctly enforced across multiple uses

---

### ✅ Test 6: State Persistence (Kill-Safety)

**Objective:** Verify captured foreground app persists across app restarts.

**Steps:**
1. Open Instagram
2. Quick Task dialog appears → Select "Quick Task" (2 min)
3. During timer: Go Home → Return to Instagram
4. Timer expires on Instagram
5. **Force kill the app** (swipe away from recent apps)
6. Reopen Instagram

**Expected Result:**
- ✅ POST_QUICK_TASK_CHOICE screen appears after reopening
- ✅ Captured foreground app persisted correctly
- ✅ No data loss from force kill

**Log Verification:**
```
// After app restart:
[System Brain] State loaded from storage:
  expiredQuickTasks: {
    "com.instagram.android": {
      expiredAt: <timestamp>,
      expiredWhileForeground: true,
      foregroundAppAtExpiration: "com.instagram.android"
    }
  }
```

---

## Regression Testing

### Test 7: Intention Timer (Should Not Be Affected)

**Steps:**
1. Complete full intervention flow
2. Set intention timer (e.g., 5 minutes)
3. During intention timer: Switch apps, go Home, return
4. Wait for intention timer to expire

**Expected Result:**
- ✅ Intention timer behavior unchanged
- ✅ No POST_QUICK_TASK_CHOICE screen for intention expiration
- ✅ Normal intervention flow on next app entry after expiration

---

### Test 8: Normal Intervention Flow (Should Not Be Affected)

**Steps:**
1. Open Instagram (no Quick Task available - quota exhausted)
2. Intervention flow starts immediately

**Expected Result:**
- ✅ Breathing screen → Root Cause → Alternatives → etc.
- ✅ No Quick Task dialog
- ✅ Normal flow unchanged

---

## Log Patterns to Monitor

### ✅ Correct Foreground Capture
```
[System Brain] Foreground app updated:
  current: "com.instagram.android"
  note: "currentForegroundApp captured for time-of-truth"

[SystemBrain] TIMER_EXPIRED captured foreground
  packageName: "com.instagram.android"
  foregroundAtExpiration: "com.instagram.android"
  note: "This is the time-of-truth - will NOT be re-evaluated"
```

### ✅ Correct Decision Engine Priority #1
```
[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground)
  Quick Task expired while user was IN the app
  Captured foreground at expiration:
    foregroundAppAtExpiration: "com.instagram.android"
    note: "Time-of-truth captured at TIMER_EXPIRED"
```

### ❌ Wrong Behavior (Should NOT See)
```
// These patterns indicate the bug is NOT fixed:
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK - launching Quick Task dialog
  // After timer already expired on foreground app

[Decision Engine] Decision: NONE
  // When expiredQuickTasks flag should be set
```

---

## Success Criteria

All tests pass with:
- ✅ POST_QUICK_TASK_CHOICE appears when timer expires on foreground app
- ✅ Silent cleanup when timer expires on background app
- ✅ Deterministic behavior based on foreground app at expiration time
- ✅ State persists correctly across app restarts
- ✅ No regression in intention timer or normal intervention flow
- ✅ Logs show correct time-of-truth capture

---

## Failure Indicators

If any of these occur, the fix is incomplete:
- ❌ Quick Task dialog appears after timer expires on foreground app
- ❌ POST_QUICK_TASK_CHOICE appears when timer expires on background app
- ❌ Behavior changes based on app switching AFTER expiration
- ❌ State lost after app restart
- ❌ Logs show re-evaluation of foreground app

---

**Test Duration:** ~30 minutes  
**Tester:** QA / Developer  
**Date:** January 9, 2026  
**Fix Version:** Time-of-Truth Quick Task Expiration  
