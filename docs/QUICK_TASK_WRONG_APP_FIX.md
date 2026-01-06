# Quick Task Wrong App Bug Fix

**Date:** January 7, 2026  
**Status:** ✅ Complete  
**Issue:** Quick Task dialog shows for wrong app, causing wrong app to launch

## Problem Summary

When user clicked "Quick Task" on Instagram, the dialog was showing for a different app (xhs), causing the wrong app to launch when the button was clicked. After a few seconds, the main BreakLoop app appeared instead of launching Instagram.

### Symptoms
- Open Instagram → Quick Task dialog appears
- Dialog shows for wrong app (xhs instead of Instagram)
- Click "Quick Task" → Wrong app launches (xhs)
- Main BreakLoop app appears instead of expected behavior

### Evidence from Logs

**Line 60-93**: Instagram detected → System Brain launches SystemSurface with `SHOW_QUICK_TASK_DIALOG` for **Instagram**

**Line 119**: SystemSurfaceRoot renders QuickTaskFlow for **xhs** (WRONG APP!)
```
LOG  [SystemSurfaceRoot] Rendering QuickTaskFlow for app: com.xingin.xhs
```

**Line 137-147**: User clicks Quick Task button → Dialog tries to launch **xhs** instead of Instagram
```
LOG  [QuickTaskDialog] targetApp: com.xingin.xhs
LOG  [SystemSurfaceRoot] Launching target app: com.xingin.xhs
```

## Root Cause

**Stale session persists across SystemSurface launches.**

When SystemSurface is launched with a new `wakeReason` and `triggeringApp`:
1. The old session (xhs) is still active in memory
2. Bootstrap reads the new intent extras (Instagram)
3. But the existing session (xhs) takes precedence
4. Dialog shows for wrong app (xhs)
5. User clicks button → wrong app launches

### The Core Issue

SystemSurfaceRoot bootstrap didn't check for **session mismatch** between:
- Existing in-memory session app (xhs)
- Intent extras app (Instagram)

**SystemSurface can be relaunched while a session is still active.** The old session state persists in memory, causing the wrong dialog to render.

## The Correct Rule (Authoritative)

> **If SystemSurface is launched with intent extras that disagree with in-memory session state, the intent always wins.**

Intent extras represent the **current launch intent** from System Brain, which is always authoritative and must take precedence over stale in-memory state.

## Solution

### Approach: Atomic Session Replacement at Bootstrap Boundary

When SystemSurface launches with new intent extras, check if there's an **existing session** that doesn't match the new `triggeringApp`. If there's a mismatch, **atomically replace the session** with the correct app using `REPLACE_SESSION`.

### Why This Is Correct

- ✅ **No timing assumptions** - Deterministic, state-based check
- ✅ **No teardown/waiting** - Atomic replacement in one operation
- ✅ **No state ambiguity** - Intent extras always win
- ✅ **One render pass** - Correct dialog shows immediately
- ✅ **Deterministic** - Same inputs always produce same output
- ✅ **Matches Phase 2 principles** - Wake reasons authoritative
- ✅ **Uses REPLACE_SESSION** - Avoids duplicate lifecycle edges

### Changes Made

**File:** `app/roots/SystemSurfaceRoot.tsx`

Added session mismatch detection in bootstrap (after line 211, before dispatching session):

```typescript
// ✅ CRITICAL: Check for session mismatch
// Intent extras ALWAYS win over stale in-memory session state
// This handles the case where SystemSurface is relaunched while a session is still active
if (session && session.app !== triggeringApp) {
  console.warn('[SystemSurfaceRoot] Session mismatch, replacing session', {
    oldApp: session.app,
    newApp: triggeringApp,
    wakeReason,
  });
  
  // Use REPLACE_SESSION for atomic replacement (avoids duplicate lifecycle edges)
  dispatchSystemEvent({
    type: 'REPLACE_SESSION',
    newKind: wakeReason === 'SHOW_QUICK_TASK_DIALOG'
      ? 'QUICK_TASK'
      : 'INTERVENTION',
    app: triggeringApp,
  });
  
  return; // Do not proceed with stale session
}
```

### How It Works

1. **Detects mismatch** - Compares existing `session.app` with new `triggeringApp` from intent extras
2. **Atomically replaces session** - Uses `REPLACE_SESSION` to avoid duplicate lifecycle edges
3. **Maps wake reason to session kind** - `SHOW_QUICK_TASK_DIALOG` → `QUICK_TASK`, everything else → `INTERVENTION`
4. **Returns early** - Prevents duplicate session creation from normal bootstrap flow
5. **Correct dialog renders** - Next render shows dialog for correct app

### Why REPLACE_SESSION Instead of START_*

Using `REPLACE_SESSION` instead of `START_QUICK_TASK` or `START_INTERVENTION`:
- ✅ Guarantees atomicity
- ✅ Avoids duplicate lifecycle edges
- ✅ Single state transition
- ✅ Consistent with existing REPLACE_SESSION pattern (Quick Task → Intervention)

## Testing Checklist

### Test Case 1: Quick Task on Instagram After xhs Dismissal (The Bug)
- [ ] Open xhs → Quick Task dialog appears
- [ ] **Don't click anything** → Press back/home to dismiss
- [ ] Open Instagram → Quick Task dialog should appear **for Instagram**
- [ ] Click "Quick Task" button
- [ ] **Expected**: Instagram launches (not xhs!)
- [ ] **Verify logs**:
  - ✅ `Session mismatch, replacing session`
  - ✅ `oldApp: com.xingin.xhs, newApp: com.instagram.android`
  - ✅ `REPLACE_SESSION with newKind: QUICK_TASK`
  - ✅ `Launching target app: com.instagram.android`

### Test Case 2: Sequential Quick Tasks (Different Apps)
- [ ] Open xhs → Quick Task dialog → Click "Quick Task"
- [ ] Open Instagram → Quick Task dialog → Click "Quick Task"
- [ ] **Expected**: Each dialog launches the correct app
- [ ] **Verify**: No session mismatch logs (sessions properly cleared between launches)

### Test Case 3: Same App Reopen
- [ ] Open xhs → Quick Task dialog → Click "Quick Task"
- [ ] Reopen xhs (within Quick Task window)
- [ ] **Expected**: No intervention (Quick Task active)
- [ ] **Verify**: No session mismatch, no new dialog

### Test Case 4: Intervention Flow (Not Just Quick Task)
- [ ] Open xhs → Full intervention starts
- [ ] **Don't complete** → Press home to dismiss
- [ ] Open Instagram → Full intervention should start **for Instagram**
- [ ] **Expected**: Breathing screen shows for Instagram
- [ ] **Verify logs**: Session mismatch detected and corrected

## Files Modified

1. ✅ `app/roots/SystemSurfaceRoot.tsx` - Added session mismatch detection in bootstrap (lines 213-235)

## Architecture Compliance

✅ **No changes to System Brain** - Pure UI-layer fix

✅ **No changes to native code** - JavaScript-only

✅ **Preserves Phase 2 architecture** - Wake reasons still authoritative, intent extras always win

✅ **Session semantics preserved** - Sessions still control rendering, just corrected at bootstrap

✅ **Bootstrap integrity** - Mismatch detection happens during bootstrap, before user interaction

✅ **Deterministic** - Always checks for mismatch, always corrects it atomically

✅ **No timing assumptions** - One render pass, no waiting

✅ **Atomic transitions** - Uses REPLACE_SESSION pattern consistently

## Consistency with Earlier Fixes

This follows the same principles already applied:

1. **REPLACE_SESSION vs END_SESSION** - Atomic transition, no teardown
2. **Origin-based gating vs timing** - Deterministic rules, no grace periods
3. **prevSessionKindRef vs timing** - State-based detection, no delays

We're applying the same principle at the **bootstrap boundary**:
- Session state must be corrected **atomically**
- No timing assumptions
- Intent extras are authoritative

## Key Learnings

1. **SystemSurface can be relaunched while a session is still active** - Old session state persists in memory
2. **Intent extras are always authoritative** - They represent the current launch intent from System Brain
3. **Bootstrap must validate session state** - Can't assume clean slate on every launch
4. **REPLACE_SESSION is the right tool** - Atomic replacement without duplicate lifecycle edges
5. **Consistency matters** - Same patterns applied across different boundaries (transition, bootstrap)

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/PHASE2_ARCHITECTURE_UPDATE.md` - Phase 2 explicit wake reasons
- `docs/REPLACE_SESSION_FIX.md` - REPLACE_SESSION race condition fix (similar pattern)
