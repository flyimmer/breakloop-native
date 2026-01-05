# Alternative Activity Fix Summary

**Date**: January 5, 2026  
**Issue**: "App hangs after Start Activity" bug  
**Status**: ✅ Fixed

---

## Problem

When user pressed "Start Activity" after selecting an alternative during intervention:
1. `ALTERNATIVE_ACTIVITY` session was created correctly
2. SystemSurfaceRoot checked `if (foregroundApp !== session.app)` 
3. Condition was TRUE (foreground was BreakLoop, not Instagram)
4. UI rendered `null` (hidden)
5. User saw blank screen - app appeared "hung"

**Root Cause**: Incorrect visibility logic that assumed Alternative Activities needed to check foregroundApp.

---

## Solution (v1)

### Core Principle

**In v1, ALL Alternative Activities are OUT_OF_APP:**
- Executed in SystemSurfaceActivity (not in monitored app)
- Always visible regardless of foregroundApp
- Never launch any app
- Independent of monitored app UI

### Changes Made

#### 1. Fixed SystemSurfaceRoot.tsx (Lines 253-259)

**Before** (incorrect):
```typescript
case 'ALTERNATIVE_ACTIVITY':
  // RULE 1: Alternative Activity visibility is conditional
  if (foregroundApp !== session.app) {
    console.log('[SystemSurfaceRoot] Alternative Activity hidden...');
    return null;  // ❌ BUG: Hides UI
  }
  return <AlternativeActivityFlow app={session.app} />;
```

**After** (correct):
```typescript
case 'ALTERNATIVE_ACTIVITY':
  // v1: Alternative Activity is ALWAYS OUT_OF_APP
  // Always render UI, never check foregroundApp, never launch app
  if (__DEV__) {
    console.log('[SystemSurfaceRoot] Rendering AlternativeActivityFlow (OUT_OF_APP, always visible)');
  }
  return <AlternativeActivityFlow app={session.app} />;
```

**Result**: Alternative Activity UI is immediately visible when session starts.

---

#### 2. Implemented "Plan for Later" Save Logic (ActionConfirmationScreen.tsx)

**Before** (incomplete):
```typescript
const handlePlanForLater = () => {
  dispatchIntervention({ type: 'RESET_INTERVENTION' });
};
```

**After** (complete):
```typescript
const handlePlanForLater = async () => {
  // 1. Save activity to Main App storage
  const activity = {
    id: `planned-${Date.now()}`,
    title: selectedAlternative.title,
    description: selectedAlternative.description,
    duration: selectedAlternative.duration,
    plannedAt: Date.now(),
    source: 'intervention',
  };
  
  try {
    const existingActivities = await AsyncStorage.getItem('upcoming_activities');
    const activities = existingActivities ? JSON.parse(existingActivities) : [];
    activities.push(activity);
    await AsyncStorage.setItem('upcoming_activities', JSON.stringify(activities));
    
    if (__DEV__) {
      console.log('[ActionConfirmation] Activity saved for later:', activity);
    }
  } catch (error) {
    console.error('[ActionConfirmation] Failed to save activity:', error);
  }
  
  // 2. Reset intervention state (triggers idle → END_SESSION → SystemSurface closes)
  dispatchIntervention({ type: 'RESET_INTERVENTION' });
};
```

**Result**: Activity is saved to storage, intervention ends, SystemSurface closes, user lands on home screen.

---

## Expected Behavior After Fix

### Scenario 1: Start Activity
1. User opens Instagram → Intervention starts
2. User selects "Power Nap" alternative
3. User presses "Start Activity"
4. ✅ **Timer UI appears immediately**
5. ✅ **Activity steps are visible**
6. ✅ **No app launch occurs**
7. ✅ **User can complete activity in SystemSurface**

### Scenario 2: Plan for Later
1. User opens Instagram → Intervention starts
2. User selects "Short Walk" alternative
3. User presses "Plan for later"
4. ✅ **Activity saved to storage**
5. ✅ **Intervention ends**
6. ✅ **SystemSurface closes**
7. ✅ **User lands on phone home screen**
8. ✅ **Activity appears in Main App → Upcoming Activities later**

---

## Files Modified

1. **`app/roots/SystemSurfaceRoot.tsx`**
   - Removed: 9 lines of incorrect foregroundApp visibility check
   - Added: Simple always-visible rendering for ALTERNATIVE_ACTIVITY
   - Lines changed: 253-259

2. **`app/screens/conscious_process/ActionConfirmationScreen.tsx`**
   - Added: AsyncStorage import
   - Updated: `handlePlanForLater` function with save logic
   - Lines changed: 6, 83-110

**Total**: 2 files, ~30 lines changed

---

## Architecture Preserved

✅ **No executionContext introduced** - Not needed in v1  
✅ **No app launch logic** - Alternative Activities never launch apps in v1  
✅ **No new Session types** - Only fixed existing ALTERNATIVE_ACTIVITY rendering  
✅ **"Plan for later" is NOT a session** - Side-effect that saves data and exits  
✅ **Session authority maintained** - SystemSurfaceRoot controls rendering  
✅ **Native/JS boundary respected** - No native changes needed

---

## Testing Checklist

- [ ] Open monitored app → Intervention starts
- [ ] Select alternative → Press "Start Activity"
- [ ] Verify: Timer UI appears immediately (no blank screen)
- [ ] Verify: Activity steps are visible
- [ ] Verify: No app launch occurs
- [ ] Complete activity → Verify: Returns to home screen
- [ ] Open monitored app → Intervention starts
- [ ] Select alternative → Press "Plan for later"
- [ ] Verify: Activity saved (check logs)
- [ ] Verify: SystemSurface closes
- [ ] Verify: User on home screen
- [ ] Open Main App → Check Upcoming Activities
- [ ] Verify: Saved activity appears in list

---

## What Was NOT Done (Explicitly Out of Scope for v1)

❌ Adding `executionContext` field to alternatives  
❌ Adding `executionContext` to SystemSession type  
❌ Launching monitored app on START_ALTERNATIVE_ACTIVITY  
❌ Complex visibility rules based on foregroundApp  
❌ Creating session for "Plan for later"

These features are deferred to future versions if needed.
