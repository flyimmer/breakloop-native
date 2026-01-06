# Testing Guide: Notification Shade Fix

**Fix**: Intervention sessions now survive notification shade interactions  
**Date**: January 6, 2026  
**Status**: ✅ Implementation Complete - Ready for Testing

## Quick Start

```bash
# Build and deploy to device
npm run android
```

## What Changed

The `isBreakLoopInfrastructure()` function in `app/roots/SystemSurfaceRoot.tsx` now treats `com.android.systemui` as a non-behavioral foreground transition, so pulling down the notification shade no longer ends the intervention session.

## Testing Checklist

### ✅ Test 1: Notification Shade During Root Cause Screen

**Steps:**
1. Open Instagram (or any monitored app)
2. Quick Task dialog appears → Click "Conscious Process"
3. Wait for breathing countdown (5 seconds)
4. You should now be on the **Root Cause Selection** screen
5. **Pull down the notification shade** (swipe from top)
6. **Swipe up to dismiss** the notification shade

**Expected Result:**
- ✅ You return to the **Root Cause Selection** screen
- ❌ You should NOT be sent to home screen
- ✅ Intervention session is still active

**Previous Behavior (Bug):**
- ❌ User was sent to home screen
- ❌ Intervention session ended

---

### ✅ Test 2: Notification Shade at Different Intervention Stages

Test at EACH of these stages:

#### Stage A: Breathing Screen
1. Open Instagram → intervention starts
2. While on breathing countdown screen, pull down notification shade
3. Dismiss notification shade
4. **Expected**: Return to breathing screen, countdown continues

#### Stage B: Root Cause Selection
1. Open Instagram → complete breathing
2. On root cause screen, pull down notification shade
3. Dismiss notification shade
4. **Expected**: Return to root cause screen, selections preserved

#### Stage C: Alternatives Screen
1. Open Instagram → complete breathing → select root causes
2. On alternatives screen, pull down notification shade
3. Dismiss notification shade
4. **Expected**: Return to alternatives screen

#### Stage D: Action Confirmation
1. Open Instagram → complete breathing → select root causes → select alternative
2. On action confirmation screen, pull down notification shade
3. Dismiss notification shade
4. **Expected**: Return to action confirmation screen

---

### ✅ Test 3: Quick Settings Panel

**Steps:**
1. Open Instagram → intervention starts
2. On any intervention screen, **pull down notification shade twice** (opens quick settings)
3. Dismiss quick settings

**Expected Result:**
- ✅ Return to intervention screen
- ✅ Intervention session still active

---

### ✅ Test 4: Notification Shade During Quick Task Dialog

**Steps:**
1. Open Instagram
2. Quick Task dialog appears
3. **Pull down notification shade** (don't click any button)
4. Dismiss notification shade

**Expected Result:**
- ✅ Return to Quick Task dialog
- ✅ Dialog still showing with "Quick Task" and "Conscious Process" buttons

---

### ⚠️ Test 5: Actually Opening a Notification (Should Still End Intervention)

**This is the critical test to ensure we didn't break the intended behavior!**

**Steps:**
1. Send yourself a test notification (e.g., WhatsApp message, email, etc.)
2. Open Instagram → intervention starts
3. Complete breathing → reach root cause screen
4. Pull down notification shade
5. **Tap on the notification** to open WhatsApp (or other app)

**Expected Result:**
- ✅ Intervention session ENDS (this is correct behavior)
- ✅ You are now in WhatsApp (the app you opened)
- ❌ You should NOT be in Instagram
- ❌ You should NOT see intervention screen

**Rationale:**
- Opening a notification = real app switch = user chose to leave
- Only pulling down the shade (without opening anything) should preserve intervention

---

### ✅ Test 6: Multiple Notification Shade Interactions

**Steps:**
1. Open Instagram → intervention starts
2. Pull down notification shade → dismiss
3. Wait 2 seconds
4. Pull down notification shade again → dismiss
5. Wait 2 seconds
6. Pull down notification shade → open quick settings → dismiss

**Expected Result:**
- ✅ Intervention survives all interactions
- ✅ You stay on the same intervention screen throughout

---

## Edge Cases to Watch For

### 🔍 Edge Case 1: Notification Arrives During Intervention

**Scenario:**
1. Open Instagram → intervention starts
2. While on root cause screen, a new notification arrives (notification sound/banner)
3. **Don't interact with it**
4. Continue with intervention

**Expected:**
- ✅ Notification banner appears briefly
- ✅ Intervention continues normally
- ✅ You can complete intervention

### 🔍 Edge Case 2: Multiple Notifications

**Scenario:**
1. Open Instagram → intervention starts
2. Pull down notification shade
3. See multiple notifications in the shade
4. **Don't tap any** → dismiss shade

**Expected:**
- ✅ Return to intervention screen
- ✅ Intervention still active

### 🔍 Edge Case 3: Notification Shade + Home Button

**Scenario:**
1. Open Instagram → intervention starts
2. Pull down notification shade
3. Press home button (instead of dismissing shade)

**Expected:**
- ✅ Intervention ends (user chose to go home)
- ✅ You are on home screen

---

## Verification Logs

When testing, watch for these log messages:

### ✅ Good Logs (Notification Shade Ignored)

```
LOG  [SystemSession] Foreground app changed: com.android.systemui
LOG  [SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

**No** `🚨 Intervention Session ended` message should appear!

### ❌ Bad Logs (Bug Not Fixed)

```
LOG  [SystemSession] Foreground app changed: com.android.systemui
LOG  [SystemSurfaceRoot] 🚨 Intervention Session ended - user left app
LOG  [SystemSession] dispatchSystemEvent: {"type": "END_SESSION"}
```

If you see this, the fix didn't work!

### ✅ Good Logs (Real App Switch)

When you actually open a notification:

```
LOG  [SystemSession] Foreground app changed: com.whatsapp
LOG  [SystemSurfaceRoot] 🚨 Intervention Session ended - user left app
LOG  [SystemSession] dispatchSystemEvent: {"type": "END_SESSION"}
```

This is correct! Opening WhatsApp should end the intervention.

---

## Troubleshooting

### Issue: Intervention still ends when pulling down notification shade

**Possible causes:**
1. Code not deployed - rebuild with `npm run android`
2. App not fully restarted - force stop and reopen
3. Cache issue - try `npm run android --reset-cache`

### Issue: Intervention doesn't end when opening a notification

**This would be a regression!** The fix should only affect `com.android.systemui`, not actual app switches.

**Debug steps:**
1. Check logs - what package name is detected?
2. Verify the notification actually opened a different app
3. Report the issue with logs

---

## Success Criteria

All tests pass when:

✅ Notification shade interactions preserve intervention  
✅ Quick settings interactions preserve intervention  
✅ Status bar interactions preserve intervention  
✅ Actually opening notifications still ends intervention correctly  
✅ No regressions in other intervention flows  

---

## Reporting Results

After testing, please report:

1. **Which tests passed** ✅
2. **Which tests failed** ❌
3. **Any unexpected behavior**
4. **Relevant log snippets** (if issues found)

---

## Next Steps After Testing

Once all tests pass:

1. Mark testing todos as complete
2. Consider testing on different Android versions (if available)
3. Consider testing on different OEM devices (Samsung, Xiaomi, etc.)
4. Monitor for any related issues in production use

---

## Related Files

- `app/roots/SystemSurfaceRoot.tsx` - The fix
- `docs/NOTIFICATION_SHADE_FIX.md` - Technical documentation
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - Architecture reference
