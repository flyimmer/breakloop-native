# Quick Task Refactoring - Complete

**Date:** December 30, 2024  
**Status:** ✅ Complete - Refactored to separate Quick Task from Intervention

## Summary

Quick Task has been successfully refactored to be **separate from intervention**, as it should be conceptually. Quick Task is now a **pre-intervention decision layer** with **higher priority** than intervention.

## What Changed

### Before (Mixed Architecture) ❌

```
BEGIN_INTERVENTION
  ↓
  Check quickTaskRemaining inside intervention
  ↓
  If > 0: state = 'quick_task_dialog' (part of intervention state machine)
  If = 0: state = 'breathing'
```

**Problems:**
- Quick Task was an intervention state
- Quick Task logic mixed into intervention reducer
- Conceptually confusing
- Hard to maintain and test

### After (Separated Architecture) ✅

```
Monitored app opened
  ↓
Check Quick Task availability (HIGHEST PRIORITY)
  ↓
  If available: SHOW_QUICK_TASK
    ├─ "Quick Task" → Set timer, finish activity
    └─ "Continue" → BEGIN_INTERVENTION
  ↓
  If not available: BEGIN_INTERVENTION directly
```

**Benefits:**
- Quick Task is separate from intervention
- Quick Task checked **before** intervention starts
- Clear separation of concerns
- Simpler intervention state machine
- Easier to test and maintain

## Files Created

### 1. QuickTaskProvider.tsx
**Location:** `src/contexts/QuickTaskProvider.tsx`

**Purpose:** Separate state management for Quick Task

**State:**
```typescript
interface QuickTaskState {
  visible: boolean;           // Whether Quick Task screen is visible
  targetApp: string | null;   // App that triggered Quick Task
  remaining: number;          // Number of uses remaining (global)
}
```

**Actions:**
- `SHOW_QUICK_TASK` - Show Quick Task decision screen
- `HIDE_QUICK_TASK` - Hide Quick Task screen
- `ACTIVATE_QUICK_TASK` - User chose Quick Task
- `DECLINE_QUICK_TASK` - User chose to continue with intervention

## Files Modified

### 1. osTriggerBrain.ts

**Changed:** `triggerIntervention()` function

**Before:**
```typescript
const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);

interventionDispatcher({
  type: 'BEGIN_INTERVENTION',
  app: packageName,
  breathingDuration: getInterventionDurationSec(),
  quickTaskRemaining, // Mixed into intervention
});
```

**After:**
```typescript
const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);

if (quickTaskRemaining > 0) {
  // Show Quick Task FIRST (higher priority)
  interventionDispatcher({
    type: 'SHOW_QUICK_TASK',
    app: packageName,
    remaining: quickTaskRemaining,
  });
} else {
  // Start intervention directly
  interventionDispatcher({
    type: 'BEGIN_INTERVENTION',
    app: packageName,
    breathingDuration: getInterventionDurationSec(),
  });
}
```

### 2. intervention/transitions.js

**Changed:** Removed Quick Task logic from intervention reducer

**Before:**
```javascript
case 'BEGIN_INTERVENTION':
  const hasQuickTaskAvailable = action.quickTaskRemaining > 0;
  const initialState = hasQuickTaskAvailable ? 'quick_task_dialog' : 'breathing';
  return { ...context, state: initialState, quickTaskRemaining: action.quickTaskRemaining };

case 'PROCEED_TO_BREATHING':
  return { ...context, state: 'breathing' };

case 'ACTIVATE_QUICK_TASK':
  return { ...context, state: 'idle' };
```

**After:**
```javascript
case 'BEGIN_INTERVENTION':
  // ALWAYS starts with breathing (no Quick Task logic)
  return { ...context, state: 'breathing' };

// REMOVED: PROCEED_TO_BREATHING and ACTIVATE_QUICK_TASK
// Quick Task is now handled by separate QuickTaskProvider
```

### 3. InterventionProvider.tsx

**Changed:** Removed Quick Task from intervention state type

**Before:**
```typescript
state: 'idle' | 'breathing' | 'quick_task_dialog' | 'root-cause' | ...
quickTaskRemaining: number;
```

**After:**
```typescript
state: 'idle' | 'breathing' | 'root-cause' | ... // No 'quick_task_dialog'
// No quickTaskRemaining field
```

### 4. App.tsx

**Changed:** Multiple updates

**A. Added QuickTaskProvider wrapper:**
```typescript
<SafeAreaProvider>
  <QuickTaskProvider>
    <InterventionProvider>
      <InterventionNavigationHandler />
    </InterventionProvider>
  </QuickTaskProvider>
</SafeAreaProvider>
```

**B. Created unified dispatcher:**
```typescript
const unifiedDispatcher = (action: any) => {
  if (action.type === 'SHOW_QUICK_TASK') {
    dispatchQuickTask(action); // Route to Quick Task
  } else {
    dispatchIntervention(action); // Route to Intervention
  }
};

setInterventionDispatcher(unifiedDispatcher);
```

**C. Updated initial trigger check:**
```typescript
const quickTaskRemaining = getQuickTaskRemaining(triggeringApp, now);

if (quickTaskRemaining > 0) {
  dispatchQuickTask({ type: 'SHOW_QUICK_TASK', app: triggeringApp, remaining: quickTaskRemaining });
} else {
  dispatchIntervention({ type: 'BEGIN_INTERVENTION', app: triggeringApp, breathingDuration: getInterventionDurationSec() });
}
```

**D. Updated navigation to check Quick Task first:**
```typescript
// HIGHEST PRIORITY: Check Quick Task state first
if (quickTaskState.visible) {
  navigationRef.current.navigate('QuickTaskDialog');
  return;
}

// Then check intervention state
if (state === 'breathing') {
  navigationRef.current.navigate('Breathing');
}
// ... etc
```

### 5. QuickTaskDialogScreen.tsx

**Changed:** Use Quick Task state instead of intervention state

**Before:**
```typescript
const { interventionState, dispatchIntervention } = useIntervention();
const { targetApp, quickTaskRemaining } = interventionState;

// Continue button
dispatchIntervention({ type: 'PROCEED_TO_BREATHING' });

// Quick Task button
dispatchIntervention({ type: 'ACTIVATE_QUICK_TASK' });
```

**After:**
```typescript
const { dispatchIntervention } = useIntervention();
const { quickTaskState, dispatchQuickTask } = useQuickTask();
const { targetApp, remaining: quickTaskRemaining } = quickTaskState;

// Continue button
dispatchQuickTask({ type: 'DECLINE_QUICK_TASK' });
dispatchIntervention({ type: 'BEGIN_INTERVENTION', app: targetApp, breathingDuration: getInterventionDurationSec() });

// Quick Task button
dispatchQuickTask({ type: 'ACTIVATE_QUICK_TASK' });
AppMonitorModule.finishInterventionActivity();
```

## Architecture Diagram

### New Flow

```
┌─────────────────────────────────────┐
│  User Opens Monitored App          │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│  osTriggerBrain.triggerIntervention │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│  Check Quick Task Availability      │
│  (HIGHEST PRIORITY)                 │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ↓                   ↓
┌───────────────┐   ┌───────────────────┐
│ Available     │   │ Not Available     │
│ (remaining>0) │   │ (remaining=0)     │
└───────┬───────┘   └────────┬──────────┘
        │                    │
        ↓                    ↓
┌───────────────────┐ ┌──────────────────┐
│ SHOW_QUICK_TASK   │ │ BEGIN_INTERVENTION│
│ (QuickTaskProvider│ │ (InterventionProvider)│
└────────┬──────────┘ └────────┬─────────┘
         │                     │
    ┌────┴────┐               ↓
    │         │         ┌─────────────┐
    ↓         ↓         │ Breathing   │
┌────────┐ ┌────────┐  │ Screen      │
│Quick   │ │Continue│  └─────────────┘
│Task    │ │        │
└───┬────┘ └───┬────┘
    │          │
    ↓          └──────────┐
Set timer           BEGIN_INTERVENTION
Finish activity           ↓
                    ┌─────────────┐
                    │ Breathing   │
                    │ Screen      │
                    └─────────────┘
```

## Key Principles

### 1. Separation of Concerns

**Quick Task:**
- Pre-intervention decision layer
- Managed by `QuickTaskProvider`
- Actions: `SHOW_QUICK_TASK`, `ACTIVATE_QUICK_TASK`, `DECLINE_QUICK_TASK`

**Intervention:**
- Full mindfulness flow
- Managed by `InterventionProvider`
- Actions: `BEGIN_INTERVENTION`, `BREATHING_TICK`, `SELECT_CAUSE`, etc.

### 2. Priority Order

```
1. Quick Task Timer (per-app) - HIGHEST
2. Quick Task Availability (global) - HIGH
3. Intention Timer (per-app) - MEDIUM
4. App Switch Interval (per-app) - LOW
5. Trigger Intervention - DEFAULT
```

### 3. State Independence

**Quick Task State:**
```typescript
{
  visible: boolean,
  targetApp: string | null,
  remaining: number
}
```

**Intervention State:**
```typescript
{
  state: 'idle' | 'breathing' | 'root-cause' | ...,
  targetApp: string | null,
  breathingCount: number,
  selectedCauses: string[],
  ...
}
```

No overlap, completely independent.

## Testing

### Test 1: Quick Task Available
```
1. Open Instagram (first time)
   ✅ Expected: Quick Task dialog appears
   ✅ Expected: Shows "You have 1 Quick Task remaining"
```

### Test 2: Quick Task Activated
```
1. Open Instagram → Quick Task dialog
2. Click "Quick Task"
   ✅ Expected: Instagram stays in foreground
   ✅ Expected: No intervention
```

### Test 3: Continue to Intervention
```
1. Open Instagram → Quick Task dialog
2. Click "Continue intervention"
   ✅ Expected: Breathing screen appears
   ✅ Expected: Full intervention flow starts
```

### Test 4: No Quick Task Available
```
1. Use Quick Task on Instagram
2. Open TikTok
   ✅ Expected: No Quick Task dialog
   ✅ Expected: Breathing screen appears directly
```

### Test 5: Global Quota
```
1. Use Quick Task on Instagram (1 use consumed)
2. Open TikTok
   ✅ Expected: No Quick Task dialog (quota exhausted)
   ✅ Expected: Breathing screen appears
```

## Benefits

### 1. Conceptual Clarity
- Quick Task is clearly a **pre-intervention decision**, not an intervention phase
- Easier to understand and explain

### 2. Higher Priority
- Quick Task is checked **before** intervention starts
- Correctly reflects that Quick Task has higher priority

### 3. Simpler State Machine
- Intervention state machine only handles intervention states
- No Quick Task logic mixed in
- Easier to understand and maintain

### 4. Independent Testing
- Quick Task can be tested independently
- Intervention can be tested without mocking Quick Task
- Better test isolation

### 5. Easier Modifications
- Changes to Quick Task don't affect intervention
- Changes to intervention don't affect Quick Task
- Better maintainability

## Migration Notes

### Breaking Changes

**For Developers:**
- `'quick_task_dialog'` is no longer an intervention state
- `quickTaskRemaining` is no longer in intervention context
- `PROCEED_TO_BREATHING` and `ACTIVATE_QUICK_TASK` are no longer intervention actions

**For Users:**
- No breaking changes - behavior is identical from user perspective

### Backward Compatibility

None - this is a complete architectural refactoring. The old mixed approach is no longer supported.

## Future Enhancements

Now that Quick Task is separate, we can easily:

1. **Add Quick Task Settings UI**
   - Customize duration (2/3/5 min)
   - Customize uses per window (1-2)
   - Premium feature toggles

2. **Add Quick Task Analytics**
   - Track Quick Task usage patterns
   - Show insights in Insights screen
   - Recommend optimal Quick Task usage

3. **Add Quick Task Variations**
   - "Quick Task with Intention" - Set intention before using
   - "Quick Task with Timer" - Show countdown in notification
   - "Quick Task with Reminder" - Remind when timer expires

4. **Add Quick Task Restrictions**
   - Time-of-day restrictions (e.g., no Quick Task after 10pm)
   - App-specific restrictions (e.g., no Quick Task for certain apps)
   - Context-based restrictions (e.g., no Quick Task during work hours)

All of these can be added to `QuickTaskProvider` without touching intervention logic.

## Conclusion

✅ **Refactoring complete!** Quick Task is now properly separated from intervention.

The new architecture is:
- **Conceptually clearer** - Quick Task is a pre-intervention decision
- **Technically cleaner** - Separate state management
- **More maintainable** - Independent testing and modifications
- **More flexible** - Easy to add new Quick Task features

This is the "right" way to implement Quick Task, as originally suggested by the user.

