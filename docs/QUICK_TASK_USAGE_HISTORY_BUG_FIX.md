# Quick Task Usage History Bug Fix

**Date:** January 2, 2026  
**Issue:** Quick Task usage history was incorrectly reset when Quick Task expired, allowing unlimited uses
**Status:** ✅ Fixed

## Problem

### Incorrect Behavior (Before Fix)

When a Quick Task timer expired and the user clicked "Close & Go Home" in `QuickTaskExpiredScreen`, the `resetTrackingState()` function was clearing the global usage history:

```typescript
// WRONG: This was clearing the usage count
export function resetTrackingState(): void {
  // ... other resets ...
  quickTaskUsageHistory.length = 0; // ❌ BUG: Clears usage history
  console.log('[OS Trigger Brain] Tracking state reset (including Quick Task state)');
}
```

### User Impact

**Scenario:**
1. User has 2 Quick Tasks available (maxUses = 2)
2. User opens Instagram → Quick Task dialog shows "2 remaining"
3. User clicks "Quick Task" → Usage recorded (should be 1 remaining now)
4. Timer expires after 10 seconds
5. `QuickTaskExpiredScreen` appears
6. User clicks "Close & Go Home"
7. `resetTrackingState()` is called → **Usage history cleared** ❌
8. User opens Instagram again → Quick Task dialog shows "2 remaining" ❌

**Expected behavior:** Should show "1 remaining" because one use was consumed.

### Root Cause

The `resetTrackingState()` function was designed to reset timers and tracking state, but it was incorrectly also clearing the **usage quota**, which is time-based and should persist for the full 15-minute window.

## Specification

According to the Quick Task specification:

| Feature | Scope | Persistence |
|---------|-------|-------------|
| **Usage Quota** | GLOBAL | Time-based (15-minute rolling window) |
| **Quick Task Timer** | Per-App | Cleared when timer expires |
| **Intention Timer** | Per-App | Cleared by resetTrackingState() |

**Key principle:** Usage quota is **time-based**, not **event-based**. The usage count should only decrease when timestamps naturally expire after 15 minutes, NOT when a Quick Task timer expires.

## Solution

### Fixed Implementation

```typescript
export function resetTrackingState(): void {
  lastForegroundApp = null;
  lastMeaningfulApp = null;
  lastExitTimestamps.clear();
  lastMeaningfulExitTimestamps.clear();
  intentionTimers.clear();
  interventionsInProgress.clear();
  quickTaskTimers.clear();
  // NOTE: Do NOT clear quickTaskUsageHistory!
  // Usage quota is time-based (15-minute rolling window) and should persist
  // until timestamps naturally expire. Clearing it would incorrectly reset
  // the usage count and allow users to bypass the quota limit.
  console.log('[OS Trigger Brain] Tracking state reset (timers cleared, usage history preserved)');
}
```

### What Gets Reset vs Preserved

**Reset (Cleared):**
- ✅ `lastForegroundApp` - Tracking state
- ✅ `lastMeaningfulApp` - Tracking state
- ✅ `lastExitTimestamps` - App exit tracking
- ✅ `lastMeaningfulExitTimestamps` - Meaningful app exit tracking
- ✅ `intentionTimers` - Per-app intention timers
- ✅ `interventionsInProgress` - Intervention tracking flags
- ✅ `quickTaskTimers` - Per-app Quick Task timers

**Preserved (NOT Cleared):**
- ✅ `quickTaskUsageHistory` - Global usage timestamps (time-based quota)

### Usage History Management

The usage history is managed by `getQuickTaskRemaining()`, which automatically filters out expired timestamps:

```typescript
export function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
  const windowMs = getQuickTaskWindowMs(); // 15 minutes
  const maxUses = getQuickTaskUsesPerWindow(); // 2 uses
  
  // Filter out timestamps older than 15 minutes from GLOBAL history
  const recentUsages = quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update global history with filtered timestamps (removes expired ones)
  if (recentUsages.length !== quickTaskUsageHistory.length) {
    quickTaskUsageHistory.length = 0;
    quickTaskUsageHistory.push(...recentUsages);
  }
  
  // Calculate remaining uses GLOBALLY
  const remaining = Math.max(0, maxUses - recentUsages.length);
  return remaining;
}
```

This is the ONLY place where usage history should be modified (besides `recordQuickTaskUsage()` which adds new timestamps).

## Verification

### Test Scenario

**Setup:**
- maxUses = 2
- Quick Task duration = 10 seconds (for testing)
- 15-minute rolling window

**Steps:**
1. Open Instagram
   - Expected: "2 remaining"
   - Log: `recentUsagesGlobal: 0, remaining: 2`

2. Click "Quick Task"
   - Expected: Usage recorded
   - Log: `Quick Task usage recorded (GLOBAL) totalUsagesGlobal: 1`

3. Wait 10 seconds for timer to expire
   - Expected: `QuickTaskExpiredScreen` appears

4. Click "Close & Go Home"
   - Expected: Timers reset, usage history preserved
   - Log: `Tracking state reset (timers cleared, usage history preserved)`

5. Open Instagram again
   - **Expected:** "1 remaining" ✅
   - **Log:** `recentUsagesGlobal: 1, remaining: 1` ✅

6. Wait 15 minutes (or advance time)
   - Expected: Usage timestamp expires

7. Open Instagram again
   - Expected: "2 remaining" (usage expired)
   - Log: `recentUsagesGlobal: 0, remaining: 2`

### Before Fix (Incorrect)
```
Step 1: remaining: 2 ✅
Step 2: totalUsagesGlobal: 1 ✅
Step 5: remaining: 2 ❌ (should be 1)
```

### After Fix (Correct)
```
Step 1: remaining: 2 ✅
Step 2: totalUsagesGlobal: 1 ✅
Step 5: remaining: 1 ✅ (correct!)
Step 7: remaining: 2 ✅ (after 15 min)
```

## Impact

### User Experience
- ✅ Quick Task quota now enforced correctly
- ✅ Users cannot bypass the limit by letting timers expire
- ✅ Usage count accurately reflects consumption within 15-minute window

### Security
- ✅ Prevents quota bypass exploit
- ✅ Maintains intended usage limits (1-2 uses per 15 minutes)

### Code Quality
- ✅ Clear separation between timer state and usage quota
- ✅ Documented behavior with explicit comments
- ✅ Consistent with specification

## Files Modified

1. **`src/os/osTriggerBrain.ts`** (Line 1040-1050)
   - Removed `quickTaskUsageHistory.length = 0;`
   - Added explanatory comment
   - Updated log message

## Related Documentation

- `docs/QUICK_TASK_IMPLEMENTATION_SUMMARY.md` - Overall Quick Task architecture
- `docs/QUICK_TASK_GLOBAL_USAGE_FIX.md` - Global vs per-app usage tracking
- `docs/QUICK_TASK_SPEC_COMPLIANCE.md` - Specification compliance details

## Testing

To test this fix:

1. Set Quick Task duration to 10 seconds for faster testing:
   ```typescript
   // In Settings screen or osConfig.ts
   durationMs: 10000 // 10 seconds
   ```

2. Follow the verification scenario above

3. Check logs for:
   - Usage recording: `Quick Task usage recorded (GLOBAL)`
   - Usage count: `recentUsagesGlobal` and `remaining` values
   - Reset behavior: `Tracking state reset (timers cleared, usage history preserved)`

4. Verify that `remaining` decrements correctly and persists across Quick Task expirations

## Conclusion

This fix ensures that the Quick Task usage quota is enforced correctly according to the specification. The usage history is now properly preserved across timer expirations and only decrements when timestamps naturally expire after 15 minutes.

**Key takeaway:** Timer state (when protection ends) is separate from usage quota (how many uses consumed). Only the former should be reset when a Quick Task expires.
