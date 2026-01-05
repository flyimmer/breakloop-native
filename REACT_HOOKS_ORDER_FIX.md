# React Hooks Order Fix - SystemSurfaceRoot

**Date:** January 5, 2026  
**Issue:** App crashes with "Rendered more hooks than during the previous render"  
**Root Cause:** Conditional `useEffect` hook violates React's Rules of Hooks  
**Solution:** Move `useEffect` before early return to ensure consistent hook order

---

## Problem Summary

After implementing the duplicate event filter fix, the app crashed with the following error:

```
ERROR  React has detected a change in the order of Hooks called by SystemSurfaceRoot. 
This will lead to bugs and errors if not fixed. 
For more information, read the Rules of Hooks: https://react.dev/link/rules-of-hooks

  Previous render            Next render
  ------------------------------------------------------
  1. useContext              useContext
  2. useState                useState
  3. useEffect               useEffect
  4. undefined               useEffect  ← NEW HOOK APPEARED!

ERROR  [Error: Rendered more hooks than during the previous render.]
```

---

## Root Cause Analysis

### The Problematic Code Structure

**File:** `app/roots/SystemSurfaceRoot.tsx`

```typescript
export default function SystemSurfaceRoot() {
  const { session, bootstrapState, ... } = useSystemSession(); // Hook 1: useContext
  const [bootstrapInitialized, ...] = useState(false);          // Hook 2: useState

  useEffect(() => {                                             // Hook 3: useEffect
    // Bootstrap initialization logic
  }, [bootstrapInitialized, dispatchSystemEvent]);

  // EARLY RETURN (conditional)
  if (!bootstrapInitialized || bootstrapState === 'BOOTSTRAPPING') {
    return null; // ← EXITS HERE on first render
  }

  // This useEffect is AFTER the early return!
  useEffect(() => {                                             // Hook 4: useEffect (CONDITIONAL!)
    if (bootstrapState === 'READY' && session === null) {
      finishSystemSurfaceActivity();
    }
  }, [session, bootstrapState]);

  // ... rest of component
}
```

### Why This Causes a Crash

**First Render (Bootstrap Phase):**
1. `bootstrapState === 'BOOTSTRAPPING'`
2. Hooks called: `useContext` → `useState` → `useEffect` (bootstrap init)
3. Early return at line 152 → **Only 3 hooks called**
4. Component returns `null`

**Second Render (After Bootstrap):**
1. `bootstrapState === 'READY'`
2. Hooks called: `useContext` → `useState` → `useEffect` (bootstrap init)
3. Early return condition is FALSE → continues past line 152
4. **NEW hook appears:** `useEffect` (session cleanup) → **4 hooks called**
5. React detects hook count mismatch → **CRASH**

### React's Rules of Hooks

From [React documentation](https://react.dev/link/rules-of-hooks):

> **Only Call Hooks at the Top Level**
> 
> Don't call Hooks inside loops, conditions, or nested functions. Instead, always use Hooks at the top level of your React function, before any early returns.

The second `useEffect` was placed **after** an early return, making it conditional. This violates the rule.

---

## Solution

Move the second `useEffect` **before** the early return so it's always called in the same order.

### Fixed Code Structure

```typescript
export default function SystemSurfaceRoot() {
  const { session, bootstrapState, ... } = useSystemSession(); // Hook 1: useContext
  const [bootstrapInitialized, ...] = useState(false);          // Hook 2: useState

  // Hook 3: Bootstrap initialization
  useEffect(() => {
    // Bootstrap initialization logic
  }, [bootstrapInitialized, dispatchSystemEvent]);

  // Hook 4: Session cleanup (MOVED BEFORE EARLY RETURN)
  useEffect(() => {
    if (bootstrapState === 'READY' && session === null) {
      finishSystemSurfaceActivity();
    }
  }, [session, bootstrapState]);

  // EARLY RETURN (now all hooks are called before this)
  if (!bootstrapInitialized || bootstrapState === 'BOOTSTRAPPING') {
    return null;
  }

  // ... rest of component
}
```

### Why This Works

**First Render (Bootstrap Phase):**
1. Hooks called: `useContext` → `useState` → `useEffect` (bootstrap) → `useEffect` (cleanup)
2. **4 hooks called**
3. Early return at line 152
4. Component returns `null`

**Second Render (After Bootstrap):**
1. Hooks called: `useContext` → `useState` → `useEffect` (bootstrap) → `useEffect` (cleanup)
2. **4 hooks called** (same as first render!)
3. Early return condition is FALSE → continues past line 152
4. Renders intervention UI
5. **No crash** - hook order is consistent

---

## Code Changes

**File:** `app/roots/SystemSurfaceRoot.tsx`

**Before:**
```typescript
  }, [bootstrapInitialized, dispatchSystemEvent]);

  /**
   * BOOTSTRAP PHASE: Wait for JS to establish session
   */
  if (!bootstrapInitialized || bootstrapState === 'BOOTSTRAPPING') {
    return null;
  }

  /**
   * RULE 4: Session is the ONLY authority for SystemSurface existence
   */
  useEffect(() => {
    if (bootstrapState === 'READY' && session === null) {
      finishSystemSurfaceActivity();
    }
  }, [session, bootstrapState]);
```

**After:**
```typescript
  }, [bootstrapInitialized, dispatchSystemEvent]);

  /**
   * RULE 4: Session is the ONLY authority for SystemSurface existence
   * When session becomes null (and bootstrap is complete), finish activity
   * 
   * IMPORTANT: This useEffect must be called BEFORE any early returns
   * to comply with React's Rules of Hooks.
   */
  useEffect(() => {
    if (bootstrapState === 'READY' && session === null) {
      finishSystemSurfaceActivity();
    }
  }, [session, bootstrapState]);

  /**
   * BOOTSTRAP PHASE: Wait for JS to establish session
   */
  if (!bootstrapInitialized || bootstrapState === 'BOOTSTRAPPING') {
    return null;
  }
```

**Key Changes:**
1. Moved session cleanup `useEffect` before the early return
2. Added comment explaining why this placement is required
3. No logic changes - only reordering

---

## Expected Behavior After Fix

### Successful Flow

```
1. First Render (Bootstrap):
   - All 4 hooks called
   - bootstrapState === 'BOOTSTRAPPING'
   - Early return → render null
   - No crash ✓

2. Bootstrap Initialization:
   - Read Intent extras
   - Call handleForegroundAppChange() with force: true
   - OS Trigger Brain dispatches START_INTERVENTION
   - bootstrapState becomes 'READY'

3. Second Render (After Bootstrap):
   - All 4 hooks called (same order!)
   - bootstrapState === 'READY'
   - Early return condition FALSE
   - Render InterventionFlow ✓
   - No crash ✓
```

---

## Testing

### Test Scenario
1. Build and install app: `npm run android`
2. Enable Accessibility Service
3. Add Instagram to monitored apps
4. Close BreakLoop app
5. Open Instagram

### Expected Result
- ✅ No "Rendered more hooks" error
- ✅ No app crash
- ✅ SystemSurfaceActivity launches
- ✅ Bootstrap completes
- ✅ Breathing screen appears
- ✅ Intervention flow works correctly

### Expected Logs

```
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: {triggeringApp: "com.instagram.android", ...}
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] Duplicate event BUT force === true (SystemSurface bootstrap) - will re-evaluate logic
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] Starting INTERVENTION session for app: com.instagram.android
[SystemSession] Bootstrap phase complete - session established
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

**No errors, no crashes!**

---

## Why This Error Occurred

This error was introduced when implementing the duplicate event filter fix. The fix itself was correct, but it exposed a pre-existing hooks ordering issue in `SystemSurfaceRoot.tsx`.

The hooks ordering issue existed before but wasn't triggered because:
1. The previous code had a different bug (context mismatch)
2. The component never successfully transitioned from BOOTSTRAPPING to READY
3. The second `useEffect` was never reached

Once the context mismatch was fixed and bootstrap started working correctly, the component began transitioning between states, which triggered the hooks ordering violation.

---

## Lessons Learned

### React Hooks Rules (Critical)

1. **All hooks must be called in the same order on every render**
2. **Never place hooks after early returns**
3. **Never place hooks inside conditionals**
4. **Never place hooks inside loops**

### Best Practice for Components with Early Returns

```typescript
function MyComponent() {
  // ✅ CORRECT: All hooks at the top
  const value1 = useContext(MyContext);
  const [state1, setState1] = useState(false);
  
  useEffect(() => {
    // Effect 1
  }, []);
  
  useEffect(() => {
    // Effect 2
  }, []);
  
  // ✅ Early returns AFTER all hooks
  if (someCondition) {
    return null;
  }
  
  // Rest of component
}
```

```typescript
function MyComponent() {
  // ❌ WRONG: Hook after early return
  const value1 = useContext(MyContext);
  const [state1, setState1] = useState(false);
  
  useEffect(() => {
    // Effect 1
  }, []);
  
  // ❌ Early return BEFORE a hook
  if (someCondition) {
    return null;
  }
  
  // ❌ This hook is conditional!
  useEffect(() => {
    // Effect 2
  }, []);
}
```

---

## Related Documents

- [`DUPLICATE_EVENT_FILTER_FIX.md`](DUPLICATE_EVENT_FILTER_FIX.md) - Previous fix that exposed this issue
- [`CONTEXT_MISMATCH_FIX.md`](CONTEXT_MISMATCH_FIX.md) - Context mismatch fix
- [`BOOTSTRAP_PHASE_FIX.md`](BOOTSTRAP_PHASE_FIX.md) - Bootstrap phase implementation
- [React Rules of Hooks](https://react.dev/link/rules-of-hooks) - Official React documentation

---

## Conclusion

The app crash was caused by a React Hooks ordering violation in `SystemSurfaceRoot.tsx`. A `useEffect` hook was placed after an early return, making it conditional and causing React to detect a hook count mismatch between renders.

The fix was simple: move the `useEffect` before the early return to ensure all hooks are called in the same order on every render. This is a one-line change (reordering) with no logic modifications.

The fix complies with React's Rules of Hooks and ensures the component can safely transition between bootstrap and ready states without crashing.
