# Blocking State Removal Fix

**Date:** January 9, 2026  
**Issue:** Quick Task expired screen showing incorrectly, buttons not working  
**Root Cause:** Persisted lifecycle flag (`blockingState`) causing zombie blocking across app sessions

---

## Problem Summary

### Bug #1: Wrong Screen Showing
When opening Instagram, `PostQuickTaskChoiceScreen` appeared instead of the expected Quick Task dialog or Intervention flow.

**Root Cause:**
- Previous session: Quick Task expired while user was in Instagram
- System Brain set `blockingState = { type: 'POST_QUICK_TASK_CHOICE', app: 'com.instagram.android' }`
- User left app without resolving the choice
- **BUG:** `blockingState` persisted to AsyncStorage (lifecycle flag should NEVER persist)
- User opens Instagram again
- System Brain loads persisted `blockingState`
- SystemSurfaceRoot sees `blockingState` and renders `PostQuickTaskChoiceScreen` **before** checking session
- OS Trigger Brain was blocked, so Quick Task dialog never showed

### Bug #2: Buttons Not Working
`PostQuickTaskChoiceScreen` expects `session.kind === 'POST_QUICK_TASK_CHOICE'`, but SystemSurfaceRoot rendered it based on `blockingState` **before** any session was established.

```typescript
// PostQuickTaskChoiceScreen.tsx:42
const targetApp = session?.kind === 'POST_QUICK_TASK_CHOICE' ? session.app : null;

// PostQuickTaskChoiceScreen.tsx:72, 98
if (isProcessing || !targetApp) return;  // ❌ targetApp is null!
```

When `blockingState` rendered the screen but `session === null`, all button handlers exited early.

### Bug #3: Architectural Violation
**From `stateManager.ts` comments:**
> "Lifecycle Invariant: If a flag describes 'what is happening now', it must never be persisted."

`blockingState` describes "user is currently blocked and must make a choice". This is a **lifecycle flag**, not semantic state.

**Why it's wrong:**
- Blocking state is tied to an active SystemSurface session
- When SystemSurface finishes, blocking state should be cleared
- Persisting it causes "zombie blocks" that survive across app launches
- User can't escape the blocking screen even after leaving the app

---

## Solution: Remove blockingState, Use Session-Based Blocking

### ❌ What Was Removed

1. **`blockingState` from `TimerState` interface** (stateManager.ts)
2. **`blockingState` from persistence logic** (loadTimerState, saveTimerState)
3. **`blockingState` guards in event handlers** (eventHandler.ts)
4. **`blockingState` rendering in SystemSurfaceRoot** (SystemSurfaceRoot.tsx)

### ✅ Correct Pattern (Already Existed)

**1. System Brain (Headless):**
When Quick Task expires in foreground:
```typescript
setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');
state.lastSemanticChangeTs = Date.now();
```

**2. SystemSurfaceRoot (UI):**
Observes `nextSessionOverride` and dispatches session transition:
```typescript
const override = getNextSessionOverride();
if (override.kind === 'POST_QUICK_TASK_CHOICE' && session.kind === 'QUICK_TASK') {
  dispatchSystemEvent({
    type: 'REPLACE_SESSION',
    newKind: 'POST_QUICK_TASK_CHOICE',
    app: override.app,
  });
  clearNextSessionOverride();
}
```

**3. Render based on session:**
```typescript
if (session.kind === 'POST_QUICK_TASK_CHOICE') {
  return <PostQuickTaskChoiceScreen />;
}
```

---

## Changes Made

### 1. src/systemBrain/stateManager.ts

**Removed from TimerState:**
```typescript
- blockingState: null | {
-   type: 'POST_QUICK_TASK_CHOICE' | 'INTERVENTION';
-   app: string;
- };
```

**Updated loadTimerState():**
- Removed `blockingState: state.blockingState || null` from baseState
- Added migration to delete any persisted `blockingState` from old code

**Updated saveTimerState():**
- No changes needed (blockingState no longer in TimerState)

**Updated clearBlockingState():**
- Now only clears `expiredQuickTask` flag (legacy cleanup)
- Removed blockingState clearing logic

### 2. src/systemBrain/eventHandler.ts

**Updated handleTimerExpiration():**
When Quick Task expires in foreground:
```typescript
- state.blockingState = { type: 'POST_QUICK_TASK_CHOICE', app: packageName };
+ setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');
+ state.lastSemanticChangeTs = Date.now();
```

**Removed blocking state guards:**
- Removed from `handleUserInteraction()` (line ~270)
- Removed from `handleForegroundChange()` (line ~536)

### 3. app/roots/SystemSurfaceRoot.tsx

**Removed blocking state rendering:**
```typescript
- const systemBrainState = getInMemoryStateCache();
- const blockingState = systemBrainState?.blockingState;
- if (blockingState) {
-   if (blockingState.type === 'POST_QUICK_TASK_CHOICE') {
-     return <PostQuickTaskChoiceScreen />;
-   }
- }
```

**Session-based rendering already exists:**
```typescript
switch (session.kind) {
  case 'POST_QUICK_TASK_CHOICE':
    return <PostQuickTaskChoiceScreen />;
  // ... other cases
}
```

---

## How It Works Now

### Scenario 1: Quick Task Expires in Foreground

1. User is in Quick Task session (Instagram)
2. Timer expires → System Brain handles TIMER_EXPIRED event
3. System Brain sets `nextSessionOverride('POST_QUICK_TASK_CHOICE')`
4. System Brain updates `lastSemanticChangeTs` to trigger UI reactivity
5. SystemSurfaceRoot observes `nextSessionOverride` (via useEffect dependency on `lastSemanticChangeTs`)
6. SystemSurfaceRoot dispatches `REPLACE_SESSION` (QUICK_TASK → POST_QUICK_TASK_CHOICE)
7. Session becomes `{ kind: 'POST_QUICK_TASK_CHOICE', app: 'com.instagram.android' }`
8. SystemSurfaceRoot renders `PostQuickTaskChoiceScreen` based on `session.kind`
9. Buttons work because `targetApp = session.app` is valid

### Scenario 2: User Leaves Without Choosing

1. User is on PostQuickTaskChoiceScreen
2. User switches to different app (e.g., goes to home screen)
3. SystemSurfaceRoot detects underlying app change
4. SystemSurfaceRoot calls `safeEndSession(true)` (go to home)
5. Session becomes `null`
6. SystemSurfaceRoot finishes activity
7. **No state persists** - `nextSessionOverride` is in-memory only

### Scenario 3: User Reopens Instagram

1. User opens Instagram fresh
2. Native detects monitored app → emits FOREGROUND_CHANGED event
3. System Brain evaluates OS Trigger Brain (no blocking, no stale state)
4. Decision: QUICK_TASK or INTERVENTION (based on quota)
5. System Brain launches SystemSurface with wake reason
6. SystemSurfaceRoot bootstraps with correct session
7. ✅ Correct screen shows (Quick Task dialog or Intervention)

---

## Key Architectural Lessons

### 1. Lifecycle Flags Must Never Persist
**Rule:** If a flag describes "what is happening now", it must never be persisted.

**Examples:**
- ✅ `isSystemSurfaceActive` - in-memory only
- ✅ `nextSessionOverride` - in-memory only
- ❌ `blockingState` - was persisted (BUG)

### 2. Session is the Single Source of Truth
SystemSurfaceRoot should ONLY render based on `session.kind`.

**Never:**
- Render UI without a session
- Check flags to decide what to render
- Duplicate session logic in multiple places

### 3. Blocking is a Session, Not a State
"Blocking" is not a separate state - it's a session kind.

**Correct:**
```typescript
session = { kind: 'POST_QUICK_TASK_CHOICE', app: 'com.instagram.android' }
```

**Wrong:**
```typescript
blockingState = { type: 'POST_QUICK_TASK_CHOICE', app: 'com.instagram.android' }
```

### 4. In-Memory Coordination is Sufficient
`nextSessionOverride` is in-memory only and works perfectly because:
- System Brain and SystemSurface run in same process
- No race conditions (synchronous access)
- Automatically cleared on app restart (correct behavior)

---

## Testing Checklist

### ✅ Acceptance Criteria

1. **Open Instagram fresh**
   - → Quick Task dialog (if quota > 0)
   - → Intervention flow (if quota = 0)

2. **Quick Task expires in foreground**
   - → Post-Quick-Task Choice screen appears
   - → Both buttons work

3. **Press "Continue using this app"**
   - → Quick Task dialog (if quota > 0)
   - → Intervention flow (if quota = 0)

4. **Press "Quit this app"**
   - → Home screen

5. **Leave app without choosing**
   - → Reopen Instagram
   - → Quick Task dialog (NOT stale post screen)

6. **Buttons always work**
   - → No null `targetApp` errors

---

## Migration Notes

### For Users with Stale blockingState

The fix includes migration logic in `loadTimerState()`:
```typescript
// Migration: Delete any persisted blockingState from old code
if (state.blockingState) {
  console.log('[System Brain] Migrating: removing persisted blockingState (lifecycle flag should never persist)');
}
```

This ensures users who had the bug will be automatically cleaned up on next app launch.

---

## Related Files

- `src/systemBrain/stateManager.ts` - State persistence, removed blockingState
- `src/systemBrain/eventHandler.ts` - Event handling, removed blocking guards
- `app/roots/SystemSurfaceRoot.tsx` - UI root, removed blockingState rendering
- `app/screens/conscious_process/PostQuickTaskChoiceScreen.tsx` - Screen component (unchanged)

---

## Conclusion

The fix restores the correct architectural pattern:
- **System Brain** sets in-memory `nextSessionOverride`
- **SystemSurfaceRoot** observes and dispatches `REPLACE_SESSION`
- **Session** is the single source of truth for rendering
- **No lifecycle flags persist** across app sessions

This eliminates zombie blocking states and ensures buttons always work correctly.
