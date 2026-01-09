# POST_QUICK_TASK_CHOICE Lifecycle Fix - Summary

**Status:** ✅ COMPLETE  
**Date:** January 9, 2026

## The Bug (One Sentence)

`POST_QUICK_TASK_CHOICE` session persisted after user switched apps, showing stale choice screen on reopen.

## The Root Cause (One Sentence)

`POST_QUICK_TASK_CHOICE` was treated as "special UI" instead of a normal session with exit rules.

## The Fix (One Sentence)

Added `POST_QUICK_TASK_CHOICE` to both "user left app" teardown effects in `SystemSurfaceRoot.tsx`.

## Changes Made

### File: `app/roots/SystemSurfaceRoot.tsx`

**Line 483 (QUICK_TASK teardown):**
```typescript
// BEFORE
if (session?.kind !== 'QUICK_TASK') return;

// AFTER
if (session?.kind !== 'QUICK_TASK' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

**Line 524 (INTERVENTION teardown):**
```typescript
// BEFORE
if (session?.kind !== 'INTERVENTION') return;

// AFTER
if (session?.kind !== 'INTERVENTION' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

## Verification Steps

1. Open Instagram → Quick Task dialog
2. Choose Quick Task → Wait for expiration → Choice screen appears
3. **Press Home** (without choosing)
4. Reopen Instagram
5. ✅ Should show Quick Task dialog OR Intervention (NOT choice screen)

## Logs to Check

**When user leaves app:**
```
[SystemSurfaceRoot] 🚨 Session ended - underlying app changed
  sessionKind: POST_QUICK_TASK_CHOICE
```

**When user reopens app:**
```
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK (or INTERVENTION)
```

## Architectural Lesson

**Every session kind must have clear entry rules and clear exit rules.**

No exceptions. No special cases. This prevents entire classes of "zombie screen" bugs.

## Documentation

See `docs/POST_QUICK_TASK_CHOICE_LIFECYCLE_FIX.md` for complete details.
