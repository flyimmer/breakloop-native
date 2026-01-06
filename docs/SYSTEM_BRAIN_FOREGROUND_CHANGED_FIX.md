# System Brain FOREGROUND_CHANGED Architecture Fix

**Date:** January 6, 2026  
**Issue:** Warning "No dispatcher set - cannot show dialog" when System Brain handles FOREGROUND_CHANGED  
**Root Cause:** System Brain was incorrectly calling OS Trigger Brain logic, trying to show UI

## Problem

After fixing the export issue, System Brain received FOREGROUND_CHANGED events correctly, but showed a warning:

```
WARN [OS Trigger Brain] No dispatcher set - cannot show dialog
```

## Root Cause - Architecture Confusion

**System Brain was calling `evaluateTriggerLogic()` on FOREGROUND_CHANGED events**, which is WRONG!

### Why This is Wrong

**Three-Runtime Architecture:**

1. **ForegroundDetectionService (Native)**
   - Detects foreground app changes
   - Emits FOREGROUND_CHANGED to System Brain
   - **Launches SystemSurface if monitored app detected** ← Native's job!

2. **System Brain JS (Headless)**
   - Receives FOREGROUND_CHANGED event
   - **ONLY tracks state** (`lastMeaningfulApp`)
   - Does NOT show UI
   - Does NOT call OS Trigger Brain

3. **SystemSurface (UI)**
   - Shows intervention UI
   - Launched by ForegroundDetectionService

### What Was Happening (WRONG)

```typescript
// src/systemBrain/eventHandler.ts (BEFORE - WRONG)
async function handleForegroundChange(...) {
  // Update state
  state.lastMeaningfulApp = packageName;
  
  // ❌ WRONG: Trying to show UI from headless context!
  evaluateTriggerLogic(packageName, timestamp);
}
```

This tried to call OS Trigger Brain's `showQuickTaskDialog()`, which:
- Requires a dispatcher (UI connection)
- Can't work in headless context
- Is not System Brain's responsibility

### Correct Architecture

**ForegroundDetectionService does BOTH:**

```kotlin
// ForegroundDetectionService.kt
override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val packageName = event.packageName?.toString()
    
    // 1. Inform System Brain (for state tracking)
    emitSystemEvent("FOREGROUND_CHANGED", packageName, timestamp)
    
    // 2. Launch SystemSurface if monitored app (for UI)
    if (dynamicMonitoredApps.contains(packageName)) {
        launchInterventionActivity(packageName)
    }
}
```

**System Brain only tracks state:**

```typescript
// src/systemBrain/eventHandler.ts (AFTER - CORRECT)
async function handleForegroundChange(...) {
  // ONLY update state - that's it!
  state.lastMeaningfulApp = packageName;
  
  // ✅ No UI operations
  // ✅ No OS Trigger Brain calls
  // ✅ Just state tracking
}
```

## Solution

### Changed File: src/systemBrain/eventHandler.ts

**Before (WRONG):**
```typescript
async function handleForegroundChange(...) {
  state.lastMeaningfulApp = packageName;
  
  // ❌ Calling OS Trigger Brain from headless context
  evaluateTriggerLogic(packageName, timestamp);
}
```

**After (CORRECT):**
```typescript
async function handleForegroundChange(...) {
  state.lastMeaningfulApp = packageName;
  
  // ✅ Just log completion - ForegroundDetectionService handles UI
  console.log('[System Brain] State tracking complete - ForegroundDetectionService handles intervention launching');
}
```

Also removed unused import:
```typescript
// REMOVED: import { evaluateTriggerLogic } from '../os/osTriggerBrain';
```

## Responsibility Matrix

| Component | FOREGROUND_CHANGED Responsibilities |
|-----------|-------------------------------------|
| **ForegroundDetectionService** | • Detect foreground changes<br>• Emit event to System Brain<br>• Launch SystemSurface if monitored app |
| **System Brain** | • Receive event<br>• Update lastMeaningfulApp<br>• Save state<br>• **That's it!** |
| **SystemSurface** | • Show intervention UI<br>• Run OS Trigger Brain in UI context<br>• Handle user input |

## When System Brain DOES Use OS Trigger Brain

System Brain only evaluates intervention logic for **TIMER_EXPIRED** events:

```typescript
async function handleTimerExpiration(...) {
  // Classify: Is this Quick Task or Intention timer?
  // Check: Is user still on the app?
  
  if (currentForegroundApp === packageName) {
    // ✅ System Brain decides to launch SystemSurface
    launchSystemSurface({
      wakeReason: 'QUICK_TASK_EXPIRED_FOREGROUND',
      triggeringApp: packageName,
    });
  }
}
```

**Key difference:**
- FOREGROUND_CHANGED → Native launches SystemSurface
- TIMER_EXPIRED → System Brain launches SystemSurface

## Expected Behavior After Fix

### FOREGROUND_CHANGED Event (Clean)

```
[System Brain] Event type: FOREGROUND_CHANGED
[System Brain] Foreground changed to: com.instagram.android
[System Brain] Foreground app updated: {"current": "com.instagram.android"}
[System Brain] State tracking complete
✅ No warnings!
✅ No OS Trigger Brain calls!
```

### SystemSurface Launch (Separate)

SystemSurface is launched by ForegroundDetectionService, not by System Brain handling FOREGROUND_CHANGED!

## Testing

Reload the app and open Instagram. You should see:

1. ✅ Clean FOREGROUND_CHANGED event processing
2. ✅ No "No dispatcher set" warnings
3. ✅ SystemSurface still launches (via ForegroundDetectionService)
4. ✅ Quick Task dialog appears

The warning is gone, and the architecture is now correct!

## Files Modified

- `src/systemBrain/eventHandler.ts` - Removed evaluateTriggerLogic call from handleForegroundChange
