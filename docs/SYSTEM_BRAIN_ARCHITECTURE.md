# System Brain JS - Event-Driven Semantic Runtime (DEPRECATED)

> ⚠️ **DEPRECATED / HISTORICAL ONLY**
>
> This document describes V2 architecture where System Brain JS was the "Semantic Authority".
> **V3 Architecture** superseded this by moving **Native** to be the Mechanical Authority AND Decision Maker.
>
> **In V3:**
> - System Brain JS **DOES NOT** decide Quick Task vs Intervention.
> - System Brain JS **DOES NOT** manage timers.
> - System Brain JS **DOES NOT** enforce suppression.
>
> **Reference:** `docs/V3_ARCHITECTURE_UPDATE_SUMMARY.md`

**Status:** ❌ HISTORICAL (Superseded by V3)

## Overview

> **Note:** The "Semantic Authority" role described below is obsolete. Native is the Authority.

BreakLoop uses THREE distinct JavaScript runtimes, each with specific responsibilities:

1. **System Brain JS** - Event-driven, headless, semantic logic
2. **SystemSurface JS** - Ephemeral, UI-only, intervention screens
3. **MainApp JS** - User-initiated, settings and community

## System Brain JS

### Definition

System Brain JS is an **event-driven, headless JavaScript runtime** that serves as the **Semantic Interpretation Layer**.

### Lifecycle (CRITICAL)

System Brain JS is **event-driven**, NOT continuously running:

- Invoked by native when **mechanical commands** or events occur
- Recomputes state deterministically on each invocation
- Does NOT rely on continuous execution
- Does NOT maintain in-memory state between invocations
- Must load/save state from persistent storage on each event

### Relationship with Native (V2 Architecture)

**Native is the Mechanical Authority.**
- Native owns the **State Machine** (IDLE → DECISION → ACTIVE).
- Native owns **Timers** (`t_quickTask`, `t_intention`).
- Native decides **Entry Logic** (Commanding `SHOW_QUICK_TASK` vs `SHOW_INTERVENTION`).

**System Brain is the Semantic & UI Authority.**
- Receives **Commands** from Native (e.g., `SHOW_QUICK_TASK_DIALOG`).
- Decides **Intervention Content** (which breathing exercise? which reflection?).
- Decides **UI Gating** (is another surface active? should we queue this?).
- Manages **SystemSurface Lifecycle**.

### Responsibilities

- **Receive Native Commands**: Handle `SHOW_QUICK_TASK_DIALOG`, `SHOW_POST_QUICK_TASK_CHOICE`.
- **Intervention Logic**: If Native says `SHOW_INTERVENTION`, System Brain decides *which* intervention flow to run.
- **UI Gating**: Ensure only one SystemSurface session exists at a time.
- **Persist Semantic Data**: Store user preferences or intervention progress (not mechanical state).
- **Launch SystemSurface**: Call `launchSystemSurface` with the appropriate session type.

### Forbidden

- **Timers**: System Brain must NEVER run timers or infer expiration.
- **State Machine**: System Brain must NEVER clear or change Quick Task state (Native does that).
- **Quota**: System Brain must NEVER check `n_quickTask` to decide eligibility (Native does that).

## Communication Flow (Phase 2 - Explicit Pre-Decision)

```
Native (ForegroundDetectionService)
  ↓ (emit MECHANICAL event: "FOREGROUND_CHANGED", app X, timestamp)
System Brain JS (event-driven headless)
  ↓ (load state, evaluate OS Trigger Brain priority chain)
  ↓ (pre-decide: SHOW_QUICK_TASK or START_INTERVENTION)
  ↓ (call launchSystemSurface with EXPLICIT wake reason)
Native (AppMonitorModule.launchSystemSurface)
  ↓ (launch SystemSurfaceActivity with wake reason)
SystemSurface JS (ephemeral)
  ↓ (read wake reason, directly dispatch session - NO logic)
  ↓ (render appropriate flow based on session.kind)
  ↓ (user makes decision)
System Brain JS (receive decision, update state, save)
```

**Key Phase 2 Principle:** System Brain **pre-decides** the UI flow. SystemSurface **only renders** based on explicit wake reason.

## Phase 2: Explicit Wake Reasons (Current Architecture)

### Overview

Phase 2 eliminates ambiguity by having System Brain **pre-decide** the UI flow before launching SystemSurface.

**Before Phase 2 (Transitional):**
- Native launched SystemSurface with ambiguous wake reason (`MONITORED_APP_FOREGROUND`)
- SystemSurface called `evaluateTriggerLogic()` to decide Quick Task vs Intervention
- Wake reason didn't fully represent System Brain's decision

**After Phase 2 (Current):**
- System Brain evaluates OS Trigger Brain priority chain
- System Brain pre-decides: Quick Task OR Intervention
- System Brain launches SystemSurface with **explicit wake reason**
- SystemSurface directly dispatches based on wake reason (no logic)

### Explicit Wake Reasons

**System Brain passes explicit UI decisions:**
- `SHOW_QUICK_TASK_DIALOG` - System Brain decided: Show Quick Task dialog
- `START_INTERVENTION_FLOW` - System Brain decided: Start Intervention flow
- `QUICK_TASK_EXPIRED_FOREGROUND` - Quick Task expired, show Intervention

**Key Principle:** Wake reason **IS** the decision. No re-evaluation needed.

### Benefits

- ✅ Zero ambiguity - wake reason is explicit
- ✅ SystemSurface has zero decision logic
- ✅ Clean separation: System Brain decides, SystemSurface renders
- ✅ Single evaluation of priority chain (in System Brain only)

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
