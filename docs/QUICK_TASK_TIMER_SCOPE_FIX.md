# Quick Task Timer Scope Fix

**Date:** December 31, 2025  
**Issue:** Quick Task timer scope was incorrectly implemented as global

---

## Problem

The Priority 1 check in `osTriggerBrain.ts` was checking if ANY Quick Task timer was active globally, which would suppress interventions for ALL monitored apps if any one app had an active Quick Task.

**Incorrect behavior:**
- User activates Quick Task on Instagram
- Instagram gets 3-minute timer
- User switches to TikTok
- TikTok intervention is suppressed (WRONG!)

---

## Correct Architecture

### Timer Scope: PER-APP
- Each monitored app has its own independent Quick Task timer (`t_quickTask`)
- Instagram's Quick Task timer does NOT affect TikTok's intervention
- Timers are stored per package name: `Map<packageName, { expiresAt }>`

### Usage Count: GLOBAL
- The number of Quick Task uses (`n_quickTask`) is shared across all apps
- If user has 1 use remaining, they can use it on ANY app
- Once used, the quota is consumed globally

---

## Fix Applied

### 1. Updated `hasActiveQuickTaskTimer()` function

**Before:**
```typescript
function hasActiveQuickTaskTimer(timestamp: number): boolean {
  for (const [packageName, timer] of quickTaskTimers.entries()) {
    if (timestamp < timer.expiresAt) {
      return true; // Returns true if ANY app has active timer
    }
  }
  return false;
}
```

**After:**
```typescript
function hasActiveQuickTaskTimer(packageName: string, timestamp: number): boolean {
  const timer = quickTaskTimers.get(packageName);
  if (!timer) {
    return false;
  }
  return timestamp < timer.expiresAt; // Only checks THIS SPECIFIC APP
}
```

### 2. Updated Priority 1 check

**Before:**
```typescript
if (hasActiveQuickTaskTimer(timestamp)) {
  console.log('[OS Trigger Brain] ✓ Priority 1: Quick Task ACTIVE (global)');
  console.log('[OS Trigger Brain] → SUPPRESS EVERYTHING');
  return;
}
```

**After:**
```typescript
if (hasActiveQuickTaskTimer(packageName, timestamp)) {
  console.log('[OS Trigger Brain] ✓ Priority 1: Quick Task ACTIVE (per-app)');
  console.log('[OS Trigger Brain] → SUPPRESS EVERYTHING for this app');
  return;
}
```

### 3. Updated Architecture Documentation

Updated `docs/SYSTEM_SURFACE_ARCHITECTURE.md` to clarify:
- Priority 1: "Quick Task ACTIVE (per-app: t_quickTask)"
- Priority 4: "n_quickTask > 0 (global usage count)"
- Added distinction between timer scope (per-app) and usage count (global)

---

## Correct Behavior After Fix

**Scenario:**
1. User opens Instagram → Quick Task dialog appears
2. User clicks "Quick Task" → Instagram gets 3-minute timer
3. User uses Instagram freely for 3 minutes
4. User switches to TikTok → TikTok intervention triggers normally
5. Instagram timer does NOT affect TikTok

**Priority Chain (Corrected):**
1. Quick Task ACTIVE (per-app: t_quickTask) → Suppress for this app
2. Alternative Activity RUNNING (per-app) → Suppress for this app
3. t_intention VALID (per-app) → Suppress for this app
4. n_quickTask > 0 (global usage count) → Show Quick Task dialog
5. Else → Start Intervention Flow

---

## Files Modified

1. `src/os/osTriggerBrain.ts`
   - Fixed `hasActiveQuickTaskTimer()` to check per-app
   - Updated Priority 1 check to pass `packageName`
   - Updated comments to clarify per-app scope

2. `docs/SYSTEM_SURFACE_ARCHITECTURE.md`
   - Clarified timer scope (per-app) vs usage count (global)
   - Updated Priority Chain documentation
   - Updated Quick Task Flow rules

---

## Testing

After rebuild, verify:
1. ✅ Quick Task on Instagram does NOT suppress TikTok intervention
2. ✅ Each app has independent Quick Task timer
3. ✅ Global usage count is still enforced (1 use across all apps)
4. ✅ Priority 1 only suppresses intervention for the specific app with active timer

---

**Status:** ✅ Fixed and documented
