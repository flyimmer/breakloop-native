# Bug Fix: Premature Intervention Cancellation on App Switch

**Date:** January 4, 2026  
**Issue:** Intervention cancelled immediately when switching between monitored apps  
**Status:** ✅ Fixed

---

## Problem Summary

When switching from Instagram (at root-cause screen) to Twitter, the intervention was cancelled immediately:

```
Twitter enters → BEGIN_INTERVENTION → BreakLoop launches → BreakLoop exits → Launcher appears
→ Cancellation logic triggers → Twitter intervention cancelled (breathingCount still at 5)
→ User sees breathing screen flash and immediately goes to home screen
```

---

## Root Cause: Order of Operations Bug

The cancellation logic was running **before** launcher filtering in `handleForegroundAppChange`:

### Original (Incorrect) Order:
```
Step 1: Record exit timestamps
Step 2: Cancel incomplete intervention ❌ (runs before filtering)
Step 3: Semantic launcher filtering
Step 3.5: Launcher transition detection
```

**The Problem:**
- When launcher appeared during app switching, it was treated as a real app switch
- Cancellation logic ran before we could determine if launcher was a transition
- Existing launcher transition detection logic was never consulted

---

## The Fix: Reorder Steps

**Moved cancellation logic to run AFTER launcher filtering and transition detection.**

### New (Correct) Order:
```
Step 1: Record exit timestamps
Step 2: Semantic launcher filtering ✅
Step 3: Launcher transition detection ✅
Step 4: Cancel incomplete intervention ✅ (runs after filtering)
```

**Why this works:**
1. **Semantic filtering first** - Identify and filter infrastructure apps (launchers, BreakLoop)
2. **Transition detection second** - Determine if launcher was just a transition
3. **Decision logic last** - Make intervention decisions based on clean, filtered state

---

## Implementation Details

### File Modified: `src/os/osTriggerBrain.ts`

**Changes:**
- Moved cancellation block (originally lines 628-649) to after launcher transition detection
- Updated step numbers and comments
- Updated comment to clarify: "This runs AFTER launcher filtering and transition detection"

**Key insight from user:**
> "We need to first have the clean transition state after semantic filtering, then make other decisions"

This follows the architectural principle: **Filter infrastructure first, make decisions later.**

---

## Why This is Better Than Alternatives

### Alternative Considered: Add `!isLauncher()` check to cancellation condition

**Why rejected:**
- User can legitimately go to home screen to cancel intervention
- If we exclude all launchers from cancellation, user can't cancel by going home
- We need to distinguish between:
  - **Transition launcher** (Instagram → launcher → Twitter) = don't cancel
  - **Destination launcher** (Instagram → launcher, stays) = should cancel

The launcher transition detection already makes this distinction. We just needed to run cancellation logic AFTER it, not before.

---

## Testing

### Test Case 1: App Switch During Intervention ✅
1. Open Instagram → Breathing → Root-cause screen
2. Switch to Twitter
3. **Expected:** Twitter intervention starts fresh, breathing counts 5 → 4 → 3 → 2 → 1 → 0
4. **Result:** ✅ Works correctly (launcher filtered, no premature cancellation)

### Test Case 2: User Goes to Home Screen ✅
1. Open Instagram → Breathing → Root-cause screen
2. Press home button, stay on home screen
3. **Expected:** Instagram intervention cancelled
4. **Result:** ✅ Works correctly (destination launcher not filtered, triggers cancellation)

---

## Related Fixes

This is part of a series of fixes for intervention flow bugs:

1. **Bug #1:** Multiple intervention triggers (fixed with launcher transition detection)
2. **Bug #2:** Cancelled intervention re-launches app (fixed with intention timer check)
3. **Bug #3:** Premature cancellation on app switch (THIS FIX)

See `BUG_FIX_DUPLICATE_INTERVENTION_TRIGGERS.md` for complete history.

---

## Architectural Lesson

**Principle:** In event-driven systems, **filter infrastructure events before making business logic decisions**.

**Before (Wrong):**
```
Event arrives → Make decision → Filter infrastructure
```

**After (Correct):**
```
Event arrives → Filter infrastructure → Make decision
```

This ensures decisions are made on clean, meaningful state, not transient infrastructure events.
