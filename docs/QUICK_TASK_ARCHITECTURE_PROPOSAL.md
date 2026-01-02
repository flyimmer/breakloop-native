# Quick Task Architecture Proposal: Separation from Intervention

**Date:** December 30, 2024  
**Status:** Proposal for Future Refactoring

## Problem Statement

Currently, Quick Task is **mixed into** the intervention state machine. This creates conceptual confusion because:

1. **Quick Task is not an intervention** - It's a bypass mechanism
2. **Quick Task has higher priority** - Should be checked before intervention starts
3. **State machine complexity** - Intervention state machine handles both intervention and Quick Task
4. **Unclear boundaries** - Hard to understand where Quick Task ends and intervention begins

## Current Architecture (Mixed)

### Flow

```
User opens monitored app
  ↓
BEGIN_INTERVENTION dispatched (with quickTaskRemaining)
  ↓
Intervention state machine decides:
  - If quickTaskRemaining > 0 → state = 'quick_task_dialog'
  - If quickTaskRemaining = 0 → state = 'breathing'
  ↓
If 'quick_task_dialog':
  - User clicks "Quick Task" → ACTIVATE_QUICK_TASK → state = 'idle'
  - User clicks "Continue" → PROCEED_TO_BREATHING → state = 'breathing'
  ↓
If 'breathing':
  - Start intervention flow
```

### Issues

**1. Conceptual Confusion**
```javascript
// Quick Task is treated as an intervention state
state: 'quick_task_dialog' | 'breathing' | 'root-cause' | ...
//      ^^^^^^^^^^^^^^^^^^^ Not really an intervention phase
```

**2. Mixed Responsibilities**
```javascript
case 'BEGIN_INTERVENTION':
  // This action does TWO things:
  // 1. Start intervention
  // 2. Decide whether to show Quick Task
  const hasQuickTaskAvailable = action.quickTaskRemaining > 0;
  const initialState = hasQuickTaskAvailable ? 'quick_task_dialog' : 'breathing';
```

**3. State Machine Pollution**
- Intervention state machine handles Quick Task logic
- Quick Task actions (`ACTIVATE_QUICK_TASK`, `PROCEED_TO_BREATHING`) mixed with intervention actions
- Hard to understand intervention flow in isolation

**4. Tight Coupling**
- Can't show Quick Task without starting intervention
- Can't modify Quick Task logic without touching intervention state machine
- Testing intervention requires mocking Quick Task state

## Proposed Architecture (Separated)

### Conceptual Model

```
Quick Task = Pre-Intervention Decision Layer
Intervention = Full Mindfulness Flow

Quick Task has HIGHER PRIORITY than intervention
```

### Flow

```
User opens monitored app
  ↓
osTriggerBrain checks Quick Task availability
  ↓
  ┌─────────────────────────────────────┐
  │ Quick Task Available?               │
  └─────────────────────────────────────┘
           │                    │
           │ YES                │ NO
           ↓                    ↓
  ┌─────────────────┐   ┌──────────────────┐
  │ SHOW_QUICK_TASK │   │ BEGIN_INTERVENTION│
  └─────────────────┘   └──────────────────┘
           │                    │
    ┌──────┴──────┐            ↓
    │             │      (Breathing screen)
    ↓             ↓
[Quick Task]  [Continue]
    │             │
    ↓             └──────────────┐
Set timer              BEGIN_INTERVENTION
Allow app                    ↓
                      (Breathing screen)
```

### Implementation

#### 1. Separate Quick Task State

**New state management:**
```typescript
// Quick Task state (separate from intervention)
interface QuickTaskState {
  visible: boolean;
  targetApp: string | null;
  remaining: number;
}

// Intervention state (pure intervention only)
interface InterventionState {
  state: 'idle' | 'breathing' | 'root-cause' | 'alternatives' | 'action' | 'action_timer' | 'timer' | 'reflection';
  // No 'quick_task_dialog' state
  targetApp: string | null;
  breathingCount: number;
  selectedCauses: string[];
  selectedAlternative: any | null;
  actionTimer: number;
  // No quickTaskRemaining field
}
```

#### 2. Separate Actions

**Quick Task actions:**
```typescript
// Show Quick Task decision screen
{ type: 'SHOW_QUICK_TASK', app: string, remaining: number }

// User chose Quick Task
{ type: 'ACTIVATE_QUICK_TASK', app: string }

// User chose to continue with intervention
{ type: 'DECLINE_QUICK_TASK', app: string }

// Hide Quick Task screen
{ type: 'HIDE_QUICK_TASK' }
```

**Intervention actions (unchanged):**
```typescript
{ type: 'BEGIN_INTERVENTION', app: string, breathingDuration: number }
{ type: 'BREATHING_TICK' }
{ type: 'SELECT_CAUSE', causeId: string }
// ... etc
```

#### 3. Separate Screens/Components

**Quick Task Decision Screen:**
- Standalone screen, not part of intervention flow
- Shows before intervention starts
- Two buttons: "Quick Task" and "Continue intervention"

**Intervention Screens:**
- BreathingScreen
- RootCauseScreen
- AlternativesScreen
- etc.

No overlap between Quick Task and intervention screens.

#### 4. Navigation Flow

```typescript
// In osTriggerBrain.ts
function triggerIntervention(packageName: string, timestamp: number): void {
  const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);
  
  if (quickTaskRemaining > 0) {
    // Show Quick Task decision screen (HIGHER PRIORITY)
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
}
```

```typescript
// In App.tsx navigation handler
if (quickTaskState.visible) {
  navigationRef.current.navigate('QuickTaskDecision');
} else if (interventionState.state === 'breathing') {
  navigationRef.current.navigate('Breathing');
} else if (interventionState.state === 'root-cause') {
  navigationRef.current.navigate('RootCause');
}
// ... etc
```

#### 5. Quick Task Decision Handler

```typescript
// User clicks "Quick Task"
function handleQuickTask() {
  const { targetApp } = quickTaskState;
  
  // Set Quick Task timer
  setQuickTaskTimer(targetApp, getQuickTaskDurationMs(), Date.now());
  
  // Record usage
  recordQuickTaskUsage(targetApp, Date.now());
  
  // Mark intervention as completed (no intervention happened)
  onInterventionCompleted(targetApp);
  
  // Hide Quick Task screen
  dispatchQuickTask({ type: 'HIDE_QUICK_TASK' });
  
  // Finish InterventionActivity
  AppMonitorModule.finishInterventionActivity();
}

// User clicks "Continue intervention"
function handleContinueIntervention() {
  const { targetApp } = quickTaskState;
  
  // Hide Quick Task screen
  dispatchQuickTask({ type: 'HIDE_QUICK_TASK' });
  
  // Start intervention
  dispatchIntervention({
    type: 'BEGIN_INTERVENTION',
    app: targetApp,
    breathingDuration: getInterventionDurationSec(),
  });
}
```

## Benefits of Separation

### 1. Conceptual Clarity

**Before:**
```
"Quick Task is the first state of intervention"
→ Confusing: Is it part of intervention or not?
```

**After:**
```
"Quick Task is a pre-intervention decision"
→ Clear: It's a separate layer that happens before intervention
```

### 2. Higher Priority

**Before:**
```
BEGIN_INTERVENTION → Check Quick Task inside
→ Quick Task is checked after intervention starts
```

**After:**
```
Check Quick Task → If not available, BEGIN_INTERVENTION
→ Quick Task is checked before intervention starts (HIGHER PRIORITY)
```

### 3. Simpler State Machine

**Before:**
```javascript
// Intervention state machine handles Quick Task
case 'BEGIN_INTERVENTION':
  const hasQuickTaskAvailable = action.quickTaskRemaining > 0;
  const initialState = hasQuickTaskAvailable ? 'quick_task_dialog' : 'breathing';
  // Mixed logic

case 'ACTIVATE_QUICK_TASK':
  return { ...context, state: 'idle' };
  // Quick Task action in intervention reducer

case 'PROCEED_TO_BREATHING':
  return { ...context, state: 'breathing' };
  // Quick Task action in intervention reducer
```

**After:**
```javascript
// Intervention state machine is pure
case 'BEGIN_INTERVENTION':
  return {
    ...context,
    state: 'breathing', // Always starts with breathing
    targetApp: action.app,
    breathingCount: action.breathingDuration,
  };
  // No Quick Task logic

// Quick Task has its own reducer
case 'SHOW_QUICK_TASK':
  return { visible: true, targetApp: action.app, remaining: action.remaining };

case 'ACTIVATE_QUICK_TASK':
  return { visible: false, targetApp: null, remaining: 0 };
```

### 4. Independent Testing

**Before:**
```javascript
// To test intervention, must mock Quick Task state
test('intervention flow', () => {
  dispatch({ type: 'BEGIN_INTERVENTION', quickTaskRemaining: 0 });
  // Must set quickTaskRemaining to 0 to skip Quick Task
});
```

**After:**
```javascript
// Intervention tests don't care about Quick Task
test('intervention flow', () => {
  dispatch({ type: 'BEGIN_INTERVENTION', app: 'com.instagram.android' });
  // No Quick Task parameters needed
});

// Quick Task tests are separate
test('quick task flow', () => {
  dispatch({ type: 'SHOW_QUICK_TASK', app: 'com.instagram.android', remaining: 1 });
  // Test Quick Task in isolation
});
```

### 5. Easier Modifications

**Before:**
```
Want to change Quick Task UI?
→ Must modify intervention state machine
→ Risk breaking intervention flow
```

**After:**
```
Want to change Quick Task UI?
→ Only modify Quick Task component and reducer
→ Intervention flow is unaffected
```

## Migration Path

### Phase 1: Add Separate Quick Task State (Non-Breaking)

1. Create `QuickTaskProvider` with separate state
2. Keep existing intervention state machine as-is
3. Add Quick Task state alongside intervention state

**Result:** Both systems coexist, no breaking changes

### Phase 2: Refactor Navigation (Non-Breaking)

1. Check Quick Task state first in navigation
2. If Quick Task visible, show Quick Task screen
3. Otherwise, use intervention state for navigation

**Result:** Navigation respects Quick Task priority, no breaking changes

### Phase 3: Clean Up Intervention State Machine (Breaking)

1. Remove `'quick_task_dialog'` from intervention state
2. Remove `quickTaskRemaining` from intervention context
3. Remove `ACTIVATE_QUICK_TASK` and `PROCEED_TO_BREATHING` from intervention reducer
4. Update `BEGIN_INTERVENTION` to always start with `'breathing'`

**Result:** Clean separation, intervention state machine is pure

### Phase 4: Update osTriggerBrain (Breaking)

1. Change `triggerIntervention()` to dispatch `SHOW_QUICK_TASK` or `BEGIN_INTERVENTION`
2. Remove Quick Task logic from intervention dispatcher

**Result:** osTriggerBrain decides Quick Task vs Intervention at trigger time

## Comparison: Current vs Proposed

| Aspect | Current (Mixed) | Proposed (Separated) |
|--------|----------------|---------------------|
| **Conceptual Model** | Quick Task is first intervention state | Quick Task is pre-intervention decision |
| **Priority** | Checked inside intervention | Checked before intervention |
| **State Machine** | Intervention handles Quick Task | Separate Quick Task state |
| **Actions** | Mixed Quick Task + Intervention | Separate action types |
| **Testing** | Must mock Quick Task in intervention tests | Test independently |
| **Modifications** | Changes affect both systems | Changes are isolated |
| **Code Clarity** | Mixed responsibilities | Clear separation |

## Recommendation

**For Current Implementation:**
- ✅ Keep current architecture for now (it works)
- ✅ Document the mixing clearly
- ✅ Add comments explaining Quick Task is conceptually separate

**For Future Refactoring:**
- 🔄 Consider separation when adding new features
- 🔄 Migrate gradually using non-breaking phases
- 🔄 Prioritize if Quick Task logic becomes more complex

## Conclusion

You're absolutely right that Quick Task and Intervention should be separate. The current implementation mixes them for simplicity, but a cleaner architecture would:

1. **Check Quick Task first** (higher priority)
2. **Show Quick Task decision** if available
3. **Start intervention** only if user declines Quick Task or quota exhausted

This separation would make the code:
- More maintainable
- Easier to test
- Conceptually clearer
- More flexible for future changes

The current implementation works, but the proposed architecture is the "right" way to do it.

