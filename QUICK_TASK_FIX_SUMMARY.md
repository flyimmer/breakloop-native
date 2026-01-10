# Quick Task Fix Summary - January 10, 2026

## Bug Fixed

**Issue:** After Quick Task timer expired, the Quick Task dialog appeared again instead of POST_QUICK_TASK_CHOICE screen.

**Root Cause:** Defensive guard in `handleTimerExpiration()` used wrong condition to detect Phase A (dialog) vs Phase B (usage).

## The Fix

### Changed File
- `src/systemBrain/eventHandler.ts` (lines 146-159)

### What Was Removed
43 lines of incorrect defensive guard logic that checked for flags that don't exist yet:

```typescript
// WRONG
if (!hasExpiredFlag && !hasOverride) {
  // Assumes Phase A, ignores expiration
}
```

### What Was Added
Simple, correct logic that relies on timer existence as the phase marker:

```typescript
// CORRECT
// Valid expiration of active Quick Task usage (Phase B)
// Timer existence proves user clicked "Quick Task" button
// Phase A (dialog) has no timer by definition
delete state.quickTaskTimers[packageName];
```

## Key Insight

**Timer existence IS the phase marker:**
- Phase A (dialog): NO timer exists
- Phase B (usage): Timer exists

Therefore, if we detect a timer expiration, it's always Phase B (legitimate expiration).

## Expected Behavior After Fix

1. User opens Instagram → Quick Task dialog appears
2. User clicks "Quick Task" → returns to Instagram, timer starts
3. User stays in Instagram until timer expires (2 minutes)
4. ✅ **POST_QUICK_TASK_CHOICE screen appears**
5. ✅ **Quick Task dialog does NOT reappear**

## Testing Instructions

1. Open a monitored app (Instagram, XHS, TikTok, or Twitter)
2. Quick Task dialog should appear
3. Click "Quick Task" button
4. Stay in the app for the full duration (2 minutes)
5. Verify POST_QUICK_TASK_CHOICE screen appears with:
   - "Quick Task finished" message
   - "Continue using" button
   - "Go Home" button
6. Verify Quick Task dialog does NOT reappear

## Files Modified

- `src/systemBrain/eventHandler.ts` - Removed defensive guard, simplified Phase B logic

## Files Created

- `QUICK_TASK_PHASE_DETECTION_FIX.md` - Detailed documentation of the fix
- `QUICK_TASK_FIX_SUMMARY.md` - This summary file

## Related Previous Fixes

1. **QUICK_TASK_PHASE_BUG_FIX.md** - Fixed timer starting during dialog (Phase A)
   - Added defensive guard to prevent timer expiration during dialog
   - Guard was too aggressive and blocked legitimate expirations

2. **This Fix** - Fixed defensive guard blocking legitimate expirations (Phase B)
   - Removed incorrect guard logic
   - Simplified to rely on timer existence as phase marker

## Architectural Principle Established

> **Never infer phase from absence of state flags.**  
> **Always use explicit markers (like timer existence).**

This principle applies to all state machine logic in the codebase.
