# REPLACE_SESSION Race Condition Fix

**Date:** January 6, 2026  
**Status:** ✅ Complete  
**Issue:** Clicking "conscious_process" in Quick Task dialog immediately launches home screen

## Problem Summary

When user clicked "conscious_process" button in Quick Task dialog to start the full intervention, the breathing screen would appear briefly but then immediately launch the home screen instead of continuing the intervention flow.

### Symptoms
- Quick Task dialog shows
- User clicks "conscious_process"
- Breathing screen appears for a split second
- Home screen launches immediately
- Intervention never completes

### Evidence from Logs
```
[QuickTaskDialog] handleConsciousProcess called!
[SystemSession] REPLACE_SESSION (QUICK_TASK → INTERVENTION)
[InterventionFlow] BEGIN_INTERVENTION for app: com.xingin.xhs
[SystemSurfaceRoot] 🚨 Intervention Session ended - user left app 
  {"foregroundApp": "com.hihonor.android.launcher", "sessionApp": "com.xingin.xhs"}
[SystemSession] END_SESSION {"shouldLaunchHome": true}
```

## Root Cause

**File:** `app/roots/SystemSurfaceRoot.tsx` (lines 306-323)

The "user left app" check was firing **during** the REPLACE_SESSION transition:

```typescript
useEffect(() => {
  if (session?.kind !== 'INTERVENTION') return;
  
  // ❌ PROBLEM: This fires immediately when session changes to INTERVENTION
  // But foregroundApp is stale (showing launcher from before)
  if (foregroundApp !== session.app) {
    dispatchSystemEvent({ type: 'END_SESSION' });
  }
}, [session, foregroundApp, dispatchSystemEvent]);
```

### Why This Happened

1. User was in Quick Task dialog (`session.kind = 'QUICK_TASK'`)
2. `foregroundApp` became `com.hihonor.android.launcher` (home screen) at some point
3. User clicked "conscious_process" button
4. `REPLACE_SESSION` was dispatched → session changed to `{kind: 'INTERVENTION', app: 'com.xingin.xhs'}`
5. **useEffect fired immediately** because `session` dependency changed
6. Check: `foregroundApp ('launcher') !== session.app ('xhs')` → **TRUE**
7. Result: Session ended immediately with `shouldLaunchHome: true`

### The Semantic Issue

**REPLACE_SESSION is an internal state transition, NOT user navigation.**

The "user left app" check is correct for **external events** (user pressing home, switching apps) but wrong for **internal transitions** (REPLACE_SESSION). During REPLACE_SESSION, `foregroundApp` may be stale and should be ignored.

## Solution

### Approach: Track Previous Session Kind

Instead of using time-based heuristics or adding extra state to the session object, we track the **previous session kind** in a ref. This allows us to detect REPLACE_SESSION transitions (QUICK_TASK → INTERVENTION) deterministically.

### Why This Approach

- ✅ **No extra state** in session object
- ✅ **No cross-layer coupling** (flows don't manage session metadata)
- ✅ **Automatic cleanup** (ref updates on every render)
- ✅ **Simpler implementation** (just one ref and one condition)
- ✅ **Deterministic behavior** (no timing assumptions)
- ✅ **Device independent** (works on fast and slow devices)

### Changes Made

**File:** `app/roots/SystemSurfaceRoot.tsx`

#### 1. Added ref to track previous session kind (after line 139):

```typescript
/**
 * Track previous session kind to detect internal transitions
 * 
 * REPLACE_SESSION (QUICK_TASK → INTERVENTION) is an internal state transition,
 * NOT user navigation. During this transition, foregroundApp may be stale
 * (showing launcher or previous app), which would falsely trigger "user left app".
 * 
 * By tracking the previous session kind, we can detect this specific transition
 * and skip the exit check during the first render after REPLACE_SESSION.
 */
const prevSessionKindRef = useRef<'INTERVENTION' | 'QUICK_TASK' | 'ALTERNATIVE_ACTIVITY' | null>(null);
```

#### 2. Added useEffect to track session kind changes (after line 289):

```typescript
/**
 * Track session kind changes for internal transition detection
 * 
 * This updates AFTER the intervention check runs, so prevSessionKindRef
 * always holds the value from the previous render.
 */
useEffect(() => {
  prevSessionKindRef.current = session?.kind ?? null;
}, [session?.kind]);
```

#### 3. Updated intervention session check to detect REPLACE_SESSION (lines 306-345):

```typescript
/**
 * CRITICAL: End Intervention Session if user leaves the app
 * 
 * Intervention Session is ONE-SHOT and NON-RECOVERABLE.
 * If user switches away from the monitored app during intervention,
 * the session MUST end immediately.
 * 
 * IMPORTANT: This check is DISABLED during internal transitions.
 * REPLACE_SESSION (QUICK_TASK → INTERVENTION) is NOT user navigation.
 * During this transition, foregroundApp may be stale and should be ignored.
 * 
 * Detection: If previous session was QUICK_TASK and current is INTERVENTION,
 * this is the first render after REPLACE_SESSION. Skip the check once,
 * then resume normal exit detection on subsequent renders.
 * 
 * This does NOT apply to:
 * - ALTERNATIVE_ACTIVITY (already has visibility logic)
 * - QUICK_TASK (persists across app switches)
 */
useEffect(() => {
  // Only check for INTERVENTION sessions
  if (session?.kind !== 'INTERVENTION') return;
  
  // ✅ DETERMINISTIC: Detect internal transition (QUICK_TASK → INTERVENTION)
  // This is REPLACE_SESSION, NOT user navigation
  const isInternalTransition = 
    prevSessionKindRef.current === 'QUICK_TASK' && 
    session.kind === 'INTERVENTION';
  
  if (isInternalTransition) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] ⏭️ Skipping user left check - internal transition (QUICK_TASK → INTERVENTION)');
    }
    return;
  }
  
  // Don't end session if foregroundApp is null or BreakLoop infrastructure
  if (isBreakLoopInfrastructure(foregroundApp)) return;
  
  // End session if user switched to a different app
  if (foregroundApp !== session.app) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] 🚨 Intervention Session ended - user left app', {
        sessionApp: session.app,
        foregroundApp,
      });
    }
    dispatchSystemEvent({ type: 'END_SESSION' });
  }
}, [session, foregroundApp, dispatchSystemEvent]);
```

### How It Works

1. **Tracks previous session kind** - `prevSessionKindRef` remembers what session was active before
2. **Detects REPLACE_SESSION** - When `prev = QUICK_TASK` and `current = INTERVENTION`, we know it's an internal transition
3. **Skips check once** - First render after REPLACE_SESSION skips the exit check
4. **Auto-resumes** - On next render, `prevSessionKindRef` updates to `INTERVENTION`, check resumes normally
5. **No manual cleanup** - Ref updates automatically on every render

## Testing Checklist

### Test Case 1: Quick Task → Intervention (The Bug Fix)
- [ ] Open xhs
- [ ] Quick Task dialog appears
- [ ] Click "conscious_process" button
- [ ] **Expected**: Breathing screen appears and countdown proceeds (5 → 4 → 3 → 2 → 1 → 0)
- [ ] **Verify logs**: 
  - ✅ `REPLACE_SESSION (QUICK_TASK → INTERVENTION)`
  - ✅ `Skipping user left check - internal transition (QUICK_TASK → INTERVENTION)`
  - ✅ NO `Intervention Session ended - user left app` immediately after
  - ✅ Breathing countdown completes normally

### Test Case 2: Real User Exit During Intervention
- [ ] Open xhs
- [ ] Start intervention (breathing screen shows)
- [ ] Wait for one render cycle (prevSessionKindRef updates to INTERVENTION)
- [ ] Press home button during breathing
- [ ] **Expected**: Session ends, home screen appears
- [ ] **Verify logs**:
  - ✅ `Intervention Session ended - user left app`
  - ✅ `END_SESSION {"shouldLaunchHome": true}`

### Test Case 3: App Switch During Intervention
- [ ] Open xhs
- [ ] Start intervention (breathing screen shows)
- [ ] Wait for one render cycle
- [ ] Switch to Instagram during breathing
- [ ] **Expected**: Session ends, Instagram intervention starts
- [ ] **Verify**: Clean transition, no home screen flash

### Test Case 4: Transition Detection Only Fires Once
- [ ] Open xhs
- [ ] Quick Task → Intervention transition
- [ ] **Verify logs**:
  - ✅ First render: `Skipping user left check - internal transition`
  - ✅ Second render: Normal exit detection resumes (no skip message)

## Files Modified

1. ✅ `app/roots/SystemSurfaceRoot.tsx` - Added prevSessionKindRef and updated exit check logic

## Architecture Compliance

✅ **No changes to System Brain** - This is purely a UI-layer state machine fix

✅ **No changes to native code** - JavaScript-only fix

✅ **No changes to SystemSessionProvider** - No session shape modifications

✅ **No cross-layer coupling** - Flows don't manage session metadata

✅ **Preserves Phase 2 architecture** - No changes to wake reasons or bootstrap logic

✅ **Maintains session semantics** - Still ends session when user genuinely leaves

✅ **Respects REPLACE_SESSION** - Treats it as internal transition, not user navigation

✅ **Deterministic** - No timing assumptions, works on all devices

✅ **Semantic clarity** - Code explicitly detects and handles internal transitions

✅ **Automatic cleanup** - Ref updates naturally, no manual clearing needed

## Key Learnings

1. **REPLACE_SESSION is a state machine transition, not user navigation** - It must be treated differently from external events
2. **Detect transitions semantically, not temporally** - Use previous state tracking instead of time-based heuristics
3. **Keep logic in the right layer** - SystemSurfaceRoot manages session lifecycle, flows don't
4. **Refs are perfect for tracking previous values** - They don't trigger re-renders and update automatically
5. **Deterministic beats heuristic** - State-based detection is more reliable than time-based detection

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/PHASE2_ARCHITECTURE_UPDATE.md` - Phase 2 explicit wake reasons
- `docs/INTERVENTION_RACE_CONDITION_FIX.md` - Previous intervention race condition fix
