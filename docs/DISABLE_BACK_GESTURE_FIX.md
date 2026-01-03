# Disable Back Gesture Fix - Prevent Navigation Corruption

**Date:** January 3, 2026  
**Issue:** When user swipes right-to-left (Android back gesture) or presses hardware back button on intervention screens, the navigation goes back but the intervention state doesn't update, causing state corruption and broken behavior.

## Problem

### Symptoms
1. User opens monitored app (e.g., Instagram/X)
2. Intervention starts, reaches Root Cause screen
3. User swipes right-to-left (back gesture) or presses hardware back button
4. Navigation goes back to Breathing screen, but intervention state remains at `root-cause`
5. State machine becomes confused - navigation and state are out of sync
6. Subsequent app launches show only the main BreakLoop screen instead of intervention
7. App enters broken state where interventions no longer work correctly

### Root Cause

**Navigation Layer vs State Machine Mismatch:**
- React Navigation allows back gestures and hardware back button by default
- When user goes back, navigation changes but intervention state machine doesn't update
- The intervention state machine expects to control navigation via state transitions
- Manual navigation breaks the state machine's assumptions

**Example of broken flow:**
```
1. State: 'breathing' → Navigate to Breathing screen ✓
2. State: 'root-cause' → Navigate to RootCause screen ✓
3. User swipes back → Navigate to Breathing screen (but state still 'root-cause') ✗
4. State machine tries to navigate based on 'root-cause' state
5. Navigation is confused - already on Breathing but state says RootCause
6. Subsequent state transitions fail or behave incorrectly
```

## Solution

Disable both swipe gestures and hardware back button on all intervention screens to ensure the state machine has full control over navigation.

### Implementation

#### 1. Disable Swipe Gestures (RootNavigator.tsx)

Added `gestureEnabled: false` to all intervention screen options:

```typescript
<Stack.Screen 
  name="Breathing" 
  component={BreathingScreen}
  options={{
    gestureEnabled: false, // Disable swipe back gesture
  }}
/>
```

**Screens affected:**
- QuickTaskDialog
- QuickTaskExpired
- Breathing
- RootCause
- Alternatives
- ActionConfirmation
- ActivityTimer
- Reflection
- IntentionTimer

#### 2. Disable Hardware Back Button (All Intervention Screens)

Added `BackHandler` listener to each intervention screen component:

```typescript
import { BackHandler } from 'react-native';

// In component:
useEffect(() => {
  const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
    // Return true to prevent default back behavior
    return true;
  });

  return () => backHandler.remove();
}, []);
```

**Screens updated:**
- `BreathingScreen.tsx`
- `RootCauseScreen.tsx`
- `AlternativesScreen.tsx`
- `ActionConfirmationScreen.tsx`
- `ActivityTimerScreen.tsx`
- `ReflectionScreen.tsx`
- `IntentionTimerScreen.tsx`
- `QuickTaskDialogScreen.tsx`
- `QuickTaskExpiredScreen.tsx`

## Why This Fix Works

### State Machine Control
The intervention flow is designed as a state machine where:
1. State changes trigger navigation
2. Navigation is a side effect of state changes
3. User actions update state, which then updates navigation

**Before fix:**
```
User swipes back → Navigation changes → State unchanged → MISMATCH
```

**After fix:**
```
User swipes back → Nothing happens (gesture disabled)
User presses back button → Nothing happens (handler returns true)
User must use UI buttons → Updates state → Navigation changes → SYNC ✓
```

### Intentional Design
Disabling back navigation is intentional for intervention screens because:
1. **Intervention is a deliberate pause** - User should complete or explicitly cancel
2. **State machine integrity** - Navigation must match state at all times
3. **Clear exit paths** - Close button (X) and action buttons provide explicit exits
4. **Prevent accidental exits** - Back gesture is too easy to trigger accidentally

## User Experience

### How Users Exit Intervention Screens

**Breathing Screen:**
- No exit - Must complete countdown (regulation anchor)

**RootCause Screen:**
- Close button (X) → Cancels intervention → Home screen
- "See alternatives" → Proceeds to alternatives
- "I really need to use it" → Proceeds to intention timer

**Alternatives Screen:**
- Close button (X) → Cancels intervention → Home screen
- Select alternative → Proceeds to action confirmation
- "I really need to use it" → Proceeds to intention timer

**ActionConfirmation Screen:**
- Close button (X) → Returns to alternatives
- "Start" → Proceeds to activity timer
- "Plan for later" → Cancels intervention → Home screen

**ActivityTimer Screen:**
- "Finish" → Proceeds to reflection
- "Go back" → Returns to alternatives

**Reflection Screen:**
- "Continue" → Completes intervention → Home screen

**IntentionTimer Screen:**
- Select duration → Sets intention timer → Launches monitored app

**QuickTaskDialog Screen:**
- Close button (X) → Cancels → Home screen
- "Start conscious process" → Begins intervention
- "Quick Task" → Activates Quick Task → Returns to monitored app

**QuickTaskExpired Screen:**
- "Close & Go Home" → Resets state → Home screen

## Testing

### Test Case 1: Root Cause Back Gesture
1. Open Instagram (monitored app)
2. Wait for breathing countdown to complete
3. See root cause selection screen
4. Swipe right-to-left (back gesture)
5. **Expected:** Nothing happens, screen stays on Root Cause
6. **Previously:** Navigated back to Breathing, state corrupted

### Test Case 2: Hardware Back Button
1. Open Instagram (monitored app)
2. Reach any intervention screen
3. Press hardware back button
4. **Expected:** Nothing happens, screen stays on current screen
5. **Previously:** Navigated back, state corrupted

### Test Case 3: Multiple Back Attempts
1. Open Instagram (monitored app)
2. Reach Root Cause screen
3. Press back button multiple times rapidly
4. **Expected:** Nothing happens, screen stays on Root Cause
5. **Previously:** Could navigate back multiple screens, complete state corruption

### Test Case 4: Subsequent App Launches
1. Open Instagram → Complete intervention flow normally
2. Close app
3. Open Instagram again
4. **Expected:** Intervention starts normally (breathing screen)
5. **Previously (if back gesture used):** Only main app screen shown, intervention broken

## Related Files

### Modified Files
- `app/navigation/RootNavigator.tsx` - Added `gestureEnabled: false` to all intervention screens
- `app/screens/conscious_process/BreathingScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/RootCauseScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/AlternativesScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/ActionConfirmationScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/ActivityTimerScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/ReflectionScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/IntentionTimerScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/QuickTaskDialogScreen.tsx` - Added BackHandler
- `app/screens/conscious_process/QuickTaskExpiredScreen.tsx` - Added BackHandler

### Related Documentation
- `docs/CANCEL_INTERVENTION_FIX.md` - Close button behavior (launches home screen)
- `docs/APP_SWITCH_INTERVENTION_FIX.md` - App switch handling during intervention
- `design/principles/interaction-gravity.md` - Intervention screen design principles

## Architecture Notes

### State Machine Pattern
The intervention system uses a pure state machine pattern:
- State is the single source of truth
- Navigation is a side effect of state changes
- User actions must go through state updates
- Direct navigation manipulation breaks the pattern

### Navigation Handler
The `InterventionNavigationHandler` in `app/App.tsx` watches intervention state and navigates accordingly:
```typescript
useEffect(() => {
  if (state === 'breathing') {
    navigationRef.current.navigate('Breathing');
  } else if (state === 'root-cause') {
    navigationRef.current.navigate('RootCause');
  }
  // ... etc
}, [state, targetApp]);
```

This pattern requires that navigation ONLY happens through state changes, never through user gestures or back button.

## Future Considerations

### Alternative Approaches Considered

**1. Sync navigation back to state:**
- Listen for navigation events and update state accordingly
- Rejected: Complex, error-prone, breaks state machine pattern

**2. Allow back on some screens:**
- Enable back on non-critical screens like Alternatives
- Rejected: Inconsistent UX, still risks state corruption

**3. Custom back button handling per screen:**
- Different behavior for different screens
- Rejected: Too complex, current approach is simpler and safer

### Current Approach Benefits
- ✅ Simple and consistent
- ✅ Prevents all state corruption scenarios
- ✅ Clear user experience (must use UI buttons)
- ✅ Maintains state machine integrity
- ✅ Easy to understand and maintain

## Summary

This fix ensures that the intervention state machine has full control over navigation by disabling both swipe gestures and hardware back button on all intervention screens. Users must use the provided UI buttons (close, action buttons) to navigate, which ensures state and navigation remain synchronized.

**Key Points:**
- Back gestures and hardware back button disabled on all intervention screens
- Users must use UI buttons to navigate (intentional design)
- Prevents state corruption and broken intervention flows
- Maintains state machine integrity
- Simple, consistent, and maintainable solution
