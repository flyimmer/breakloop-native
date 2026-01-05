# System Brain JS - Event-Driven Semantic Runtime

## Overview

BreakLoop uses THREE distinct JavaScript runtimes, each with specific responsibilities:

1. **System Brain JS** - Event-driven, headless, semantic logic
2. **SystemSurface JS** - Ephemeral, UI-only, intervention screens
3. **MainApp JS** - User-initiated, settings and community

## System Brain JS

### Definition

System Brain JS is an **event-driven, headless JavaScript runtime** that runs as a React Native Headless JS task.

### Lifecycle (CRITICAL)

System Brain JS is **event-driven**, NOT continuously running:

- Invoked by native when mechanical events occur
- Recomputes state deterministically on each invocation
- Does NOT rely on continuous execution
- Does NOT maintain in-memory state between invocations
- Must load/save state from persistent storage on each event

**Correct Understanding:**
- Native emits event → System Brain wakes up
- System Brain loads state from storage
- System Brain processes event and decides action
- System Brain saves state to storage
- System Brain completes (may go dormant)

**Incorrect Understanding:**
- ❌ "System Brain runs continuously in the background"
- ❌ "System Brain has a persistent event loop"
- ❌ "System Brain maintains state in memory"

### Responsibilities

- Receive MECHANICAL events from native (timer expired, foreground changed)
- Classify semantic meaning (Quick Task vs Intention vs other)
- Evaluate OS Trigger Brain logic
- Decide when to launch SystemSurface
- Maintain semantic state (t_quickTask, t_intention)
- Persist/restore state on each invocation

### Forbidden

- UI rendering
- React components
- Depending on SystemSurface or MainApp contexts
- Assuming continuous execution
- Maintaining state in memory between events

## Native Layer

### Definition

Native layer handles OS integration and emits MECHANICAL events only.

### Responsibilities

- Detect foreground app changes
- Detect timer expirations
- Emit mechanical events: "timer expired for app X", "foreground is app X"
- Launch SystemSurfaceActivity when requested by System Brain

### Forbidden

- Semantic classification (Quick Task vs Intention)
- Deciding whether to intervene
- Labeling events with semantic meaning

## SystemSurface JS

### Definition

Ephemeral JavaScript runtime for intervention UI.

### Responsibilities

- Render intervention screens
- Render Quick Task dialog
- Handle user interactions
- Report decisions to System Brain

### Forbidden

- Semantic timer logic
- Deciding whether to intervene
- Maintaining persistent state
- Using setTimeout for semantic timers

## MainApp JS

### Definition

User-initiated JavaScript runtime for app features.

### Responsibilities

- Settings UI
- Community features
- Statistics display

### Forbidden

- System-level intervention logic
- Timer expiration handling
- Foreground app monitoring

## Communication Flow

```
Native (ForegroundDetectionService)
  ↓ (emit MECHANICAL event: "timer expired for app X")
System Brain JS (event-driven headless)
  ↓ (load state, classify as Quick Task, decide to intervene)
Native (launch SystemSurfaceActivity)
  ↓ (render UI with wake reason)
SystemSurface JS (ephemeral)
  ↓ (user decision)
System Brain JS (update state, save)
```

## Core Rules (LOCKED)

### Rule 1: Native Decides WHEN, JS Decides WHY

**Native (MECHANICAL):**
- Emits: "timer expired for app X at timestamp Y"
- Emits: "foreground app is X"
- Does NOT classify timer type
- Does NOT decide whether to intervene

**System Brain (SEMANTIC):**
- Receives mechanical events
- Classifies: "Is this Quick Task or Intention?"
- Decides: "Should I intervene or stay silent?"
- Owns all semantic state

### Rule 2: System Brain is Event-Driven

System Brain is invoked by native events and must recompute state deterministically on each invocation.

It does NOT:
- Run continuously
- Maintain in-memory state between events
- Have a persistent event loop

### Rule 3: Single Source of Semantic Truth

All semantic logic lives in System Brain JS:
- Timer classification
- Intervention decisions
- Priority chain evaluation
- State management

## Why This Architecture?

### Problem Without System Brain

- Semantic logic in SystemSurface JS
- SystemSurface finishes → JS context destroyed
- setTimeout callbacks lost
- Timers don't fire → interventions don't trigger

### Solution With System Brain

- Semantic logic in event-driven headless runtime
- Native emits mechanical timer expiration events
- System Brain receives events (always available)
- System Brain classifies and decides
- System Brain launches UI when needed
- Timers always fire correctly

## Implementation Details

### Files Created

1. **`src/systemBrain/index.ts`** - Entry point, registers headless task
2. **`src/systemBrain/eventHandler.ts`** - Event classification and semantic decisions
3. **`src/systemBrain/stateManager.ts`** - State persistence (load/save on each event)
4. **`src/systemBrain/nativeBridge.ts`** - Native communication

### Files Modified

1. **`plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`**
   - Emits ONLY mechanical events: "TIMER_EXPIRED", "FOREGROUND_CHANGED"
   - Removed semantic labels (no "QuickTaskExpired", "IntentionExpired")
   - Uses generic "SystemEvent" headless task name

2. **`plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt`**
   - Added `launchSystemSurface()` method

3. **`src/native-modules/AppMonitorModule.ts`**
   - Added TypeScript interface for `launchSystemSurface()`

4. **`src/os/osTriggerBrain.ts`**
   - Removed setTimeout callback from `setQuickTaskTimer()`
   - Native will emit mechanical event on expiration

5. **`index.js`**
   - Registered System Brain headless task

## Verification Checklist

- [x] System Brain registered as headless task
- [x] Native emits ONLY mechanical events (no semantic labels)
- [x] System Brain classifies timer type (Quick Task vs Intention)
- [x] System Brain loads/saves state on each invocation
- [x] System Brain can launch SystemSurface
- [x] No setTimeout in SystemSurface for semantics
- [x] No semantic logic in MainApp
- [x] Architecture documented

## Testing

### Expected Behavior

1. Set `n_quickTask = 1`
2. Open Instagram → Choose Quick Task
3. Stay on Instagram
4. Wait 10 seconds
5. **Expected:** 
   - Native emits mechanical event: "TIMER_EXPIRED for com.instagram.android"
   - System Brain wakes up, loads state
   - System Brain classifies as Quick Task expiration
   - System Brain checks foreground (still Instagram)
   - System Brain launches SystemSurface
   - Intervention starts immediately

### Logs to Check

**Native (ForegroundDetectionService):**
```
⏰ Timer expired for app: com.instagram.android
└─ Removed expired timer for com.instagram.android, emitted TIMER_EXPIRED event
📤 Emitted SystemEvent: TIMER_EXPIRED for com.instagram.android
```

**System Brain JS:**
```
[System Brain] Event received: { type: "TIMER_EXPIRED", packageName: "com.instagram.android", timestamp: ... }
[System Brain] Processing event: { type: "TIMER_EXPIRED", ... }
[System Brain] Timer expired for: com.instagram.android
[System Brain] ✓ Classified as Quick Task expiration
[System Brain] Checking foreground app: { expiredApp: "com.instagram.android", currentForegroundApp: "com.instagram.android", shouldTriggerIntervention: true }
[System Brain] 🚨 User still on expired app - launching intervention
[System Brain] Requesting SystemSurface launch: { wakeReason: "QUICK_TASK_EXPIRED_FOREGROUND", triggeringApp: "com.instagram.android" }
```

**Native (AppMonitorModule):**
```
📱 System Brain requested SystemSurface launch: QUICK_TASK_EXPIRED_FOREGROUND for com.instagram.android
```

## Next Steps

After this foundation is complete, implement full Quick Task expiration flow using the System Brain architecture.
