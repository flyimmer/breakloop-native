# Quick Task Finish Activity Fix

**Date:** December 30, 2025  
**Issue:** When Quick Task is activated, main app appears instead of monitored app staying in foreground

## Problem

After the Quick Task refactoring, two issues occurred:

1. **When Quick Task starts** → Main app appears instead of monitored app staying in foreground
2. **When closing monitored app (e.g., Instagram)** → Main app appears

The root cause was that `QuickTaskDialogScreen` was calling `finishInterventionActivity()` directly, but this was happening while the Quick Task state was still visible. This caused the app to finish the activity immediately, but then the navigation system would try to navigate back to the Quick Task dialog (because `quickTaskState.visible` was still true), creating a loop.

## Solution

### 1. Separate Concerns

**Before:**
- `QuickTaskDialogScreen` handled both:
  - Dispatching `HIDE_QUICK_TASK` action
  - Calling `finishInterventionActivity()` directly

**After:**
- `QuickTaskDialogScreen` only dispatches `HIDE_QUICK_TASK`
- `App.tsx` watches for Quick Task state changes and finishes activity when appropriate

### 2. Add useEffect in App.tsx

Added a new `useEffect` that watches `quickTaskState.visible` and finishes the `InterventionActivity` when Quick Task is hidden:

```typescript
/**
 * Finish InterventionActivity when Quick Task is hidden
 * 
 * When user activates Quick Task, the Quick Task state changes to hidden.
 * At that point, we need to finish InterventionActivity to return to the monitored app.
 */
const previousQuickTaskVisibleRef = useRef<boolean>(quickTaskState.visible);

useEffect(() => {
  if (Platform.OS !== 'android' || !AppMonitorModule) {
    return;
  }

  // Check if Quick Task was just hidden (visible changed from true to false)
  if (previousQuickTaskVisibleRef.current === true && quickTaskState.visible === false && quickTaskState.targetApp) {
    console.log('[Quick Task] Quick Task hidden, finishing InterventionActivity');
    console.log('[Quick Task] Target app was:', quickTaskState.targetApp);
    
    try {
      AppMonitorModule.finishInterventionActivity();
      console.log('[Quick Task] finishInterventionActivity called - monitored app should return to foreground');
    } catch (error) {
      console.error('[Quick Task] finishInterventionActivity threw error:', error);
    }
  }

  // Update ref
  previousQuickTaskVisibleRef.current = quickTaskState.visible;
}, [quickTaskState.visible, quickTaskState.targetApp]);
```

### 3. Update QuickTaskDialogScreen

**Before:**
```typescript
// Hide Quick Task screen
console.log('[QuickTaskDialog] Dispatching ACTIVATE_QUICK_TASK...');
dispatchQuickTask({ type: 'ACTIVATE_QUICK_TASK' });
console.log('[QuickTaskDialog] ACTIVATE_QUICK_TASK dispatched successfully');

// Finish InterventionActivity
if (Platform.OS === 'android' && AppMonitorModule) {
  console.log('[QuickTaskDialog] Finishing InterventionActivity...');
  AppMonitorModule.finishInterventionActivity();
  console.log('[QuickTaskDialog] finishInterventionActivity called');
}
```

**After:**
```typescript
// Hide Quick Task screen (App.tsx will finish InterventionActivity when this changes)
console.log('[QuickTaskDialog] Dispatching HIDE_QUICK_TASK...');
dispatchQuickTask({ type: 'HIDE_QUICK_TASK' });
console.log('[QuickTaskDialog] HIDE_QUICK_TASK dispatched successfully');
console.log('[QuickTaskDialog] App.tsx will finish InterventionActivity when Quick Task state changes to hidden');
```

## Flow After Fix

1. User opens monitored app (e.g., Instagram)
2. OS Trigger Brain detects app change
3. Quick Task available → `SHOW_QUICK_TASK` dispatched
4. Navigation system navigates to `QuickTaskDialog`
5. User clicks "Quick Task" button
6. `QuickTaskDialogScreen.handleQuickTask()`:
   - Sets Quick Task timer
   - Calls `onInterventionCompleted()`
   - Dispatches `HIDE_QUICK_TASK`
7. `App.tsx` useEffect detects `quickTaskState.visible` changed from `true` to `false`
8. `App.tsx` calls `finishInterventionActivity()`
9. `InterventionActivity` closes
10. Android returns to previously foreground app (Instagram)
11. ✅ User sees Instagram, not main app

## Why This Works

### Separation of Concerns
- **QuickTaskDialogScreen**: UI component that handles user actions and state updates
- **App.tsx**: Navigation and lifecycle manager that handles activity finishing

### Proper State Synchronization
- The `useEffect` watches for state changes using a ref to track previous value
- Only finishes activity when Quick Task transitions from visible to hidden
- Prevents race conditions and loops

### Clean Handoff
- Quick Task screen updates state → App.tsx reacts to state change → Activity finishes
- No direct coupling between UI component and native module lifecycle

## Files Modified

1. **`app/App.tsx`**
   - Added `useEffect` to watch `quickTaskState.visible` and finish activity when hidden
   - Added `previousQuickTaskVisibleRef` to track previous visibility state

2. **`app/screens/conscious_process/QuickTaskDialogScreen.tsx`**
   - Removed direct call to `finishInterventionActivity()`
   - Changed `ACTIVATE_QUICK_TASK` to `HIDE_QUICK_TASK`
   - Added explanatory log about App.tsx handling activity finish

## Testing

To verify the fix:

1. **Quick Task Activation:**
   - Open monitored app (Instagram/TikTok)
   - Quick Task dialog appears
   - Click "Quick Task"
   - ✅ Monitored app stays in foreground (not main app)

2. **Closing Monitored App:**
   - After Quick Task activated
   - Close monitored app (swipe away)
   - ✅ Returns to home screen (not main app)

3. **Continue to Intervention:**
   - Open monitored app
   - Quick Task dialog appears
   - Click "Start conscious process"
   - ✅ Breathing screen appears
   - Complete intervention
   - ✅ Returns to home screen (not main app)

## Related Issues

This fix resolves:
- Main app appearing when Quick Task is activated
- Main app appearing when monitored app is closed after Quick Task

## Architecture Benefits

1. **Single Responsibility**: Each component has one job
2. **Predictable State Flow**: State changes trigger effects, not direct calls
3. **Testable**: Can test state transitions independently
4. **Maintainable**: Clear separation between UI and lifecycle management

