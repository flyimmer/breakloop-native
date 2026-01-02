# Quick Task Implementation Summary

**Date:** December 30, 2024  
**Status:** ✅ Complete and Correct

## Overview

Quick Task allows premium users to bypass the full intervention process for a short duration, with a limited number of uses within a 15-minute window.

## Key Specifications

### Global vs Per-App

| Feature | Scope | Implementation |
|---------|-------|----------------|
| **Usage Quota** | GLOBAL | `quickTaskUsageHistory: number[]` |
| **Quick Task Timer** | Per-App | `quickTaskTimers: Map<string, timer>` |
| **Intention Timer** | Per-App | `intentionTimers: Map<string, timer>` |
| **Intervention State** | Per-App | `interventionsInProgress: Set<string>` |

### Settings

**Default (Free Plan):**
- Duration: 3 minutes (`t_quickTask`)
- Uses: 1 per 15-minute window (GLOBAL)

**Premium Plan:**
- Duration: Customizable (2/3/5 minutes)
- Uses: Customizable (1-2 per 15-minute window, GLOBAL)

## Architecture

### Data Flow

```
1. User opens monitored app (e.g., Instagram)
   ↓
2. ForegroundDetectionService detects launch
   ↓
3. osTriggerBrain checks:
   - Quick Task timer for Instagram? No
   - Intention timer for Instagram? No
   - App switch interval elapsed? Yes
   ↓
4. Calculate Quick Task availability (GLOBAL)
   - Filter usage history (all apps)
   - Count recent usages in 15-min window
   - remaining = maxUses - recentUsages
   ↓
5. Dispatch BEGIN_INTERVENTION
   - app: 'com.instagram.android'
   - quickTaskRemaining: 2 (global)
   ↓
6. Intervention state machine
   - quickTaskRemaining > 0 → 'quick_task_dialog'
   - quickTaskRemaining = 0 → 'breathing'
   ↓
7. QuickTaskDialogScreen shows
   - "You have 2 Quick Tasks remaining"
   - "Quick Task" button
   - "Continue intervention" button
```

### User Clicks "Quick Task"

```
1. handleQuickTask() in QuickTaskDialogScreen
   ↓
2. Set Quick Task timer (PER-APP)
   setQuickTaskTimer('com.instagram.android', 180000, now)
   - Instagram protected for 3 minutes
   ↓
3. Record usage (GLOBAL)
   recordQuickTaskUsage('com.instagram.android', now)
   - quickTaskUsageHistory.push(timestamp)
   ↓
4. Mark intervention complete (PER-APP)
   onInterventionCompleted('com.instagram.android')
   - interventionsInProgress.delete('com.instagram.android')
   ↓
5. Dispatch ACTIVATE_QUICK_TASK
   - State transitions to 'idle'
   ↓
6. App.tsx detects state → idle
   - Calls finishInterventionActivity()
   ↓
7. Native code finishes InterventionActivity
   - activity.finish()
   - Instagram returns to foreground
```

### Protection Logic

**Priority Order (Highest to Lowest):**

1. **Quick Task Timer** (Per-App, Highest Priority)
   ```typescript
   const quickTaskTimer = quickTaskTimers.get(packageName);
   if (quickTaskTimer && now < quickTaskTimer.expiresAt) {
     // Allow app usage, no intervention
     return;
   }
   ```

2. **Intention Timer** (Per-App)
   ```typescript
   const intentionTimer = intentionTimers.get(packageName);
   if (intentionTimer && now <= intentionTimer.expiresAt) {
     // Allow app usage, no intervention
     return;
   }
   ```

3. **App Switch Interval** (Per-App)
   ```typescript
   const lastExit = lastMeaningfulExitTimestamps.get(packageName);
   const timeSinceExit = now - lastExit;
   if (timeSinceExit < appSwitchIntervalMs) {
     // Allow app usage, no intervention
     return;
   }
   ```

4. **Trigger Intervention**
   ```typescript
   // Calculate Quick Task availability (GLOBAL)
   const quickTaskRemaining = getQuickTaskRemaining(packageName, now);
   
   // Dispatch intervention
   triggerIntervention(packageName, now, quickTaskRemaining);
   ```

## Global Usage Behavior

### Example Timeline

**Settings:** 2 uses per 15-minute window

```
09:00:00 - Open Instagram
           → Quick Task available (2 remaining)
           → User clicks Quick Task
           → quickTaskUsageHistory = [09:00:00]
           → Instagram protected for 3min

09:03:00 - Instagram Quick Task timer expires
           → Instagram no longer protected
           → But global quota still consumed (1 use)

09:05:00 - Open TikTok
           → Quick Task available (1 remaining)
           → User clicks Quick Task
           → quickTaskUsageHistory = [09:00:00, 09:05:00]
           → TikTok protected for 3min

09:08:00 - TikTok Quick Task timer expires
           → TikTok no longer protected
           → Global quota exhausted (0 uses)

09:10:00 - Open YouTube
           → NO Quick Task available (0 remaining)
           → Breathing screen appears
           → Must complete full intervention

09:15:01 - First usage expires (09:00:00 + 15min)
           → quickTaskUsageHistory = [09:05:00]
           → 1 use available again globally

09:16:00 - Open Facebook
           → Quick Task available (1 remaining)
           → Can use Quick Task again

09:20:01 - Second usage expires (09:05:00 + 15min)
           → quickTaskUsageHistory = []
           → Full quota restored (2 uses)
```

### Cross-App Quota Sharing

```
Scenario: User has 2 uses per 15 minutes

Instagram Quick Task → 1 use consumed globally
TikTok Quick Task    → 2 uses consumed globally
YouTube attempt      → NO Quick Task (quota exhausted)
Instagram attempt    → NO Quick Task (quota exhausted)
Facebook attempt     → NO Quick Task (quota exhausted)

Wait 15 minutes from first usage...

Instagram attempt    → Quick Task available (1 use restored)
```

## Per-App Independence

While usage quota is global, each app maintains independent state:

### 1. Quick Task Timers

```typescript
// Instagram and TikTok can both have active timers
quickTaskTimers = {
  'com.instagram.android': { expiresAt: 1735567200000 },
  'com.zhiliaoapp.musically': { expiresAt: 1735567260000 }
}

// Timers expire independently
// Instagram timer expires → Instagram intervention triggers
// TikTok timer still valid → TikTok still protected
```

### 2. Intervention State

```typescript
// Only one intervention active at a time
interventionsInProgress = Set(['com.instagram.android'])

// Switching apps abandons old intervention
// User opens TikTok during Instagram intervention
interventionsInProgress.clear()
interventionsInProgress.add('com.zhiliaoapp.musically')
```

### 3. Intention Timers

```typescript
// Each app has independent intention timer after intervention
intentionTimers = {
  'com.instagram.android': { expiresAt: 1735569000000 }, // 30min
  'com.zhiliaoapp.musically': { expiresAt: 1735569500000 } // 30min
}

// Completing intervention for Instagram doesn't affect TikTok
```

## UI Components

### QuickTaskDialogScreen

**Location:** `app/screens/conscious_process/QuickTaskDialogScreen.tsx`

**Props:**
- `quickTaskRemaining` - Number of uses remaining GLOBALLY

**Display:**
```tsx
<Text>You have {quickTaskRemaining} Quick Tasks remaining</Text>
<Button onPress={handleQuickTask}>Quick Task</Button>
<Button onPress={handleContinueIntervention}>Continue intervention</Button>
```

**Actions:**
- **Quick Task:** Sets timer, records usage, transitions to idle
- **Continue:** Proceeds to breathing screen

### BreathingScreen

**Shown when:** `quickTaskRemaining === 0`

**Flow:** Breathing → Root Cause → Alternatives → Action → Reflection

## Native Integration

### InterventionActivity Lifecycle

```
1. ForegroundDetectionService detects monitored app
   ↓
2. Launches InterventionActivity
   - Intent flag: FLAG_ACTIVITY_NEW_TASK
   - Passes triggering app package name
   ↓
3. React Native renders intervention UI
   - QuickTaskDialogScreen or BreathingScreen
   ↓
4. User completes intervention or uses Quick Task
   - State transitions to 'idle'
   ↓
5. App.tsx calls finishInterventionActivity()
   ↓
6. Native code: activity.finish()
   - Closes InterventionActivity completely
   - Monitored app returns to foreground
```

### Key Native Methods

**AppMonitorModule.kt:**
```kotlin
@ReactMethod
fun finishInterventionActivity() {
    val activity = reactApplicationContext.currentActivity
    if (activity is InterventionActivity) {
        activity.finish() // Close completely, not moveTaskToBack()
    }
}
```

## Testing

### Test 1: Global Quota Consumption
```
1. Open Instagram → Quick Task (2 remaining)
2. Click Quick Task → Success
3. Open TikTok → Quick Task (1 remaining)
4. Click Quick Task → Success
5. Open YouTube → Breathing screen (0 remaining)
✅ Expected: No Quick Task available
```

### Test 2: Timer Independence
```
1. Use Quick Task on Instagram (3min timer)
2. Immediately re-open Instagram
✅ Expected: No intervention (timer protects it)
3. Open TikTok
✅ Expected: Quick Task available (1 remaining)
4. Use Quick Task on TikTok (3min timer)
5. Wait 3 minutes
6. Open Instagram
✅ Expected: Intervention triggers (timer expired)
```

### Test 3: Quota Restoration
```
1. Use Quick Task on Instagram (09:00)
2. Use Quick Task on TikTok (09:05)
3. Open YouTube (09:10)
✅ Expected: No Quick Task (0 remaining)
4. Wait until 09:15 (first usage expires)
5. Open Facebook
✅ Expected: Quick Task available (1 remaining)
```

### Test 4: Cross-App Behavior
```
1. Use Quick Task on Instagram
2. Exit Instagram, open TikTok
✅ Expected: TikTok triggers intervention (independent)
3. TikTok Quick Task shows 1 LESS remaining
✅ Expected: Global quota consumed by Instagram
```

## Files Modified

### Core Logic
- `src/os/osTriggerBrain.ts` - Quick Task logic, global usage tracking
- `src/core/intervention/transitions.js` - State machine transitions

### UI Components
- `app/screens/conscious_process/QuickTaskDialogScreen.tsx` - Quick Task UI
- `app/App.tsx` - Navigation and intervention completion

### Native Code
- `plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt` - finishInterventionActivity()

## Documentation

- `docs/QUICK_TASK_FIX_INTERVENTION_CLOSE.md` - Fix for activity.finish()
- `docs/QUICK_TASK_GLOBAL_USAGE_FIX.md` - Global usage implementation
- `docs/QUICK_TASK_PER_APP_INDEPENDENCE.md` - Per-app vs global features
- `docs/QUICK_TASK_IMPLEMENTATION_SUMMARY.md` - This document

## Future Enhancements

### Phase 1: Settings UI
- Add Quick Task settings in Settings screen
- Allow premium users to customize duration and uses
- Persist settings in AsyncStorage

### Phase 2: Usage Analytics
- Track Quick Task usage patterns
- Show usage history in Insights
- Provide recommendations for mindful usage

### Phase 3: Smart Quota
- Adjust quota based on user behavior
- Reward consistent intervention completion
- Penalize Quick Task abuse

## Conclusion

✅ Quick Task is fully implemented with:
- **Global usage quota** across all monitored apps
- **Per-app timers** for independent protection
- **Proper activity closure** (finish, not moveTaskToBack)
- **Clean state management** (intervention state machine)
- **Comprehensive documentation** for future maintenance

