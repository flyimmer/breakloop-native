# Cancel Intervention Fix - Launch Home Screen

**Date:** January 3, 2026  
**Issue:** When user clicks close button (X) on intervention screens, the screen stays visible instead of closing and launching home screen.

## Problem

When the user canceled an intervention by clicking the close button (X) on screens like RootCauseScreen, the intervention state was reset to `idle`, but the app didn't properly close the InterventionActivity or launch the home screen. The screen would just stay visible.

### Root Cause

The intervention completion logic in `App.tsx` (lines 231-262) only launched the home screen when the intervention was completed from the `reflection` screen. For all other cases (including cancellation), it would just call `finishInterventionActivity()` which returns to the monitored app.

However, when a user cancels the intervention (clicks X), they expect to return to the home screen, not the monitored app.

## Solution

Added a `wasCanceled` flag to the intervention state to distinguish between:
1. **Canceled intervention** (user clicked X) → Launch home screen
2. **Completed intervention** (finished reflection) → Launch home screen
3. **Other exits** (e.g., "I really need to use it") → Return to monitored app

### Changes Made

#### 1. Core Intervention State (`src/core/intervention/state.js`)
- Added `wasCanceled: false` to initial intervention context

#### 2. Intervention Reducer (`src/core/intervention/transitions.js`)
- Set `wasCanceled: true` when `RESET_INTERVENTION` is dispatched
- Clear `wasCanceled: false` when `BEGIN_INTERVENTION` is dispatched (new intervention starts)

#### 3. App Navigation Handler (`app/App.tsx`)
- Updated intervention completion effect to check `wasCanceled` flag
- Launch home screen if `wasCanceled === true` OR `previousState === 'reflection'`
- Otherwise, finish InterventionActivity (return to monitored app)

## Affected Screens

The following screens dispatch `RESET_INTERVENTION` and will now correctly launch home screen:

1. **RootCauseScreen** - Close button (X)
   - User clicks X → Cancels intervention → Home screen

2. **ActionConfirmationScreen** - "Plan for later" button
   - User chooses to plan for later → Exits intervention → Home screen

3. **QuickTaskDialogScreen** - Close button (X)
   - User clicks X → Cancels Quick Task decision → Home screen

## Testing

To verify the fix:

1. **Test RootCauseScreen close button:**
   - Open Instagram (monitored app)
   - Wait for breathing countdown to complete
   - See root cause selection screen
   - Click close button (X) in top-right
   - **Expected:** InterventionActivity closes, home screen appears
   - **Previously:** Screen stayed visible

2. **Test ActionConfirmationScreen "Plan for later":**
   - Complete intervention flow to action confirmation screen
   - Click "Plan for later" button
   - **Expected:** InterventionActivity closes, home screen appears

3. **Test QuickTaskDialogScreen close button:**
   - Open Instagram (monitored app)
   - See Quick Task dialog
   - Click close button (X)
   - **Expected:** InterventionActivity closes, home screen appears

## Implementation Details

### State Flow

**Before fix:**
```
User clicks X → RESET_INTERVENTION → state: 'idle' → finishInterventionActivity() → Returns to Instagram
```

**After fix:**
```
User clicks X → RESET_INTERVENTION → state: 'idle', wasCanceled: true → launchHomeScreen() → Home screen
```

### Code Logic

```typescript
if (state === 'idle' && previousStateRef.current !== 'idle') {
  const wasCanceled = interventionState.wasCanceled;
  
  // Launch home screen if canceled OR completed from reflection
  if (wasCanceled || previousState === 'reflection') {
    AppMonitorModule.launchHomeScreen();
  } else {
    // Return to monitored app for other exits (e.g., "I really need to use it")
    AppMonitorModule.finishInterventionActivity();
  }
}
```

## Related Files

- `src/core/intervention/state.js` - Initial state definition
- `src/core/intervention/transitions.js` - Reducer logic
- `app/App.tsx` - Navigation handler
- `app/screens/conscious_process/RootCauseScreen.tsx` - Close button
- `app/screens/conscious_process/ActionConfirmationScreen.tsx` - Plan for later button
- `app/screens/conscious_process/QuickTaskDialogScreen.tsx` - Close button

## Notes

- The `wasCanceled` flag is cleared when a new intervention starts (`BEGIN_INTERVENTION`)
- The flag is only set when `RESET_INTERVENTION` is dispatched (explicit cancellation)
- This ensures clean state for each new intervention flow
- The fix maintains backward compatibility with all other intervention exit paths
