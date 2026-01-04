# Bootstrap Phase Fix - SystemSurface Race Condition

**Date:** January 4, 2026  
**Issue:** SystemSurfaceActivity finishes immediately on launch, preventing intervention UI from appearing  
**Root Cause:** Race condition between Activity launch and session establishment  
**Solution:** Explicit bootstrap phase in SystemSession state machine

---

## Problem Summary

When a monitored app (e.g., Instagram) is opened:

1. **OS Trigger Brain** dispatches `START_INTERVENTION` event
2. **SystemSurfaceActivity** launches (new Android Activity)
3. **React Native** initializes with a **fresh context** (separate from MainActivity)
4. **SystemSessionProvider** starts with `session = null` (initial state)
5. **SystemSurfaceRoot** sees `session === null` and calls `finishSystemSurfaceActivity()`
6. **Activity finishes** before JS can establish the session
7. **User sees** home screen instead of intervention UI

### Why This Happened

The dual-Activity architecture means:
- **MainActivity** and **SystemSurfaceActivity** have separate React Native instances
- Each instance has its own JavaScript context
- Session state doesn't transfer between Activities
- SystemSurfaceActivity always starts with a clean slate

The race condition occurs because:
- SystemSurfaceRoot renders BEFORE OS Trigger Brain can dispatch the session event
- `session === null` on first render is ambiguous - it could mean:
  - "No session should exist" (MainActivity case)
  - "JS hasn't decided yet" (SystemSurfaceActivity cold start)

---

## Solution: Bootstrap Phase

We introduced an explicit **bootstrap state** to distinguish between:
- **"JS is still deciding"** (BOOTSTRAPPING)
- **"JS has made a decision"** (READY)

### Implementation

#### 1. Added Bootstrap State Type

```typescript
export type SessionBootstrapState = 'BOOTSTRAPPING' | 'READY';
```

#### 2. Extended SystemSessionState

```typescript
interface SystemSessionState {
  session: SystemSession;
  bootstrapState: SessionBootstrapState;  // NEW
  foregroundApp: string | null;
}
```

#### 3. Initial State Starts in Bootstrap

```typescript
const initialSystemSessionState: SystemSessionState = {
  session: null,
  bootstrapState: 'BOOTSTRAPPING',  // Start in bootstrap
  foregroundApp: null,
};
```

#### 4. All Session Events Exit Bootstrap

Every session event (`START_INTERVENTION`, `START_QUICK_TASK`, `START_ALTERNATIVE_ACTIVITY`, `END_SESSION`) transitions `bootstrapState` to `'READY'`:

```typescript
case 'START_INTERVENTION':
  return {
    ...state,
    session: { kind: 'INTERVENTION', app: event.app },
    bootstrapState: 'READY',  // Exit bootstrap
  };
```

This ensures bootstrap ends **only after JS makes a semantic decision**.

#### 5. SystemSurfaceRoot Respects Bootstrap

```typescript
export default function SystemSurfaceRoot() {
  const { session, bootstrapState, foregroundApp } = useSystemSession();

  // BOOTSTRAP PHASE: Wait for JS to decide
  if (bootstrapState === 'BOOTSTRAPPING') {
    return null;  // Don't finish activity yet
  }

  // READY PHASE: Enforce session lifecycle rules
  if (session === null) {
    finishSystemSurfaceActivity();  // Now it's safe to finish
    return null;
  }

  // Render based on session.kind
  switch (session.kind) {
    case 'INTERVENTION':
      return <InterventionFlow app={session.app} />;
    // ...
  }
}
```

---

## How It Works

### Before (Race Condition)

```
1. SystemSurfaceActivity launches
2. React Native initializes
3. SystemSessionProvider: { session: null }
4. SystemSurfaceRoot: session === null → finishSystemSurfaceActivity()
5. Activity finishes (RACE LOST)
6. OS Trigger Brain: dispatchSystemEvent({ type: 'START_INTERVENTION', ... }) (TOO LATE)
```

### After (Bootstrap Phase)

```
1. SystemSurfaceActivity launches
2. React Native initializes
3. SystemSessionProvider: { session: null, bootstrapState: 'BOOTSTRAPPING' }
4. SystemSurfaceRoot: bootstrapState === 'BOOTSTRAPPING' → return null (WAIT)
5. OS Trigger Brain: dispatchSystemEvent({ type: 'START_INTERVENTION', app: 'com.instagram.android' })
6. Reducer updates: { session: { kind: 'INTERVENTION', app: '...' }, bootstrapState: 'READY' }
7. SystemSurfaceRoot re-renders → sees session → renders InterventionFlow ✓
```

---

## Key Properties

### 1. Event-Driven Bootstrap Exit

Bootstrap ends **only when a session event is dispatched**:
- `START_INTERVENTION` → Session created, bootstrap ends
- `START_QUICK_TASK` → Session created, bootstrap ends
- `START_ALTERNATIVE_ACTIVITY` → Session created, bootstrap ends
- `END_SESSION` → Explicit "do nothing" decision, bootstrap ends

**No timers, no delays, purely semantic.**

### 2. Fail-Safe Behavior

If OS Trigger Brain decides "do nothing" (e.g., user has valid intention timer), it can dispatch `END_SESSION`:
- Sets `session = null`
- Sets `bootstrapState = 'READY'`
- SystemSurfaceRoot then finishes activity (correct behavior)

### 3. Zero Native Changes

This fix is **entirely in JavaScript**:
- No changes to `ForegroundDetectionService.kt`
- No changes to `SystemSurfaceActivity.kt`
- No changes to `AppMonitorModule.kt`
- Native code continues to "wake the app" - JS decides what to do

### 4. Preserves Architecture

- **Rule 1** (Alternative Activity visibility): Unchanged
- **Rule 2** (Event-driven modification): Unchanged
- **Rule 3** (No flow navigation): Unchanged
- **Rule 4** (Session authority): **Enhanced** with bootstrap semantics

---

## Files Modified

1. **`src/contexts/SystemSessionProvider.tsx`**
   - Added `SessionBootstrapState` type
   - Extended `SystemSessionState` with `bootstrapState`
   - Modified reducer to exit bootstrap on all session events
   - Updated initial state to start in `'BOOTSTRAPPING'`
   - Exposed `bootstrapState` in context value

2. **`app/roots/SystemSurfaceRoot.tsx`**
   - Added bootstrap phase check before session lifecycle enforcement
   - Renders `null` during bootstrap (no premature finish)
   - Only enforces `session === null → finish` after bootstrap completes

---

## Testing

To verify the fix:

1. **Open Instagram** (or any monitored app)
2. **Expected behavior:**
   - SystemSurfaceActivity launches
   - Brief moment with no UI (bootstrap phase)
   - Intervention UI appears (breathing screen)
   - No flash of home screen
   - No immediate activity finish

3. **Check logs:**
   ```
   [SystemSession] Bootstrap phase - waiting for session establishment
   [OS Trigger Brain] → START INTERVENTION FLOW
   [SystemSession] Starting INTERVENTION session for app: com.instagram.android
   [SystemSession] Bootstrap phase complete - session established
   [SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
   ```

---

## Why This Is The Right Fix

### ✅ Targeted
- Fixes the specific race condition
- No architectural changes
- No native code changes

### ✅ Semantic
- Bootstrap is a meaningful phase ("JS is deciding")
- Exit is event-driven (not timer-based)
- Aligns with existing session semantics

### ✅ Safe
- No fallback delays or timeouts
- Fail-safe behavior if JS decides "do nothing"
- Preserves all existing rules

### ✅ Minimal
- Two files modified
- ~50 lines of code added
- Zero breaking changes

---

## Alternative Approaches Considered (and Rejected)

### ❌ Timer-Based Delay
```typescript
setTimeout(() => {
  if (session === null) finishSystemSurfaceActivity();
}, 500);
```
**Rejected:** Not semantic, arbitrary delay, could still race

### ❌ Move Logic to Native
```kotlin
// Check if session exists before launching
if (hasValidSession(packageName)) {
  launchSystemSurfaceActivity(packageName);
}
```
**Rejected:** Violates Native-JavaScript boundary, duplicates logic

### ❌ Shared React Instance
Use single React Native instance across both Activities
**Rejected:** Complex, non-standard, breaks Activity isolation

### ✅ Bootstrap Phase (Chosen)
Explicit semantic phase, event-driven exit, zero native changes

---

## Conclusion

The bootstrap phase fix resolves the SystemSurface race condition by introducing a semantic gate that prevents premature activity finish during cold start. The fix is:

- **Targeted:** Solves the specific problem without changing architecture
- **Semantic:** Bootstrap is a meaningful phase, not a hack
- **Safe:** Event-driven exit, fail-safe behavior
- **Minimal:** Two files, ~50 lines of code

SystemSurfaceActivity now waits for JS to make a decision before enforcing session lifecycle rules.
