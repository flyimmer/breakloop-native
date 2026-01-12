# Phase 4.2: ACTIVE Phase Silent Fix

## Bug Report

**Timestamp**: 18:21  
**Symptom**: User clicks "Start Quick Task" → screen darkens briefly → dialog remains → nothing happens

## Root Cause

The code was trying to show a UI screen for the ACTIVE phase by calling:
```typescript
await launchSystemSurface(app, 'QUICK_TASK_ACTIVE');
```

But `QUICK_TASK_ACTIVE` is not a valid wake reason that SystemSurfaceRoot recognizes, causing it to default back to the `QUICK_TASK` session (dialog), creating a loop.

## The Fundamental Issue

**ACTIVE phase is NOT a UI phase. It is an enforcement phase.**

In Phase 4.2, Quick Task ACTIVE phase must be:
- **Native-only**: No JS involvement
- **Silent**: No UI shown
- **Enforcement-only**: Timer runs in background

The user does not need to see a timer screen. They already made their choice. Native enforces the timer silently.

## The Fix

### 1. Updated `src/systemBrain/eventHandler.ts`

Changed `handleQuickTaskCommand()` to NOT launch SystemSurface for ACTIVE phase:

**Before**:
```typescript
case 'START_QUICK_TASK_ACTIVE':
  console.log('[System Brain] ✅ EXECUTING: Start Quick Task ACTIVE phase');
  await launchSystemSurface(app, 'QUICK_TASK_ACTIVE');
  break;
```

**After**:
```typescript
case 'START_QUICK_TASK_ACTIVE':
  // Native started ACTIVE phase - close SystemSurface, user continues using app
  // ACTIVE phase is native-only, silent enforcement
  // UI will only reappear on expiration (POST_QUICK_TASK_CHOICE)
  console.log('[System Brain] ✅ EXECUTING: Start Quick Task ACTIVE phase (silent)');
  console.log('[System Brain] Native timer started, closing SystemSurface');
  console.log('[System Brain] User continues using app, Native enforces timer');
  // SystemSurface will close via session end (no new session created)
  break;
```

### 2. Updated `app/screens/conscious_process/QuickTaskDialogScreen.tsx`

Changed `handleQuickTask()` to close SystemSurface immediately after Native accepts:

**Before**:
```typescript
await AppMonitorModule.quickTaskAccept(session.app, durationMs);
console.log('[QuickTaskDialog] Waiting for Native commands...');

setTimeout(() => {
  setIsProcessing(false);
}, 2000);
```

**After**:
```typescript
await AppMonitorModule.quickTaskAccept(session.app, durationMs);
console.log('[QuickTaskDialog] ACTIVE phase is silent - closing SystemSurface');

// PHASE 4.2: ACTIVE phase is silent - close SystemSurface immediately
console.log('[QuickTaskDialog] Closing SystemSurface, user returns to app');

setTransientTargetApp(session.app);
safeEndSession(false);
console.log('[QuickTaskDialog] SystemSurface closed, user continues using app');

setIsProcessing(false);
```

## Correct Flow (After Fix)

```
User clicks "Start Quick Task"
  ↓
JS: AppMonitorModule.quickTaskAccept(app, durationMs)
  ↓
Native: onQuickTaskAccepted()
  - entry.state = ACTIVE
  - entry.expiresAt = now + durationMs
  - decrementGlobalQuota()
  - persistState()
  - startNativeTimer()
  - emitStartQuickTaskActive()
  ↓
JS: handleQuickTaskCommand("START_QUICK_TASK_ACTIVE")
  - Does nothing (no UI launch)
  ↓
JS: QuickTaskDialogScreen.handleQuickTask()
  - Calls safeEndSession(false)
  - SystemSurface closes
  ↓
User returns to Instagram
  - Continues using app normally
  - Native timer runs silently in background
  ↓
(3 minutes later)
  ↓
Native: onQuickTaskTimerExpired()
  - Checks if app is foreground
  - If foreground: emitShowPostQuickTaskChoice()
  - If background: silent cleanup
  ↓
(If foreground)
  ↓
JS: handleQuickTaskCommand("SHOW_POST_QUICK_TASK_CHOICE")
  - launchSystemSurface(app, 'POST_QUICK_TASK_CHOICE')
  ↓
SystemSurface shows POST_CHOICE screen
```

## Why This Fix Works

### Eliminates UI Churn
- No "dark flash" when starting Quick Task
- No dialog reappearing
- Clean transition back to app

### Removes Split Authority
- JS completely out of ACTIVE phase
- Native owns timer enforcement
- No wake reason mismatch

### Simplifies Architecture
- No new session kind needed
- No new wake reason needed
- ACTIVE phase is pure enforcement

### Better UX
- User gets immediate access to app
- No confusing timer screen
- Clean, predictable behavior

## What Happens on Expiration

### Foreground Expiration
```
Native timer expires
  ↓
Native: isAppForeground(app) → true
  ↓
Native: entry.state = POST_CHOICE
Native: emitShowPostQuickTaskChoice(app)
  ↓
JS: launchSystemSurface(app, 'POST_QUICK_TASK_CHOICE')
  ↓
SystemSurface shows choice screen:
  - "Continue using this app"
  - "Quit this app"
```

### Background Expiration
```
Native timer expires
  ↓
Native: isAppForeground(app) → false
  ↓
Native: quickTaskMap.remove(app)
Native: clearPersistedState(app)
  ↓
Silent cleanup, no UI
```

## Key Architectural Principles

### ACTIVE Phase is NOT a UI Phase
- It's an enforcement phase
- User doesn't need to see it
- Native handles it silently

### UI Only Appears at Decision Points
1. **Entry**: Show Quick Task dialog (DECISION)
2. **Expiration (foreground)**: Show POST_CHOICE screen
3. **ACTIVE**: NO UI (silent enforcement)

### Native Owns Enforcement
- Timer management
- Expiration detection
- Foreground tracking
- State persistence

### JS is Passive
- Renders UI when commanded
- Sends user intents
- Never decides enforcement

## Testing

After rebuild, test:

1. **Basic Flow**:
   - Open Instagram
   - Click "Start Quick Task"
   - **Expected**: Dialog closes immediately, return to Instagram
   - **Expected**: No timer screen, no dark flash
   - **Expected**: Can use Instagram normally

2. **Expiration (Foreground)**:
   - Start Quick Task
   - Wait for expiration (stay in app)
   - **Expected**: POST_CHOICE screen appears
   - **Expected**: Shows "Continue" and "Quit" options

3. **Expiration (Background)**:
   - Start Quick Task
   - Switch to home screen
   - Wait for expiration
   - **Expected**: No UI appears (silent cleanup)
   - Open Instagram again
   - **Expected**: New entry decision (IDLE → DECISION)

## Why This Prevents Future Bugs

### No More Wake Reason Mismatches
- ACTIVE doesn't try to launch UI
- No invalid wake reasons
- No defaulting to wrong session

### No More UI State Bugs
- ACTIVE has no UI state
- Can't get stuck in UI loops
- Can't have stale UI

### No More Split Authority
- Native owns ACTIVE completely
- JS can't interfere
- Timer can't be broken by JS crashes

## Documentation Updates

This fix clarifies the Phase 4.2 architecture:

**Three UI Phases**:
1. **DECISION**: Show Quick Task dialog
2. **POST_CHOICE**: Show choice screen after expiration
3. **ACTIVE**: NO UI (silent enforcement)

**One Enforcement Phase**:
- **ACTIVE**: Native-only, silent, timer-based

---

**Status**: Fix implemented. Build running. Ready for testing.

**Expected Result**: Clean UX, no dark flash, no dialog loop, immediate return to app.
