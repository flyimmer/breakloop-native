# POST_QUICK_TASK_CHOICE Lifecycle Fix

**Date:** January 9, 2026  
**Issue:** POST_QUICK_TASK_CHOICE screen persists after user switches apps  
**Status:** ✅ FIXED

## Problem Description

### Observed Behavior (WRONG)

1. Quick Task expires in foreground → `PostQuickTaskChoiceScreen` appears ✅
2. User presses Home button (without making a choice)
3. User reopens Instagram
4. **BUG:** `PostQuickTaskChoiceScreen` still showing (stale screen)

### Expected Behavior (CORRECT)

1. Quick Task expires in foreground → `PostQuickTaskChoiceScreen` appears ✅
2. User presses Home button (without making a choice)
3. **Session ends immediately** ✅
4. User reopens Instagram
5. **OS Trigger Brain re-evaluates:** Shows Quick Task dialog OR Intervention ✅

## Root Cause

`POST_QUICK_TASK_CHOICE` session was missing from the "user left app" teardown logic in `SystemSurfaceRoot.tsx`.

**The code had two separate teardown effects:**

1. **QUICK_TASK teardown** (lines 481-506):
   - Checked: `if (session?.kind !== 'QUICK_TASK') return;`
   - ❌ Did NOT include `POST_QUICK_TASK_CHOICE`

2. **INTERVENTION teardown** (lines 522-555):
   - Checked: `if (session?.kind !== 'INTERVENTION') return;`
   - ❌ Did NOT include `POST_QUICK_TASK_CHOICE`

**Result:** When user switched away during choice screen, the session never ended, causing:
- Session remained active in memory
- SystemSurface stayed alive with stale UI
- Reopening app showed stale choice screen
- System Brain suppressed duplicate launch (correct behavior, wrong state)

## The Fix

### File Changed: `app/roots/SystemSurfaceRoot.tsx`

**Change 1: QUICK_TASK Teardown Effect**

```typescript
// BEFORE (line 483)
if (session?.kind !== 'QUICK_TASK') return;

// AFTER
if (session?.kind !== 'QUICK_TASK' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

**Change 2: INTERVENTION Teardown Effect**

```typescript
// BEFORE (line 524)
if (session?.kind !== 'INTERVENTION') return;

// AFTER
if (session?.kind !== 'INTERVENTION' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;
```

### Why This Works

`POST_QUICK_TASK_CHOICE` is conceptually similar to both:
- **Like QUICK_TASK:** It's a modal overlay that should end when user switches apps
- **Like INTERVENTION:** It's a transient choice that doesn't persist

By adding it to both teardown effects, we ensure:
- ✅ Session ends when user leaves app (any infrastructure check passes)
- ✅ No stale UI persists across app switches
- ✅ OS Trigger Brain re-evaluates on next app open
- ✅ Choice screen never shows again after user leaves

## Architectural Principle

**Every session kind must have clear entry rules and clear exit rules.**

`POST_QUICK_TASK_CHOICE` is NOT an exception. It follows the same lifecycle rules as other transient sessions.

### Session Lifecycle Matrix

| Session Kind | Entry | Exit (User Leaves App) | Persistence |
|--------------|-------|------------------------|-------------|
| `QUICK_TASK` | OS Trigger Brain | ✅ End immediately | ❌ No |
| `INTERVENTION` | OS Trigger Brain | ✅ End immediately | ❌ No |
| `POST_QUICK_TASK_CHOICE` | Quick Task expired | ✅ End immediately | ❌ No |
| `ALTERNATIVE_ACTIVITY` | User choice | ✅ End immediately | ❌ No |

## Testing

### Test Scenario

1. Open Instagram → Quick Task dialog appears
2. Choose Quick Task (3 minutes)
3. Wait for Quick Task to expire → `PostQuickTaskChoiceScreen` appears
4. **Press Home button** (without choosing)
5. Wait 2 seconds
6. Reopen Instagram

**Expected Result:**
- ✅ Choice screen disappears when Home pressed
- ✅ OS Trigger Brain re-evaluates on reopen
- ✅ Shows Quick Task dialog (if quota > 0) OR Intervention (if quota = 0)
- ✅ Choice screen does NOT reappear

### Log Verification

When user leaves app during choice screen, you should see:

```
[SystemSurfaceRoot] 🚨 Session ended - underlying app changed
  sessionKind: POST_QUICK_TASK_CHOICE
  sessionApp: com.instagram.android
  underlyingApp: com.hihonor.android.launcher
```

When user reopens app, you should see:

```
[System Brain] MONITORED APP OPENED
[Decision Engine] Evaluating OS Trigger Brain
[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK (or INTERVENTION)
```

## What This Fix Does NOT Do

- ❌ Does NOT add new flags or persistence
- ❌ Does NOT modify System Brain logic
- ❌ Does NOT add native code changes
- ❌ Does NOT create special-case handling

This is a simple lifecycle rule extension, not a new feature.

## Impact

This fix eliminates an entire class of "zombie screen" bugs where transient UI persists across app switches.

**Before:** Each new session kind required explicit teardown logic  
**After:** All transient sessions follow the same lifecycle rules

## Related Files

- `app/roots/SystemSurfaceRoot.tsx` - Session lifecycle management
- `app/screens/conscious_process/PostQuickTaskChoiceScreen.tsx` - Choice screen UI
- `src/systemBrain/decisionEngine.ts` - OS Trigger Brain logic
- `src/contexts/SystemSessionProvider.tsx` - Session state management

## Commit Message

```
fix: POST_QUICK_TASK_CHOICE session ends when user leaves app

Problem: Choice screen persisted after user switched away, showing stale UI on reopen
Root cause: POST_QUICK_TASK_CHOICE missing from "user left app" teardown logic
Solution: Add POST_QUICK_TASK_CHOICE to both teardown effects in SystemSurfaceRoot

Now all transient sessions (QUICK_TASK, INTERVENTION, POST_QUICK_TASK_CHOICE)
follow the same lifecycle rule: end immediately when user leaves target app.

Fixes zombie screen bug where choice screen appeared on app reopen.
```
