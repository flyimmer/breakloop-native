# Test Plan: Intention Timer App Launch Fix

**Date:** January 3, 2026  
**Feature:** Intention timer should launch target app (not home screen)

## Test Environment

- Device: Android (physical or emulator)
- Build: Debug build with logging enabled
- Monitored apps: Instagram, TikTok (or any test apps)

## Test Cases

### ✅ Test Case 1: Intention Timer - 5 Minutes

**Objective:** Verify that selecting a 5-minute intention timer launches Instagram immediately.

**Steps:**
1. Open Instagram from home screen
2. Wait for intervention to trigger
3. Complete breathing countdown (3 seconds)
4. On Root Cause screen, tap "I really need to use it"
5. On Intention Timer screen, tap "5m"

**Expected Results:**
- ✅ Instagram launches immediately (not home screen)
- ✅ User can interact with Instagram
- ✅ No intervention triggers for 5 minutes
- ✅ Console logs show:
  ```
  [IntentionTimer] User selected duration: 5
  [IntentionTimer] Timer set and intervention marked complete
  [IntentionTimer] SET_INTENTION_TIMER dispatched
  [F3.5] Intention timer set - launching target app: com.instagram.android
  [F3.5] Launching monitored app now: com.instagram.android
  ```

**Pass Criteria:**
- Instagram is in foreground after selection
- No home screen appears
- Timer is active (check logs)

---

### ✅ Test Case 2: Intention Timer - 15 Minutes

**Objective:** Verify that different durations work correctly.

**Steps:**
1. Open TikTok from home screen
2. Wait for intervention to trigger
3. Complete breathing countdown
4. Select "I really need to use it"
5. Choose "15m" duration

**Expected Results:**
- ✅ TikTok launches immediately
- ✅ User can use TikTok for 15 minutes
- ✅ Console logs show correct duration and app launch

---

### ✅ Test Case 3: Intention Timer - "Just 1 min"

**Objective:** Verify that the "Just 1 min" option works.

**Steps:**
1. Open Instagram
2. Trigger intervention
3. Complete breathing
4. Select "I really need to use it"
5. Tap "Just 1 min" text at bottom

**Expected Results:**
- ✅ Instagram launches immediately
- ✅ Timer set for 1 minute
- ✅ Intervention triggers after 1 minute

---

### ✅ Test Case 4: Full Intervention Flow (Alternative Activity)

**Objective:** Verify that completing full intervention still returns to home screen.

**Steps:**
1. Open Instagram
2. Trigger intervention
3. Complete breathing countdown
4. Select root causes (e.g., "Boredom", "Anxiety")
5. Tap "Continue"
6. On Alternatives screen, select an alternative activity
7. Complete activity timer (or skip)
8. Complete reflection screen

**Expected Results:**
- ✅ Home screen launches (NOT Instagram)
- ✅ User must manually reopen Instagram
- ✅ Console logs show:
  ```
  [F3.5] Intention timer set: false
  [F3.5] Scheduling home screen launch after intervention completion
  [F3.5] Launching home screen now
  ```

**Pass Criteria:**
- Home screen is in foreground
- Instagram is NOT launched automatically
- Next Instagram open triggers new intervention

---

### ✅ Test Case 5: Intention Timer Expiration

**Objective:** Verify that intervention triggers after timer expires.

**Steps:**
1. Open Instagram
2. Set 1-minute intention timer ("Just 1 min")
3. Use Instagram for 1 minute
4. Wait for timer to expire (check logs every 5 seconds)
5. Continue using Instagram

**Expected Results:**
- ✅ After 1 minute, intervention triggers
- ✅ User must complete new intervention or set new timer
- ✅ Console logs show:
  ```
  [OS Trigger Brain] Intention timer expired — intervention required
  [OS Trigger Brain] BEGIN_INTERVENTION dispatched
  ```

---

### ✅ Test Case 6: App Switch During Intention Timer

**Objective:** Verify that switching apps doesn't affect intention timer.

**Steps:**
1. Open Instagram
2. Set 5-minute intention timer
3. Use Instagram for 2 minutes
4. Switch to TikTok (different monitored app)
5. Return to Instagram after 1 minute

**Expected Results:**
- ✅ TikTok triggers its own intervention (separate from Instagram)
- ✅ Instagram timer continues counting down
- ✅ Returning to Instagram within 5 minutes: No intervention
- ✅ Returning to Instagram after 5 minutes: New intervention

---

### ✅ Test Case 7: Cancel Intervention (Back Button)

**Objective:** Verify that canceling intervention returns to home screen.

**Steps:**
1. Open Instagram
2. Trigger intervention
3. Complete breathing
4. On Root Cause screen, press Android back button (or close button)

**Expected Results:**
- ✅ Home screen launches (NOT Instagram)
- ✅ Intervention is canceled
- ✅ Console logs show:
  ```
  [F3.5] Was canceled: true
  [F3.5] Scheduling home screen launch after intervention completion
  ```

---

### ✅ Test Case 8: Multiple Apps with Intention Timers

**Objective:** Verify that each app has independent intention timer.

**Steps:**
1. Open Instagram, set 5-minute timer
2. Instagram launches, use for 1 minute
3. Switch to TikTok (triggers intervention)
4. Set 15-minute timer for TikTok
5. TikTok launches, use for 1 minute
6. Switch back to Instagram

**Expected Results:**
- ✅ Instagram timer: 4 minutes remaining (independent)
- ✅ TikTok timer: 14 minutes remaining (independent)
- ✅ Each app tracks its own timer
- ✅ No cross-app interference

---

## Regression Tests

### ✅ Regression 1: Quick Task Still Works

**Steps:**
1. Open Instagram (first time today)
2. Quick Task dialog appears
3. Tap "Quick Task"
4. Select duration (e.g., 3 min)

**Expected Results:**
- ✅ Instagram launches immediately
- ✅ Quick Task timer is active
- ✅ No intervention for 3 minutes

---

### ✅ Regression 2: Alternative Activity Timer

**Steps:**
1. Open Instagram
2. Complete intervention flow
3. Select alternative activity
4. Start activity timer

**Expected Results:**
- ✅ Activity timer screen appears
- ✅ Timer counts down correctly
- ✅ Reflection screen appears after completion

---

## Console Log Verification

### Intention Timer Set (Expected Logs)

```
[IntentionTimer] User selected duration: 5
[IntentionTimer] Timer set and intervention marked complete
[IntentionTimer] SET_INTENTION_TIMER dispatched
[Intervention Reducer] Action: SET_INTENTION_TIMER
[F3.5 Debug] useEffect triggered: {
  state: 'idle',
  intentionTimerSet: true,
  targetApp: 'com.instagram.android'
}
[F3.5] Intention timer set - launching target app: com.instagram.android
[F3.5] Launching monitored app now: com.instagram.android
```

### Full Intervention Completed (Expected Logs)

```
[Intervention Reducer] Action: FINISH_REFLECTION
[F3.5 Debug] useEffect triggered: {
  state: 'idle',
  intentionTimerSet: false,
  targetApp: null
}
[F3.5] Scheduling home screen launch after intervention completion
[F3.5] Launching home screen now
```

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: 5-min timer | ⏳ Pending | |
| TC2: 15-min timer | ⏳ Pending | |
| TC3: Just 1 min | ⏳ Pending | |
| TC4: Full intervention | ⏳ Pending | |
| TC5: Timer expiration | ⏳ Pending | |
| TC6: App switch | ⏳ Pending | |
| TC7: Cancel intervention | ⏳ Pending | |
| TC8: Multiple timers | ⏳ Pending | |
| Regression 1: Quick Task | ⏳ Pending | |
| Regression 2: Activity Timer | ⏳ Pending | |

## Sign-off

- [ ] All test cases passed
- [ ] No regressions found
- [ ] Console logs verified
- [ ] Ready for production

**Tester:** _________________  
**Date:** _________________
