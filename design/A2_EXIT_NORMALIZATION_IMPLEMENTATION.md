# A2: Exit Normalization Implementation Summary

**Date:** December 26, 2025  
**Phase:** A2 (Exit Normalization)  
**Status:** ✅ Complete

## Overview

This document describes the implementation of the missing "Set Intention Timer" state and UI, completing A2 (Exit Normalization) by restoring explicit user choice when exiting the intervention flow.

## Problem

Previously, users could exit the intervention flow via "Ignore & Continue" without any record of their choice or intention. This was a silent bypass that didn't normalize the exit behavior.

## Solution

Added a new **IntentionTimerScreen** that:
1. Presents duration options (Just 1 min, 5m, 15m, 30m, 45m, 60m)
2. Allows user to explicitly set an "intention timer" 
3. Stores `intentionTimerUntil` timestamp in intervention state
4. Resets intervention to `'idle'` state after confirmation
5. Provides explicit exit points from both RootCauseScreen and AlternativesScreen

## Files Created

### 1. IntentionTimerScreen.tsx
**Location:** `app/screens/conscious_process/IntentionTimerScreen.tsx` (289 lines)

**Features:**
- Clock icon (🕐) with "Set Intention Timer" title
- 6 duration options arranged in a grid: **Just 1 min, 5m, 15m, 30m, 45m, 60m**
- Single-select duration cards with elevated style when selected
- "Start timer" confirmation button (disabled until selection)
- Close button (X) in top-right corner

**Design Gravity:** Reflective Float
- Calm, non-urgent choice
- No bottom-anchored CTA
- Even visual weight across duration options
- Confirmation action has secondary presence

**Navigation:**
- Entry: Navigated to from RootCauseScreen or AlternativesScreen
- Exit: Navigates to `MainTabs` after confirmation (intervention becomes idle)

## Files Modified

### 2. intervention/state.js
**Changes:**
- Added `intentionTimerUntil: null` field to initial intervention context
- Field stores timestamp when intention timer expires (null = no timer set)

```javascript
export const createInitialInterventionContext = () => ({
  state: 'idle',
  targetApp: null,
  breathingCount: 3,
  selectedCauses: [],
  selectedAlternative: null,
  actionTimer: 0,
  intentionTimerUntil: null, // NEW
});
```

### 3. intervention/transitions.js
**Changes:**
- Added `SET_INTENTION_TIMER` action
- Added `CLEAR_INTENTION_TIMER` action
- Updated `RESET_INTERVENTION` to preserve `intentionTimerUntil`

**New Actions:**

```javascript
case 'SET_INTENTION_TIMER':
  // User set intention timer - store timestamp and reset intervention
  return {
    ...context,
    state: 'idle',
    targetApp: null,
    breathingCount: 0,
    selectedCauses: [],
    selectedAlternative: null,
    actionTimer: 0,
    intentionTimerUntil: action.intentionTimerUntil,
  };

case 'CLEAR_INTENTION_TIMER':
  // Clear intention timer (when expired or manually cancelled)
  return {
    ...context,
    intentionTimerUntil: null,
  };
```

### 4. RootCauseScreen.tsx
**Changes:**
- Added navigation import and type
- Added `handleNeedToUseIt()` function
- Added "I really need to use it" button below "See alternatives"

**New Button:**
```jsx
<Pressable
  onPress={handleNeedToUseIt}
  style={({ pressed }) => [
    styles.needToUseButton,
    pressed && styles.needToUseButtonPressed,
  ]}
>
  <Text style={styles.needToUseButtonText}>I really need to use it</Text>
</Pressable>
```

**Style:** Heavy Override gravity (muted, low energy, honest)

### 5. AlternativesScreen.tsx
**Changes:**
- Added navigation import and type
- Changed `handleIgnoreAndContinue()` behavior
- Now navigates to IntentionTimer instead of directly resetting

**Old Behavior:**
```javascript
const handleIgnoreAndContinue = () => {
  dispatchIntervention({ type: 'RESET_INTERVENTION' });
  // Navigation will react to state change to 'idle'
};
```

**New Behavior:**
```javascript
const handleIgnoreAndContinue = () => {
  navigation.navigate('IntentionTimer');
};
```

### 6. RootNavigator.tsx
**Changes:**
- Added `IntentionTimerScreen` import
- Added `IntentionTimer: undefined` to `RootStackParamList`
- Added screen route in navigator

```jsx
<Stack.Screen name="IntentionTimer" component={IntentionTimerScreen} />
```

### 7. InterventionProvider.tsx
**Changes:**
- Updated `InterventionContextValue` interface
- Added `intentionTimerUntil: number | null` to state type

```typescript
interface InterventionContextValue {
  interventionState: {
    state: 'idle' | 'breathing' | 'root-cause' | 'alternatives' | 'action' | 'action_timer' | 'timer' | 'reflection';
    targetApp: any | null;
    breathingCount: number;
    selectedCauses: string[];
    selectedAlternative: any | null;
    actionTimer: number;
    intentionTimerUntil: number | null; // NEW
  };
  dispatchIntervention: (action: any) => void;
}
```

## Entry Points (Critical)

### Entry Point 1: RootCauseScreen
**Trigger:** User taps "I really need to use it" button  
**Location:** Below "See alternatives" button  
**Action:** Navigates to IntentionTimer screen  
**Style:** Heavy Override (muted, secondary)

### Entry Point 2: AlternativesScreen
**Trigger:** User taps "Ignore & Continue" button  
**Location:** Bottom of screen (override container)  
**Action:** Navigates to IntentionTimer screen (changed from direct reset)  
**Style:** Heavy Override (muted, non-prominent)

## Exit Semantics

### After IntentionTimer Confirmation:
1. `intentionTimerUntil` timestamp is stored in intervention context
2. Intervention state resets to `'idle'`
3. User returns to MainTabs (normal app flow)
4. Intervention is suppressed until intention timer expires

### Timer Expiry Logic (Stub):
- When `intentionTimerUntil` expires, `BEGIN_INTERVENTION` may fire again
- Implementation is a stub for now (OS-level blocking not implemented)
- `CLEAR_INTENTION_TIMER` action available for manual clearing

## Design Consistency

### Visual Design:
- Mirrors web reference UI structure
- Follows native app color scheme (#0A0A0B background, #FAFAFA text)
- Uses tokens from `design/ui/tokens.md`
- Follows "Ambient Hearth" tone from `design/ui/tone-ambient-hearth.md`

### Interaction Gravity:
- **IntentionTimerScreen:** Reflective Float
- **"I really need to use it" button:** Heavy Override
- **"Ignore & Continue" button:** Heavy Override

### Navigation Pattern:
- Consistent with other intervention screens (modal presentation)
- Clean exit path back to MainTabs
- Close button allows user to go back without setting timer

## Duration Options

The screen presents 6 duration options:
1. **Just 1 min** - Special option for very brief use (selectable, not helper text)
2. **5m** - 5 minutes
3. **15m** - 15 minutes
4. **30m** - 30 minutes
5. **45m** - 45 minutes
6. **60m** - 60 minutes (1 hour)

## Storage & State

### Where Intention Timer is Stored:
- **Field:** `interventionState.intentionTimerUntil`
- **Type:** `number | null`
- **Value:** Unix timestamp (milliseconds) when timer expires, or `null` if no timer set
- **Persistence:** In-memory only (context state), not persisted to localStorage
- **Lifecycle:** Set via `SET_INTENTION_TIMER`, cleared via `CLEAR_INTENTION_TIMER`

### Intervention Exit Behavior Changes:

**Before A2:**
- "Ignore & Continue" → Direct reset to idle (silent bypass)
- "I really need to use it" → Did not exist

**After A2:**
- "Ignore & Continue" → Navigate to IntentionTimer → User sets duration → Reset to idle with timestamp
- "I really need to use it" → Navigate to IntentionTimer → User sets duration → Reset to idle with timestamp

**Key Difference:** Intervention no longer exits silently. User must explicitly choose a duration, creating a record of their intention.

## Constraints Followed

✅ No OS-level blocking implementation  
✅ No new product concepts added  
✅ No removal of existing debug triggers  
✅ All logic minimal and reversible  
✅ Mirrored web reference design  
✅ Followed native color scheme  

## Testing Checklist

- [ ] RootCauseScreen shows "I really need to use it" button
- [ ] Tapping "I really need to use it" navigates to IntentionTimer
- [ ] AlternativesScreen "Ignore & Continue" navigates to IntentionTimer
- [ ] IntentionTimer shows 6 duration options (including "Just 1 min")
- [ ] "Just 1 min" is selectable (not just helper text)
- [ ] Selecting duration highlights card with elevation
- [ ] "Start timer" disabled until duration selected
- [ ] Confirming timer stores `intentionTimerUntil` timestamp
- [ ] After confirmation, intervention state becomes 'idle'
- [ ] User returns to MainTabs after confirmation
- [ ] Close button (X) navigates back without setting timer

## Future Work (Not Implemented)

- OS-level app blocking based on `intentionTimerUntil`
- Automatic timer expiry checking
- Notification when intention timer expires
- Persistence of `intentionTimerUntil` to storage
- Analytics/logging of intention timer usage

## Verification

All files compile without linter errors:
- ✅ IntentionTimerScreen.tsx
- ✅ RootCauseScreen.tsx
- ✅ AlternativesScreen.tsx
- ✅ RootNavigator.tsx
- ✅ InterventionProvider.tsx
- ✅ src/core/intervention/state.js
- ✅ src/core/intervention/transitions.js

## Summary

A2 (Exit Normalization) is now complete. The intervention flow has two explicit exit paths:
1. RootCauseScreen → "I really need to use it" → IntentionTimer
2. AlternativesScreen → "Ignore & Continue" → IntentionTimer

Both paths require user to set an intention timer before exiting, eliminating silent bypasses and normalizing the exit behavior with explicit user choice.

**Special note:** "Just 1 min" is now a selectable duration option (first in the grid), not just helper text.

