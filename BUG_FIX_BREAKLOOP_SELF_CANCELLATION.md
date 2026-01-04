# Bug Fix: Intervention Self-Cancellation When BreakLoop Comes to Foreground

**Date:** January 5, 2026  
**Status:** ✅ FIXED  
**Severity:** CRITICAL - Interventions disappear, breathing screen stuck at 0

---

## Problem Description

When opening a monitored app (Instagram, Twitter, TikTok), the intervention starts normally (breathing screen, root cause screen), but then suddenly disappears and the user can use the app normally. When reopening the app, the breathing screen is stuck at 0 and doesn't progress.

**What Happened:**
1. User opens Instagram
2. Intervention starts (breathing screen shows)
3. BreakLoop app comes to foreground (to display intervention UI)
4. JavaScript detects: "Instagram exited, BreakLoop entered"
5. **BUG:** Thinks user "switched away" from Instagram
6. Cancels Instagram's incomplete intervention
7. Intervention disappears, Instagram becomes usable
8. On reopen: Breathing screen stuck at 0 (intervention was cancelled)

**Root Cause:**
The incomplete intervention cancellation logic (added to handle launcher switches) was also cancelling interventions when BreakLoop itself came to foreground!

BreakLoop was NOT in the launcher filtering list, so it was treated as a "meaningful app switch" that should cancel interventions.

---

## The Solution

Add BreakLoop's package name (`com.anonymous.breakloopnative`) to the `LAUNCHER_PACKAGES` set, so it's treated as a "non-meaningful app" for intervention purposes, just like launchers.

### Why This Makes Sense

BreakLoop is the intervention UI itself:
- It's NOT a "real" app switch (user didn't choose to open another app)
- It's part of the intervention flow (showing breathing, root cause, alternatives, etc.)
- It should be transparent to the intervention logic

Just like launchers are ignored because they're transitional (Instagram → Launcher → Twitter), BreakLoop should be ignored because it's the intervention UI (Instagram → BreakLoop intervention UI).

---

## Implementation Details

### File: `src/os/osTriggerBrain.ts`

**Added BreakLoop to LAUNCHER_PACKAGES:**

```typescript
const LAUNCHER_PACKAGES = new Set([
  'com.android.launcher',           // AOSP launcher
  'com.android.launcher3',          // Pixel launcher
  'com.google.android.launcher',    // Google launcher
  'com.hihonor.android.launcher',   // Honor launcher
  'com.huawei.android.launcher',    // Huawei launcher
  'com.miui.home',                  // Xiaomi MIUI launcher
  'com.samsung.android.app.launcher', // Samsung One UI launcher
  'com.oppo.launcher',              // OPPO ColorOS launcher
  'com.vivo.launcher',              // Vivo launcher
  'com.oneplus.launcher',           // OnePlus launcher
  'com.teslacoilsw.launcher',       // Nova Launcher
  'com.microsoft.launcher',         // Microsoft Launcher
  'com.actionlauncher.playstore',   // Action Launcher
  'com.anonymous.breakloopnative',  // BreakLoop itself (intervention UI) ← NEW
]);
```

**Updated comment to explain BreakLoop filtering:**

```typescript
/**
 * Launcher packages and BreakLoop itself.
 * These apps are NOT treated as "meaningful apps" for intervention logic.
 * 
 * WHY FILTER LAUNCHERS?
 * - On OEM devices, launchers briefly regain focus during app transitions
 * - Launchers don't represent user intent to engage with content
 * - We only want to trigger interventions for actual app usage
 * 
 * WHY FILTER BREAKLOOP ITSELF?
 * - BreakLoop is the intervention UI (breathing screen, root cause, etc.)
 * - When intervention starts, BreakLoop comes to foreground to show UI
 * - This should NOT be treated as "user switched away from monitored app"
 * - Without filtering, intervention would cancel itself when UI appears!
 * 
 * Example without BreakLoop filtering:
 *   Instagram → BreakLoop (intervention UI) → Cancels Instagram intervention (WRONG!)
 * 
 * With BreakLoop filtering:
 *   Instagram → [BreakLoop ignored] → Intervention continues (CORRECT!)
 */
```

---

## How It Works After Fix

### Before Fix (BROKEN)

```
1. User opens Instagram
2. Intervention starts (breathing screen)
3. BreakLoop comes to foreground
4. Event: Instagram → BreakLoop
5. Cancellation check: lastMeaningfulApp (Instagram) !== BreakLoop
6. hasIncompleteIntervention(Instagram) = true
7. ❌ Cancels intervention
8. Intervention disappears
9. On reopen: Breathing screen stuck at 0
```

### After Fix (CORRECT)

```
1. User opens Instagram
2. Intervention starts (breathing screen)
3. BreakLoop comes to foreground
4. Event: Instagram → BreakLoop
5. isLauncher(BreakLoop) = true (now includes BreakLoop)
6. ✅ Returns early, doesn't update lastMeaningfulApp
7. lastMeaningfulApp STILL = Instagram
8. Intervention continues normally
9. User can complete intervention flow
```

---

## Flow Diagrams

### Intervention Start Flow (After Fix)

```
User opens Instagram
  ↓
Kotlin: Instagram comes to foreground
  ↓
Kotlin: Launches SystemSurfaceActivity (BreakLoop)
  ↓
JavaScript: Receives event "Instagram → BreakLoop"
  ↓
JavaScript: isLauncher(BreakLoop) = true
  ↓
JavaScript: Returns early (ignores BreakLoop)
  ↓
lastMeaningfulApp = Instagram (unchanged)
  ↓
Intervention continues normally
  ↓
User sees breathing screen, root cause screen, etc.
```

### User Actually Switches Apps (Still Works)

```
User on Instagram (breathing screen)
  ↓
User switches to Twitter
  ↓
JavaScript: Receives event "Instagram → Twitter"
  ↓
JavaScript: isLauncher(Twitter) = false
  ↓
JavaScript: Cancellation check runs
  ↓
hasIncompleteIntervention(Instagram) = true
  ↓
Cancels Instagram intervention ✅
  ↓
Starts Twitter intervention
```

---

## Testing Scenarios

### Test 1: Open Instagram → Complete intervention
**Before Fix:**
- Open Instagram → Breathing screen → Intervention disappears ❌
- Breathing screen stuck at 0 on reopen ❌

**After Fix:**
- Open Instagram → Breathing screen → Root Cause screen → Alternatives ✅
- Can complete full intervention flow ✅

### Test 2: Open Instagram → Switch to Twitter
**Before and After (Should work the same):**
- Open Instagram → Breathing screen
- Switch to Twitter
- Instagram intervention cancelled ✅
- Twitter intervention starts ✅

### Test 3: Breathing screen stuck at 0
**Before Fix:**
- Happened because intervention was cancelled
- Screen showed "0" but didn't progress ❌

**After Fix:**
- Won't happen anymore
- Breathing countdown works normally ✅

---

## Key Insights

### The Three-Layer Fix

This bug fix is the third layer of the incomplete intervention cancellation system:

1. **Layer 1:** Emit events for ALL apps (including launchers)
   - Fixed: Kotlin now emits launcher events to JavaScript

2. **Layer 2:** Cancel incomplete interventions when user switches away
   - Fixed: JavaScript cancels interventions when switching to another app

3. **Layer 3:** Don't cancel when BreakLoop comes to foreground
   - **This fix:** BreakLoop is now filtered like launchers

### Why This Bug Happened

The incomplete intervention cancellation feature (Layer 2) was working TOO well:
- It correctly cancelled interventions when switching to other apps
- But it also cancelled interventions when BreakLoop came to foreground
- Because BreakLoop wasn't in the filter list

This is a classic case of a fix creating a new bug by being too aggressive.

---

## Files Modified

1. **`src/os/osTriggerBrain.ts`**
   - Added `'com.anonymous.breakloopnative'` to LAUNCHER_PACKAGES
   - Updated comment to explain BreakLoop filtering
   - No logic changes (reuses existing launcher filtering)

---

## Related Fixes

This fix builds on previous fixes:

1. **Launcher Incomplete Intervention Fix** (Earlier today)
   - Made Kotlin emit events for ALL apps (including launchers)
   - Added incomplete intervention cancellation logic

2. **Home Screen Launch Fix** (Earlier today)
   - Added `wasCompleted` flag to distinguish cancelled vs completed interventions
   - Fixed home screen launching for cancelled interventions

3. **This Fix: BreakLoop Self-Cancellation**
   - Prevents BreakLoop from cancelling its own interventions
   - Completes the incomplete intervention cancellation system

Together, these three fixes ensure:
- ✅ Incomplete interventions are cancelled when user switches away
- ✅ Cancelled interventions don't launch home screen
- ✅ BreakLoop intervention UI doesn't cancel itself
- ✅ Interventions work normally from start to finish

---

**All implementation completed successfully on January 5, 2026.**
