# Phase 2 Architecture Update (HISTORICAL)

> ⚠️ **DEPRECATED / HISTORICAL ONLY**
>
> This document describes "Phase 2" where System Brain JS made decisions.
> **V3 Architecture** superseded this by moving all decision authority to the **Native Layer**.
>
> **Current References:**
> - `spec/BreakLoop Architecture v3.docx`
> - `spec/break_loop_os_runtime_contract.md` (Native = Authority, JS = Renderer)

**Date:** January 6, 2026
**Status:** ❌ HISTORICAL (Superseded by V3)

---

## Overview

> **Note:** The "Pre-Decision" model described below (System Brain decides) is **obsolete**. Native now decides.

Phase 2 has been **fully implemented** in the codebase and the architecture documentation has been updated to reflect the explicit wake reason system.


## What Changed in Phase 2

### Before Phase 2 (Transitional)

**Problem:** Ambiguous wake reasons
- Native launched SystemSurface with `MONITORED_APP_FOREGROUND`
- SystemSurface called `evaluateTriggerLogic()` to decide Quick Task vs Intervention
- Wake reason didn't fully represent System Brain's decision
- Decision logic duplicated between System Brain and SystemSurface

### After Phase 2 (Current)

**Solution:** Explicit pre-decision
- System Brain evaluates OS Trigger Brain priority chain
- System Brain **pre-decides** UI flow before launching SystemSurface
- System Brain launches SystemSurface with **explicit wake reason**
- SystemSurface **directly dispatches** based on wake reason (no logic)

---

## New Wake Reasons (Phase 2)

### Explicit Wake Reasons

**System Brain passes explicit UI decisions:**

1. **`SHOW_QUICK_TASK_DIALOG`**
   - System Brain evaluated priority chain → Show Quick Task dialog
   - SystemSurface dispatches `START_QUICK_TASK` session

2. **`START_INTERVENTION_FLOW`**
   - System Brain evaluated priority chain → Start Intervention flow
   - SystemSurface dispatches `START_INTERVENTION` session

3. **`QUICK_TASK_EXPIRED_FOREGROUND`**
   - Quick Task timer expired while user still on app
   - SystemSurface shows QuickTaskExpiredScreen

4. **`DEV_DEBUG`**
   - Debug/testing wake (development only)

### Deprecated Wake Reasons (Phase 1)

- ~~`MONITORED_APP_FOREGROUND`~~ - Ambiguous, replaced by explicit wake reasons
- ~~`INTENTION_EXPIRED_FOREGROUND`~~ - Now handled by System Brain event classification

---

## Architecture Flow (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│ Native (ForegroundDetectionService)                         │
│ - Detects foreground app change                             │
│ - Emits MECHANICAL event: "FOREGROUND_CHANGED"              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ System Brain JS (Event-Driven Headless)                     │
│ - Loads semantic state from storage                         │
│ - Classifies: Is this a monitored app?                      │
│ - Evaluates OS Trigger Brain priority chain:                │
│   1. Check t_intention (per-app) → Suppress?                │
│   2. Check t_quickTask (per-app) → Suppress?                │
│   3. Check n_quickTask (global) → Show Quick Task?          │
│   4. Else → Start Intervention                              │
│ - PRE-DECIDES: SHOW_QUICK_TASK or START_INTERVENTION        │
│ - Calls launchSystemSurface(app, wakeReason)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Native (AppMonitorModule.launchSystemSurface)               │
│ - Launches SystemSurfaceActivity                            │
│ - Passes explicit wake reason via Intent extras             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ SystemSurface JS (Ephemeral UI Runtime)                     │
│ - Reads wake reason from Intent extras                      │
│ - NO evaluateTriggerLogic() call                            │
│ - NO priority chain re-evaluation                           │
│ - Directly dispatches session:                              │
│   • SHOW_QUICK_TASK_DIALOG → START_QUICK_TASK               │
│   • START_INTERVENTION_FLOW → START_INTERVENTION            │
│ - Renders appropriate flow (QuickTaskFlow / InterventionFlow)│
└─────────────────────────────────────────────────────────────┘
```

---

## Key Principles (Phase 2)

### 1. System Brain Pre-Decides

System Brain evaluates the **full OS Trigger Brain priority chain** and makes the UI decision **before** launching SystemSurface.

**System Brain owns:**
- Priority chain evaluation
- Semantic classification
- UI flow decision

### 2. Explicit Wake Reasons

Wake reasons are **explicit and unambiguous**. The wake reason **IS** the decision.

**No ambiguity:**
- `SHOW_QUICK_TASK_DIALOG` → Always shows Quick Task dialog
- `START_INTERVENTION_FLOW` → Always starts Intervention flow

### 3. SystemSurface Renders Only

SystemSurface has **zero decision logic**. It reads the wake reason and directly dispatches the corresponding session.

**SystemSurface does NOT:**
- Call `evaluateTriggerLogic()`
- Re-evaluate priority chain
- Make semantic decisions

### 4. Single Evaluation

The OS Trigger Brain priority chain is evaluated **exactly once** per event, in System Brain JS only.

**No duplication:**
- ✅ System Brain evaluates priority chain
- ❌ SystemSurface does NOT re-evaluate

---

## Benefits of Phase 2

### Before Phase 2

- ⚠️ `MONITORED_APP_FOREGROUND` was ambiguous
- ⚠️ SystemSurface called `evaluateTriggerLogic()` (suppression check)
- ⚠️ Wake reason didn't fully represent System Brain's decision
- ⚠️ Decision logic duplicated between contexts

### After Phase 2

- ✅ Wake reasons are explicit and unambiguous
- ✅ SystemSurface has zero decision logic
- ✅ Wake reason IS the decision (declarative)
- ✅ Clean separation: System Brain decides, SystemSurface renders
- ✅ Single evaluation of priority chain

---

## Documentation Updated

The following architecture documents have been updated to reflect Phase 2:

### Core Architecture Documents

1. **`docs/SYSTEM_BRAIN_ARCHITECTURE.md`**
   - Added Phase 2 section explaining explicit wake reasons
   - Updated communication flow diagram
   - Updated responsibilities to include pre-decision logic

2. **`docs/SYSTEM_SURFACE_ARCHITECTURE.md`**
   - Updated wake reason contract with Phase 2 explicit wake reasons
   - Marked Phase 1 wake reasons as deprecated
   - Updated System Brain and SystemSurface requirements

3. **`docs/NATIVE_JAVASCRIPT_BOUNDARY.md`**
   - Updated wake reason contract with explicit wake reasons
   - Added System Brain pre-decision requirements
   - Updated SystemSurface requirements (no re-evaluation)

4. **`CLAUDE.md`**
   - Updated wake reason contract section
   - Updated System Brain responsibilities
   - Updated SystemSurface MUST/MUST NOT rules
   - Updated native module function descriptions

### Implementation Files (Already Complete)

- ✅ `src/systemBrain/eventHandler.ts` - OS Trigger Brain evaluation
- ✅ `src/systemBrain/nativeBridge.ts` - `launchSystemSurface()` with explicit wake reason
- ✅ `plugins/src/android/java/.../AppMonitorModule.kt` - New wake reason constants
- ✅ `plugins/src/android/java/.../SystemSurfaceActivity.kt` - Wake reason constants
- ✅ `app/roots/SystemSurfaceRoot.tsx` - Direct dispatch based on wake reason

---

## Verification Checklist

When reviewing code changes, verify Phase 2 compliance:

### System Brain JS

- [ ] Evaluates OS Trigger Brain priority chain
- [ ] Pre-decides UI flow (Quick Task OR Intervention)
- [ ] Launches SystemSurface with explicit wake reason
- [ ] Never passes ambiguous wake reasons

### SystemSurface JS

- [ ] Reads explicit wake reason from Intent extras
- [ ] Directly dispatches session based on wake reason
- [ ] Does NOT call `evaluateTriggerLogic()`
- [ ] Does NOT re-evaluate priority chain
- [ ] Does NOT make semantic decisions

### Native (Kotlin)

- [ ] Defines Phase 2 wake reason constants
- [ ] Accepts wake reason parameter in `launchSystemSurface()`
- [ ] Passes wake reason via Intent extras
- [ ] Does NOT make semantic decisions

---

## Migration Status

**Phase 2 is COMPLETE:**

- ✅ Implementation finished
- ✅ All code updated to use explicit wake reasons
- ✅ Documentation updated to reflect Phase 2 architecture
- ✅ Old wake reasons deprecated but still handled for compatibility

**Backward Compatibility:**

SystemSurfaceRoot still handles `MONITORED_APP_FOREGROUND` with a warning log, but this is deprecated and should not be used in new code.

---

## Related Documents

- `phase_2_-_explicit_wake_reasons_8bb8da75.plan.md` - Original Phase 2 plan
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain architecture (updated)
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture (updated)
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Boundary contract (updated)
- `CLAUDE.md` - Main project documentation (updated)

---

## Summary

Phase 2 successfully eliminates ambiguity in the wake reason system by having System Brain **pre-decide** the UI flow before launching SystemSurface. This creates a clean architectural separation where System Brain owns all semantic decisions and SystemSurface is purely a rendering layer.

**Key Achievement:** Wake reason **IS** the decision. No re-evaluation needed.
