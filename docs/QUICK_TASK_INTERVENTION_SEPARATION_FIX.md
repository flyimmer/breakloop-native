# Quick Task and Intervention Separation Fix

**Date:** December 30, 2025  
**Issue:** Quick Task and Intervention systems were incorrectly coupled

## The Problem

Quick Task and Intervention are **separate, independent systems**, but the code was treating them as if they were related:

### Architectural Issues

1. **`interventionsInProgress` flag set too early**:
   - Flag was set in `triggerIntervention()` BEFORE checking Quick Task availability
   - This meant the flag was set even when showing Quick Task dialog
   - But Quick Task is NOT an intervention - it's a bypass mechanism

2. **`onInterventionCompleted()` called incorrectly**:
   - Called when user activated Quick Task
   - But no intervention had started, so nothing to complete
   - This was conceptually wrong

### Incorrect Flow

```
User opens Instagram
  ↓
triggerIntervention() called
  ↓
interventionsInProgress.add("com.instagram.android")  ❌ Set too early!
  ↓
Check Quick Task availability
  ↓
Quick Task available → Show Quick Task dialog
  ↓
User clicks "Quick Task"
  ↓
onInterventionCompleted() called  ❌ No intervention to complete!
  ↓
interventionsInProgress.delete("com.instagram.android")
```

## The Correct Architecture

### Quick Task and Intervention are Separate

**Quick Task:**
- Pre-intervention decision layer
- Higher priority than intervention
- Bypasses intervention entirely
- No intervention state or flags involved

**Intervention:**
- Full mindfulness flow (breathing → root-cause → alternatives → etc.)
- Only starts if Quick Task is NOT available OR user chooses "Continue"
- Has its own state machine and progress tracking

### Correct Flow

```
User opens Instagram
  ↓
triggerIntervention() called
  ↓
Check Quick Task availability (FIRST)
  ↓
  ├─ Quick Task available → Show Quick Task dialog
  │   ↓
  │   ├─ User clicks "Quick Task"
  │   │   ↓
  │   │   Set Quick Task timer
  │   │   ↓
  │   │   Hide Quick Task dialog
  │   │   ↓
  │   │   Finish InterventionActivity
  │   │   ↓
  │   │   Return to Instagram ✅
  │   │
  │   └─ User clicks "Continue"
  │       ↓
  │       onInterventionStarted() ← Set flag HERE
  │       ↓
  │       interventionsInProgress.add("com.instagram.android") ✅
  │       ↓
  │       BEGIN_INTERVENTION
  │       ↓
  │       Breathing screen
  │
  └─ Quick Task NOT available → BEGIN_INTERVENTION directly
      ↓
      interventionsInProgress.add("com.instagram.android") ✅
      ↓
      Breathing screen
```

## The Fix

### 1. Move `interventionsInProgress.add()` to Correct Location

**Before** (in `triggerIntervention()`):
```typescript
// Mark intervention as in-progress for this app
interventionsInProgress.add(packageName);  // ❌ Too early!

// Calculate Quick Task availability
const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);

if (quickTaskRemaining > 0) {
  // Show Quick Task dialog
  interventionDispatcher({ type: 'SHOW_QUICK_TASK', ... });
} else {
  // Start intervention
  interventionDispatcher({ type: 'BEGIN_INTERVENTION', ... });
}
```

**After**:
```typescript
// Calculate Quick Task availability (FIRST)
const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);

if (quickTaskRemaining > 0) {
  // Show Quick Task dialog
  // NOTE: We do NOT set interventionsInProgress flag here
  interventionDispatcher({ type: 'SHOW_QUICK_TASK', ... });
} else {
  // Mark intervention as in-progress (only when actually starting)
  interventionsInProgress.add(packageName);  // ✅ Correct!
  
  // Reset intention timer
  intentionTimers.delete(packageName);
  
  // Start intervention
  interventionDispatcher({ type: 'BEGIN_INTERVENTION', ... });
}
```

### 2. Create `onInterventionStarted()` Function

New function to mark intervention as started when user chooses "Continue":

```typescript
export function onInterventionStarted(packageName: string): void {
  // Clear any existing interventions (only one at a time)
  if (interventionsInProgress.size > 0) {
    const oldApps = Array.from(interventionsInProgress);
    interventionsInProgress.clear();
  }

  interventionsInProgress.add(packageName);
  intentionTimers.delete(packageName);
  
  console.log('[OS Trigger Brain] Intervention started, set in-progress flag', {
    packageName,
  });
}
```

### 3. Update QuickTaskDialogScreen

**handleConsciousProcess** (user clicks "Continue"):
```typescript
// Mark intervention as started (set in-progress flag)
onInterventionStarted(targetApp);  // ✅ Set flag when intervention starts

// Hide Quick Task screen
dispatchQuickTask({ type: 'DECLINE_QUICK_TASK' });

// Start intervention
dispatchIntervention({ type: 'BEGIN_INTERVENTION', ... });
```

**handleQuickTask** (user clicks "Quick Task"):
```typescript
// Set Quick Task timer
setQuickTaskTimer(targetApp, durationMs, now);

// NOTE: We do NOT call onInterventionCompleted() here
// Quick Task and Intervention are separate systems
// Quick Task bypasses intervention entirely

// Hide Quick Task screen
dispatchQuickTask({ type: 'HIDE_QUICK_TASK' });
```

## Benefits

1. **Correct Separation of Concerns**:
   - Quick Task is independent of intervention
   - No intervention flags/state when Quick Task is used
   - Clear conceptual model

2. **Accurate State Tracking**:
   - `interventionsInProgress` only contains apps with active interventions
   - Flag is set when intervention starts, not when Quick Task shows
   - Flag is cleared when intervention completes

3. **Proper Flow Control**:
   - Quick Task can be used without triggering intervention logic
   - Intention timers only reset when intervention actually starts
   - No false "intervention completed" events

## Files Modified

1. **`src/os/osTriggerBrain.ts`**
   - Moved `interventionsInProgress.add()` to correct location (only when intervention starts)
   - Moved `intentionTimers.delete()` to correct location
   - Created `onInterventionStarted()` function
   - Added comments explaining the separation

2. **`app/screens/conscious_process/QuickTaskDialogScreen.tsx`**
   - Changed import from `onInterventionCompleted` to `onInterventionStarted`
   - Added call to `onInterventionStarted()` in `handleConsciousProcess`
   - Removed call to `onInterventionCompleted()` in `handleQuickTask`
   - Added comment explaining why we don't call it

## Testing

Build started: December 30, 2025, 21:45 UTC

To verify:
1. Open Instagram
2. Quick Task dialog appears
3. Click "Quick Task"
   - ✅ No intervention flags set
   - ✅ No intervention state changes
   - ✅ Instagram returns to foreground
4. Open Instagram again
5. Quick Task dialog appears
6. Click "Continue"
   - ✅ `onInterventionStarted()` called
   - ✅ `interventionsInProgress` flag set
   - ✅ Breathing screen appears
   - ✅ Full intervention flow starts

## Related Issues

This fix resolves:
- Incorrect coupling between Quick Task and Intervention
- `interventionsInProgress` flag set when it shouldn't be
- Conceptual confusion about when intervention starts
- Intention timer reset at wrong time

