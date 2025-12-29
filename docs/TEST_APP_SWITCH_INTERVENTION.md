# Test Plan: App Switch During Intervention

## Quick Test Checklist

Use this checklist to verify the app-switch intervention fix works correctly.

### Prerequisites

- [ ] Instagram configured as monitored app
- [ ] TikTok configured as monitored app  
- [ ] App built and installed on Android device
- [ ] Accessibility service enabled
- [ ] USB debugging connected for log viewing

### Test Case 1: Switch During Root Cause Selection

**Steps:**
1. Open Instagram
2. Wait for breathing countdown to complete
3. Root Cause screen appears
4. Select "Boredom" (do NOT click Continue)
5. Press Home button
6. Open TikTok

**Expected Results:**
- [ ] New breathing countdown starts for TikTok
- [ ] After breathing, Root Cause screen shows NO selected causes
- [ ] App name in UI shows "TikTok" (not Instagram)
- [ ] Log shows: `Clearing previous intervention(s) for app switch`

**Actual Results:**
```
Date tested: ___________
Result: PASS / FAIL
Notes:


```

---

### Test Case 2: Switch During Breathing Countdown

**Steps:**
1. Open Instagram
2. Breathing countdown starts (e.g., at 3 seconds)
3. Wait 1 second (countdown at 2 seconds)
4. Press Home button
5. Open TikTok

**Expected Results:**
- [ ] Breathing countdown RESTARTS from beginning for TikTok
- [ ] Countdown does NOT continue from where Instagram left off
- [ ] App name shows "TikTok"
- [ ] Log shows app switch event

**Actual Results:**
```
Date tested: ___________
Result: PASS / FAIL
Notes:


```

---

### Test Case 3: Rapid App Switching

**Steps:**
1. Open Instagram → Breathing starts
2. Immediately switch to TikTok → New breathing starts
3. Immediately switch back to Instagram → New breathing starts again

**Expected Results:**
- [ ] Each switch triggers a fresh intervention
- [ ] No state carries over between switches
- [ ] Each app shows correct name in UI
- [ ] Logs show multiple "Clearing previous intervention" messages

**Actual Results:**
```
Date tested: ___________
Result: PASS / FAIL
Notes:


```

---

### Test Case 4: Switch During Alternatives Browsing

**Steps:**
1. Open Instagram
2. Complete breathing countdown
3. Select root causes (e.g., "Boredom", "Anxiety")
4. Click Continue → Alternatives screen appears
5. Browse alternatives (do NOT select one)
6. Press Home button
7. Open TikTok

**Expected Results:**
- [ ] TikTok intervention starts fresh from breathing
- [ ] After completing TikTok breathing + root cause, alternatives shown are based on TikTok's root causes (not Instagram's)
- [ ] No alternatives from Instagram intervention are pre-selected

**Actual Results:**
```
Date tested: ___________
Result: PASS / FAIL
Notes:


```

---

### Test Case 5: Switch During Action Timer

**Steps:**
1. Open Instagram
2. Complete full intervention flow
3. Select an alternative activity
4. Start the action timer (e.g., "Take a walk - 10 minutes")
5. Timer is running (e.g., at 8 minutes remaining)
6. Press Home button
7. Open TikTok

**Expected Results:**
- [ ] Instagram timer is ABANDONED (does NOT continue)
- [ ] TikTok intervention starts fresh from breathing
- [ ] No timer state carries over to TikTok

**Actual Results:**
```
Date tested: ___________
Result: PASS / FAIL
Notes:


```

---

## Log Verification

### Expected Log Pattern

When switching from Instagram to TikTok during an active intervention:

```
[OS Trigger Brain] Monitored app entered foreground: {
  packageName: 'com.zhiliaoapp.musically',
  timestamp: 1735478400000
}

[OS Trigger Brain] Clearing previous intervention(s) for app switch {
  oldApps: ['com.instagram.android'],
  newApp: 'com.zhiliaoapp.musically'
}

[OS Trigger Brain] BEGIN_INTERVENTION dispatched {
  packageName: 'com.zhiliaoapp.musically',
  timestamp: 1735478400000,
  time: '2024-12-29T12:00:00.000Z'
}
```

### Log Checklist

- [ ] "Clearing previous intervention(s)" message appears
- [ ] Old app package name listed in `oldApps`
- [ ] New app package name in `newApp`
- [ ] "BEGIN_INTERVENTION dispatched" for new app
- [ ] No errors or warnings in logs

---

## Regression Testing

Verify existing functionality still works:

### Normal Intervention Flow (No App Switch)

**Steps:**
1. Open Instagram
2. Complete breathing countdown
3. Select root causes
4. Click Continue
5. Browse alternatives
6. Select an alternative
7. Complete the activity
8. Complete reflection

**Expected Results:**
- [ ] Full flow completes without issues
- [ ] No unexpected resets
- [ ] State persists correctly throughout flow

---

### Intention Timer Behavior

**Steps:**
1. Open Instagram
2. Complete full intervention (set intention timer)
3. Exit Instagram
4. Wait for intention timer to expire
5. Re-open Instagram

**Expected Results:**
- [ ] New intervention triggers (timer expired)
- [ ] Intervention starts fresh (no old state)

---

## Edge Cases

### Multiple Rapid Switches

**Scenario:** Instagram → TikTok → YouTube → Instagram (all within 10 seconds)

**Expected:**
- [ ] Each switch triggers fresh intervention
- [ ] No crashes or errors
- [ ] UI always shows correct app name

### Switch to Non-Monitored App

**Scenario:** Instagram (intervention active) → Chrome (not monitored)

**Expected:**
- [ ] Instagram intervention remains active
- [ ] Chrome does NOT trigger intervention
- [ ] Returning to Instagram continues or restarts based on intention timer

### Switch During Reflection

**Scenario:** Instagram (reflection screen) → TikTok

**Expected:**
- [ ] TikTok triggers new intervention
- [ ] Instagram reflection is abandoned
- [ ] No crash or state corruption

---

## Test Environment

**Device:** _________________  
**Android Version:** _________________  
**App Version:** _________________  
**Test Date:** _________________  
**Tester:** _________________  

---

## Notes

Use this section for any additional observations, bugs found, or suggestions:

```




```

---

## Sign-Off

- [ ] All test cases passed
- [ ] No regressions found
- [ ] Logs verified
- [ ] Ready for production

**Signed:** _________________  
**Date:** _________________

