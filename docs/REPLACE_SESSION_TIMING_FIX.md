# REPLACE_SESSION Timing Fix

**Date:** January 7, 2026  
**Status:** ✅ Complete  
**Issue:** REPLACE_SESSION race condition - useEffect timing causes premature session termination

## Problem Summary

When user clicked "conscious_process" in Quick Task dialog, the intervention started but **immediately ended**, launching the home screen instead of showing the breathing screen.

### Symptoms
- Quick Task dialog → Click "conscious_process"
- Breathing screen appears briefly
- Home screen launches immediately
- Intervention never completes

### Evidence from Logs

**Line 689-690**:
```
LOG  [InterventionFlow] BEGIN_INTERVENTION for app: com.instagram.android
LOG  [SystemSurfaceRoot] 🚨 Intervention Session ended - user left app
```

The "user left app" check fired **immediately** after `BEGIN_INTERVENTION`, even though we had the `prevSessionKindRef` protection in place.

## Root Cause

**useEffect execution order issue - ref update happens too late.**

### The Previous Fix (Incomplete)

We had added this code to track previous session kind:

```typescript
// Update ref in useEffect (lines 319-321)
useEffect(() => {
  prevSessionKindRef.current = session?.kind ?? null;
}, [session?.kind]);

// Check in another useEffect (lines 342-370)
useEffect(() => {
  if (session?.kind !== 'INTERVENTION') return;
  
  const isInternalTransition = 
    prevSessionKindRef.current === 'QUICK_TASK' && 
    session.kind === 'INTERVENTION';
  
  if (isInternalTransition) return; // Skip check
  
  // ... user left app logic
}, [session, foregroundApp, dispatchSystemEvent]);
```

### Why It Failed

**React's useEffect batching behavior:**

1. Session changes from QUICK_TASK to INTERVENTION
2. Both useEffects are queued to run in the same batch
3. Both useEffects read refs from the **same render snapshot**
4. The ref update in the first useEffect doesn't affect the second useEffect
5. Result: "User left app" check reads **stale** ref value

**The Timing Problem:**
```
Render 1: session = QUICK_TASK, prevSessionKindRef.current = null
  → useEffect 1: Sets prevSessionKindRef.current = QUICK_TASK
  → useEffect 2: Reads prevSessionKindRef.current = null (stale!)

Render 2: session = INTERVENTION, prevSessionKindRef.current = QUICK_TASK
  → useEffect 1: Sets prevSessionKindRef.current = INTERVENTION
  → useEffect 2: Reads prevSessionKindRef.current = QUICK_TASK (from Render 1!)
  → Should skip check, but ref was updated in same batch
  → Check runs anyway, sees foregroundApp mismatch, ends session
```

Multiple useEffects in the same batch see the **same snapshot** of refs. The ref update doesn't take effect until the next render.

## Solution

### Move Ref Update from useEffect to Render

Update `prevSessionKindRef` **synchronously during render** instead of in useEffect.

**Why This Works:**
- Refs can be updated during render (unlike state)
- The update happens **before** any useEffect runs
- "User left app" check always sees the correct previous value
- No timing dependencies

### Changes Made

**File:** `app/roots/SystemSurfaceRoot.tsx`

#### 1. Moved ref update to render (lines 142-167):

```typescript
/**
 * Track previous session kind to detect REPLACE_SESSION transitions
 * 
 * CRITICAL: This must be updated synchronously during render, NOT in useEffect.
 * The "user left app" check needs to read the previous value before it's updated.
 * 
 * Pattern: Store current value, then update ref at end of this block.
 * This ensures the "user left app" check sees the OLD value during this render.
 */
const prevSessionKindRef = useRef<'INTERVENTION' | 'QUICK_TASK' | 'ALTERNATIVE_ACTIVITY' | null>(null);
const currentSessionKind = session?.kind ?? null;

// Detect if this is a REPLACE_SESSION transition (QUICK_TASK → INTERVENTION)
// This flag is computed with the PREVIOUS session kind (before ref update)
const isReplaceSessionTransition = 
  prevSessionKindRef.current === 'QUICK_TASK' && 
  currentSessionKind === 'INTERVENTION';

// Update ref for next render (happens synchronously during this render)
// This ensures the "user left app" check below sees the OLD value
prevSessionKindRef.current = currentSessionKind;
```

#### 2. Removed old useEffect (lines 327-335 - DELETED):

```typescript
// ❌ REMOVED - This was too late
useEffect(() => {
  prevSessionKindRef.current = session?.kind ?? null;
}, [session?.kind]);
```

#### 3. Updated "user left app" check (lines 327-371):

```typescript
useEffect(() => {
  // Only check for INTERVENTION sessions
  if (session?.kind !== 'INTERVENTION') return;
  
  // ✅ DETERMINISTIC: Use pre-computed REPLACE_SESSION transition flag
  // This was calculated during render with the correct previous value
  if (isReplaceSessionTransition) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] ⏭️ Skipping user left check - REPLACE_SESSION transition (QUICK_TASK → INTERVENTION)');
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
}, [session, foregroundApp, dispatchSystemEvent, isReplaceSessionTransition]);
```

### How It Works Now

**Correct Timing:**
```
Render 1: session = QUICK_TASK
  → During render: prevSessionKindRef.current = null, isReplaceSessionTransition = false
  → Update ref: prevSessionKindRef.current = QUICK_TASK
  → useEffect: Runs with isReplaceSessionTransition = false

Render 2: session = INTERVENTION (REPLACE_SESSION happened)
  → During render: prevSessionKindRef.current = QUICK_TASK (from Render 1)
  → Compute: isReplaceSessionTransition = true (QUICK_TASK → INTERVENTION)
  → Update ref: prevSessionKindRef.current = INTERVENTION
  → useEffect: Runs with isReplaceSessionTransition = true → SKIPS CHECK ✅

Render 3: session = INTERVENTION (still in intervention)
  → During render: prevSessionKindRef.current = INTERVENTION (from Render 2)
  → Compute: isReplaceSessionTransition = false (INTERVENTION → INTERVENTION)
  → useEffect: Runs with isReplaceSessionTransition = false → CHECK RESUMES ✅
```

1. **Synchronous update** - Ref updated during render, before useEffect
2. **Correct timing** - Flag computed with previous value, then ref updated
3. **Pre-computed flag** - `isReplaceSessionTransition` calculated once during render
4. **No race conditions** - No dependency on useEffect execution order
5. **Deterministic** - Same render always produces same result

### Naming Improvement

Used `isReplaceSessionTransition` instead of `isInternalTransition` for clarity:
- Makes it crystal-clear which transition is being handled
- Prevents future misuse if other internal transitions are added
- Self-documenting code

## Testing Checklist

### Test Case 1: Quick Task → Intervention (The Bug)
- [ ] Open Instagram → Quick Task dialog appears
- [ ] Click "conscious_process" button
- [ ] **Expected**: Breathing screen appears (countdown from 5)
- [ ] **Verify logs**:
  - ✅ `Skipping user left check - REPLACE_SESSION transition (QUICK_TASK → INTERVENTION)`
  - ✅ NO `Intervention Session ended - user left app` immediately after
  - ✅ Breathing countdown proceeds normally (5 → 4 → 3 → 2 → 1 → 0)

### Test Case 2: Real User Exit During Intervention
- [ ] Open Instagram → Start intervention (breathing screen)
- [ ] Press home button during breathing
- [ ] **Expected**: Session ends, home screen appears
- [ ] **Verify logs**:
  - ✅ `Intervention Session ended - user left app`
  - ✅ `END_SESSION`

### Test Case 3: Multiple REPLACE_SESSION Transitions
- [ ] Quick Task → Intervention → Complete
- [ ] Quick Task again → Intervention again
- [ ] **Expected**: Each transition works correctly
- [ ] **Verify**: Skip message appears each time

## Files Modified

1. ✅ `app/roots/SystemSurfaceRoot.tsx` - Moved ref update from useEffect to render (lines 142-167, 327-371)

## Architecture Compliance

✅ **No changes to System Brain** - Pure UI-layer fix

✅ **No changes to native code** - JavaScript-only

✅ **Preserves Phase 2 architecture** - No changes to wake reasons

✅ **Session semantics preserved** - Still ends session when user genuinely leaves

✅ **Deterministic** - Synchronous update, no timing dependencies

✅ **React best practices** - Standard pattern for tracking previous values with refs

## Key Learnings

1. **useEffect execution order is not guaranteed to help with ref updates** - Multiple useEffects in the same batch see the same snapshot of refs

2. **Update refs during render for tracking previous values** - This is a standard React pattern:
   ```typescript
   const prevValueRef = useRef();
   const prevValue = prevValueRef.current;
   prevValueRef.current = currentValue;
   // Now prevValue has the old value, ref has the new value
   ```

3. **Pre-compute flags during render** - Calculate derived state during render, not in useEffect

4. **Name flags clearly** - `isReplaceSessionTransition` is better than `isInternalTransition`

5. **Synchronous beats asynchronous** - When timing matters, do it during render, not in effects

## Related Documentation

- `docs/REPLACE_SESSION_FIX.md` - Original REPLACE_SESSION race condition fix
- `docs/QUICK_TASK_WRONG_APP_FIX.md` - Session mismatch at bootstrap boundary
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
