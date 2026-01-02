# Quick Task Dialog Not Appearing - Fix

**Date:** December 30, 2024  
**Issue:** Quick Task dialog was not appearing. Only breathing screen showed for Instagram and TikTok.

## Root Cause

The initial `BEGIN_INTERVENTION` dispatch in `App.tsx` was **missing the `quickTaskRemaining` parameter**.

### What Was Wrong

**File:** `app/App.tsx` (lines 98-102)

```typescript
dispatchIntervention({
  type: 'BEGIN_INTERVENTION',
  app: triggeringApp,
  breathingDuration: getInterventionDurationSec(),
  // ❌ Missing: quickTaskRemaining
});
```

**Result:**
- `quickTaskRemaining` defaulted to `undefined` or `0`
- Intervention state machine checked: `quickTaskRemaining > 0 ? 'quick_task_dialog' : 'breathing'`
- Since `quickTaskRemaining` was falsy, state became `'breathing'` instead of `'quick_task_dialog'`
- User only saw breathing screen, never the Quick Task dialog

### Why This Happened

There were **two** places where `BEGIN_INTERVENTION` is dispatched:

1. **osTriggerBrain.ts** (line 258-264) - ✅ **CORRECT**
   ```typescript
   const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);
   
   interventionDispatcher({
     type: 'BEGIN_INTERVENTION',
     app: packageName,
     breathingDuration: getInterventionDurationSec(),
     quickTaskRemaining, // ✅ Included
   });
   ```

2. **App.tsx** (line 98-102) - ❌ **MISSING**
   ```typescript
   dispatchIntervention({
     type: 'BEGIN_INTERVENTION',
     app: triggeringApp,
     breathingDuration: getInterventionDurationSec(),
     // ❌ quickTaskRemaining missing
   });
   ```

The second dispatch happens when `InterventionActivity` first launches and checks for an initial triggering app. This is the **first** intervention trigger, so it was always missing `quickTaskRemaining`.

## Solution

### 1. Added Quick Task Calculation in App.tsx

**File:** `app/App.tsx` (lines 98-108)

```typescript
if (__DEV__) {
  console.log(`[F3.5] Triggering app received: ${triggeringApp}`);
  console.log('[F3.5] Dispatching BEGIN_INTERVENTION');
}

// Calculate Quick Task availability for this app
const quickTaskRemaining = getQuickTaskRemaining(triggeringApp, now);

dispatchIntervention({
  type: 'BEGIN_INTERVENTION',
  app: triggeringApp,
  breathingDuration: getInterventionDurationSec(),
  quickTaskRemaining, // ✅ Now included
});
```

### 2. Exported getQuickTaskRemaining()

**File:** `src/os/osTriggerBrain.ts` (line 164)

```typescript
// Changed from:
function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {

// To:
export function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
```

### 3. Imported getQuickTaskRemaining in App.tsx

**File:** `app/App.tsx` (lines 4-11)

```typescript
import {
  checkBackgroundIntentionExpiration,
  checkForegroundIntentionExpiration,
  getIntentionTimer,
  getQuickTaskRemaining, // ✅ Added
  getQuickTaskTimer,
  handleForegroundAppChange,
  setInterventionDispatcher
} from '@/src/os/osTriggerBrain';
```

### 4. Fixed TypeScript Type Definition

**File:** `src/contexts/InterventionProvider.tsx` (lines 19-29)

```typescript
interface InterventionContextValue {
  interventionState: {
    state: 'idle' | 'breathing' | 'quick_task_dialog' | 'root-cause' | 'alternatives' | 'action' | 'action_timer' | 'timer' | 'reflection';
    //                            ^^^^^^^^^^^^^^^^^^^ Added
    targetApp: any | null;
    breathingCount: number;
    quickTaskRemaining: number; // ✅ Added
    selectedCauses: string[];
    selectedAlternative: any | null;
    actionTimer: number;
  };
  dispatchIntervention: (action: any) => void;
}
```

**Changes:**
1. Added `'quick_task_dialog'` to state union type
2. Added `quickTaskRemaining: number` field

## How It Works Now

### Flow When Opening Monitored App

```
1. User opens Instagram
   ↓
2. ForegroundDetectionService detects launch
   ↓
3. Launches InterventionActivity
   ↓
4. App.tsx checks for initial triggering app
   ↓
5. Calculates quickTaskRemaining (GLOBAL)
   const quickTaskRemaining = getQuickTaskRemaining('com.instagram.android', now)
   // Returns: 1 (if user hasn't used Quick Task yet)
   ↓
6. Dispatches BEGIN_INTERVENTION with quickTaskRemaining
   dispatchIntervention({
     type: 'BEGIN_INTERVENTION',
     app: 'com.instagram.android',
     breathingDuration: 5,
     quickTaskRemaining: 1 // ✅ Now included
   })
   ↓
7. Intervention state machine checks:
   quickTaskRemaining > 0 ? 'quick_task_dialog' : 'breathing'
   1 > 0 → TRUE
   ↓
8. State becomes 'quick_task_dialog'
   ↓
9. Navigation navigates to QuickTaskDialog screen
   ↓
10. User sees Quick Task dialog! ✅
```

### Before vs After

**Before (Bug):**
```
Open Instagram
→ BEGIN_INTERVENTION dispatched (quickTaskRemaining: undefined)
→ State: 'breathing'
→ Navigate to Breathing screen
→ User sees breathing countdown ❌
```

**After (Fixed):**
```
Open Instagram
→ Calculate quickTaskRemaining: 1
→ BEGIN_INTERVENTION dispatched (quickTaskRemaining: 1)
→ State: 'quick_task_dialog'
→ Navigate to QuickTaskDialog screen
→ User sees Quick Task dialog ✅
```

## Testing

### Test 1: Quick Task Dialog Appears
```
1. Open Instagram (first time)
   ✅ Expected: Quick Task dialog appears
   ✅ Expected: Shows "You have 1 Quick Task remaining"
```

### Test 2: Quick Task Used
```
1. Open Instagram → Quick Task dialog
2. Click "Quick Task"
   ✅ Expected: Instagram stays in foreground
3. Exit Instagram, open TikTok
   ✅ Expected: No Quick Task dialog (0 remaining)
   ✅ Expected: Breathing screen appears
```

### Test 3: Global Quota
```
1. Open Instagram → Use Quick Task (1 use consumed)
2. Open TikTok
   ✅ Expected: No Quick Task dialog
   ✅ Expected: Breathing screen (quota exhausted)
```

### Test 4: Quota Restoration
```
1. Use Quick Task on Instagram (09:00)
2. Wait 15 minutes
3. Open Instagram again (09:15+)
   ✅ Expected: Quick Task dialog appears again
   ✅ Expected: Shows "You have 1 Quick Task remaining"
```

## Related Issues Fixed

This fix also resolves:
- TypeScript compilation error for `'quick_task_dialog'` state
- Missing `quickTaskRemaining` field in intervention context type

## Files Modified

1. `app/App.tsx` - Added Quick Task calculation and import
2. `src/os/osTriggerBrain.ts` - Exported `getQuickTaskRemaining()`
3. `src/contexts/InterventionProvider.tsx` - Updated TypeScript types

## Lessons Learned

### Multiple Dispatch Points

When an action can be dispatched from multiple places, ensure **all dispatch sites** include the same parameters.

**In this case:**
- `osTriggerBrain.ts` → Dispatches with `quickTaskRemaining` ✅
- `App.tsx` → Was missing `quickTaskRemaining` ❌

**Solution:** Centralize parameter calculation or use a helper function.

### Type Safety

TypeScript caught the missing state type, but only after we tried to use it in navigation logic. Adding the type earlier would have caught this sooner.

### Testing Coverage

This bug wasn't caught because:
1. The intervention flow worked (breathing screen appeared)
2. No error was thrown (just wrong screen)
3. Logs showed correct `quickTaskRemaining` value from `osTriggerBrain.ts` dispatch

**Lesson:** Test the **first** intervention trigger specifically, not just subsequent ones.

## Prevention

To prevent similar issues:

1. **Centralize Action Creators**
   ```typescript
   // Create a helper function
   function createBeginInterventionAction(app: string, timestamp: number) {
     return {
       type: 'BEGIN_INTERVENTION',
       app,
       breathingDuration: getInterventionDurationSec(),
       quickTaskRemaining: getQuickTaskRemaining(app, timestamp),
     };
   }
   
   // Use everywhere
   dispatchIntervention(createBeginInterventionAction(triggeringApp, now));
   ```

2. **Add Type Checking**
   ```typescript
   interface BeginInterventionAction {
     type: 'BEGIN_INTERVENTION';
     app: string;
     breathingDuration: number;
     quickTaskRemaining: number; // Required, not optional
   }
   ```

3. **Add Validation**
   ```typescript
   if (action.type === 'BEGIN_INTERVENTION') {
     if (action.quickTaskRemaining === undefined) {
       console.error('BEGIN_INTERVENTION missing quickTaskRemaining!');
     }
   }
   ```

## Conclusion

✅ **Bug fixed!** Quick Task dialog now appears correctly when opening monitored apps.

The issue was a simple missing parameter in one of two dispatch sites. The fix ensures both dispatch points include all required parameters for the intervention state machine to work correctly.

