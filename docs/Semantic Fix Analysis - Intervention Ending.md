# Semantic Fix Analysis - Intervention Ending

## Current Implementation Status

### ✅ What We Have (Correct)

**1. Native Layer - Two Distinct Methods**
- ✅ `finishSystemSurfaceActivity()` - Finish WITHOUT navigation
- ✅ `cancelInterventionActivity()` - Finish WITH home launch
- ✅ Native does NOT infer semantics

**2. JavaScript Layer - shouldLaunchHome Flag**
- ✅ SystemSessionProvider tracks `shouldLaunchHome: boolean`
- ✅ InterventionFlow determines flag based on `intentionTimerSet`
- ✅ SystemSurfaceRoot calls correct native method

**3. TYPE 3 - START ALTERNATIVE ACTIVITY**
- ✅ Creates ALTERNATIVE_ACTIVITY session
- ✅ Does NOT finish SystemSurfaceActivity
- ✅ Does NOT navigate Home
- ✅ Does NOT launch monitored app
- ✅ **CORRECT BEHAVIOR**

### ❌ What's Missing (Critical)

**TYPE 2 - ALLOW APP USAGE (t_intention)**

**Required Behavior:**
```
→ Set t_intention for the app
→ END_SESSION
→ Finish SystemSurfaceActivity
→ Launch the target app (Instagram / X)  ← MISSING!
```

**Current Behavior:**
```
→ Set t_intention for the app ✅
→ END_SESSION ✅
→ Finish SystemSurfaceActivity ✅
→ (Rely on app "naturally surfacing") ❌
```

**Problem:**
After finishing SystemSurfaceActivity, we're **hoping** the monitored app surfaces naturally, but:
- This is NOT guaranteed by Android
- The launcher or another app may intercept
- This is why home screen appears

**Solution Required:**
Explicitly call `AppMonitorModule.launchApp(targetApp)` after finishing activity.

## Required Changes

### Change 1: Pass Target App in END_SESSION Event

**File:** `src/contexts/SystemSessionProvider.tsx`

```typescript
export type SystemSessionEvent =
  | { type: 'START_INTERVENTION'; app: string }
  | { type: 'START_QUICK_TASK'; app: string }
  | { type: 'START_ALTERNATIVE_ACTIVITY'; app: string; shouldLaunchHome?: boolean }
  | { type: 'END_SESSION'; shouldLaunchHome?: boolean; targetApp?: string };  // Add targetApp
```

**Update reducer:**
```typescript
case 'END_SESSION':
  return {
    ...state,
    session: null,
    bootstrapState: 'READY',
    shouldLaunchHome: event.shouldLaunchHome ?? true,
    targetApp: event.targetApp ?? null,  // Store target app
  };
```

**Update context:**
```typescript
interface SystemSessionContextValue {
  session: SystemSession;
  bootstrapState: SessionBootstrapState;
  foregroundApp: string | null;
  shouldLaunchHome: boolean;
  targetApp: string | null;  // Add targetApp
  dispatchSystemEvent: (event: SystemSessionEvent) => void;
}
```

### Change 2: Pass Target App from InterventionFlow

**File:** `app/flows/InterventionFlow.tsx`

```typescript
case 'idle':
  const shouldLaunchHome = !interventionState.intentionTimerSet;
  
  if (__DEV__) {
    console.log('[InterventionFlow] Intervention completed - dispatching END_SESSION', {
      intentionTimerSet: interventionState.intentionTimerSet,
      shouldLaunchHome,
      targetApp: interventionState.targetApp,  // Log target app
    });
  }
  dispatchSystemEvent({ 
    type: 'END_SESSION',
    shouldLaunchHome,
    targetApp: interventionState.targetApp,  // Pass target app
  });
  break;
```

### Change 3: Launch Target App When Appropriate

**File:** `app/roots/SystemSurfaceRoot.tsx`

```typescript
function finishSystemSurfaceActivity(shouldLaunchHome: boolean = true, targetApp?: string | null) {
  if (Platform.OS === 'android' && AppMonitorModule) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Session is null - finishing SystemSurfaceActivity', {
        shouldLaunchHome,
        targetApp,
      });
    }
    
    if (shouldLaunchHome) {
      // TYPE 1: CANCEL / ABORT
      // Finish activity AND launch home (cancellation/completion)
      AppMonitorModule.cancelInterventionActivity();
    } else {
      // TYPE 2: ALLOW APP USAGE (t_intention)
      // Finish activity, then launch target app
      AppMonitorModule.finishSystemSurfaceActivity();
      
      // Launch target app if provided
      if (targetApp) {
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] Launching target app:', targetApp);
        }
        // Small delay to ensure activity finishes first
        setTimeout(() => {
          AppMonitorModule.launchApp(targetApp);
        }, 100);
      }
    }
  }
}
```

**Update useEffect:**
```typescript
useEffect(() => {
  if (bootstrapState === 'READY' && session === null) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Session is null (bootstrap complete) - triggering activity finish', {
        shouldLaunchHome,
        targetApp,
      });
    }
    finishSystemSurfaceActivity(shouldLaunchHome, targetApp);
  }
}, [session, bootstrapState, shouldLaunchHome, targetApp]);
```

## Complete Semantic Mapping

### TYPE 1 — CANCEL / ABORT

**Triggers:**
- User presses close (❌)
- User abandons intervention
- User completes full intervention with reflection

**Flow:**
```
InterventionFlow (state: 'idle', intentionTimerSet: false)
→ dispatchSystemEvent({ type: 'END_SESSION', shouldLaunchHome: true })
→ SystemSurfaceRoot reads shouldLaunchHome = true
→ AppMonitorModule.cancelInterventionActivity()
→ Activity finishes + Home screen launches
```

**Result:** ✅ User goes to Home

### TYPE 2 — ALLOW APP USAGE (t_intention)

**Triggers:**
- "I really need to use it"
- User selects "Just 1 min", "5 min", etc.

**Flow:**
```
IntentionTimerScreen
→ setIntentionTimer(app, duration)
→ dispatchIntervention({ type: 'SET_INTENTION_TIMER' })
→ InterventionFlow (state: 'idle', intentionTimerSet: true, targetApp: 'com.twitter.android')
→ dispatchSystemEvent({ 
    type: 'END_SESSION', 
    shouldLaunchHome: false,
    targetApp: 'com.twitter.android'
  })
→ SystemSurfaceRoot reads shouldLaunchHome = false, targetApp = 'com.twitter.android'
→ AppMonitorModule.finishSystemSurfaceActivity()
→ AppMonitorModule.launchApp('com.twitter.android')
→ Activity finishes + Twitter/X launches
```

**Result:** ✅ User continues using monitored app

### TYPE 3 — START ALTERNATIVE ACTIVITY

**Triggers:**
- User presses "Start Activity"

**Flow:**
```
InterventionFlow (state: 'action_timer')
→ dispatchSystemEvent({ 
    type: 'START_ALTERNATIVE_ACTIVITY', 
    app: 'com.twitter.android',
    shouldLaunchHome: false
  })
→ SystemSession creates ALTERNATIVE_ACTIVITY session
→ SystemSurfaceRoot renders AlternativeActivityFlow
→ Activity continues (does NOT finish)
```

**Result:** ✅ User sees alternative activity screen

## Why Session Ending is Decoupled from Navigation

**Before (Incorrect):**
```
END_SESSION → Always calls cancelInterventionActivity() → Always goes to Home
```

**After (Correct):**
```
END_SESSION 
  + shouldLaunchHome = true 
  → cancelInterventionActivity() 
  → Home

END_SESSION 
  + shouldLaunchHome = false 
  + targetApp = "com.twitter.android"
  → finishSystemSurfaceActivity()
  → launchApp("com.twitter.android")
  → Monitored app
```

**Key Insight:**
- Session lifecycle (START/END) is orthogonal to navigation
- Navigation is determined by **semantic ending reason**
- Native methods are **mechanical** (no semantics)
- JavaScript provides **semantics** (shouldLaunchHome + targetApp)

## Implementation Priority

1. **HIGH PRIORITY** - Add targetApp to END_SESSION (TYPE 2 fix)
2. **ALREADY CORRECT** - TYPE 3 (alternative activity)
3. **ALREADY CORRECT** - TYPE 1 (cancel/abort)

## Testing Validation

After implementing targetApp launch:

**Test TYPE 2:**
1. Open Twitter/X
2. Complete breathing
3. Click "I really need to use it"
4. Select "Just 1 min"
5. **Expected:** SystemSurface closes, Twitter/X launches and is visible
6. **Verify:** No home screen, no launcher

**Test TYPE 1:**
1. Open Instagram
2. Complete full intervention
3. Finish reflection
4. **Expected:** SystemSurface closes, home screen launches

**Test TYPE 3:**
1. Open TikTok
2. Complete breathing, select cause, choose alternative
3. Press "Start Activity"
4. **Expected:** Alternative activity screen shows, SystemSurface stays open
