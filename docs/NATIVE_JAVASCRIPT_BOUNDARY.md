# Native–JavaScript Boundary

This document defines the architectural boundary between native (Kotlin) code and JavaScript code in BreakLoop. It serves as a verification guide to ensure proper separation of concerns.

## Core Principle (Non-Negotiable)

**Native code decides WHEN to wake the app.**  
**JavaScript decides WHAT the user sees and WHY.**

- **Native = mechanics**
- **JavaScript = semantics**

---

## Native (Kotlin) — Allowed Responsibilities

### Native Code MAY:

- Detect foreground app changes (AccessibilityService)
- Detect timer expiration using persisted timestamps
- Persist timestamps (SharedPreferences)
- Answer binary questions:
  - "Is Quick Task active?"
  - "Did a timer expire?"
- Wake the System Surface Activity
- Pass a WAKE REASON to JavaScript

### Native Code MUST NOT:

- Decide Quick Task vs Intervention
- Check `n_quickTask`
- Check `t_intention` priority
- Run OS Trigger priority chain
- Decide which screen to show
- Interpret user intent
- Navigate inside flows

---

## JavaScript — Required Responsibilities

### JavaScript MUST:

- Own the OS Trigger Brain
- Evaluate the full priority chain
- Decide:
  - Quick Task Flow
  - Intervention Flow
  - Suppression (do nothing)
- Manage `t_intention` semantics
- Manage Quick Task semantics
- Reset timers on Quick Task expiry
- Decide navigation within System Surface

### JavaScript MUST NOT:

- Assume native semantics
- Duplicate native timestamp logic
- Bypass the priority chain
- React to wake-ups without checking WAKE REASON

---

## Wake Reason Contract (Critical)

Every native launch of `SystemSurfaceActivity` MUST include a wake reason.

### Valid Wake Reasons (Phase 2 - Explicit Pre-Decision):

**System Brain passes explicit UI decisions:**
- `SHOW_QUICK_TASK_DIALOG` - System Brain evaluated priority chain → Show Quick Task dialog
- `START_INTERVENTION_FLOW` - System Brain evaluated priority chain → Start Intervention flow
- `QUICK_TASK_EXPIRED_FOREGROUND` - Quick Task timer expired, show Intervention
- `DEV_DEBUG` - Debug/testing wake

**Deprecated (Phase 1 - Transitional):**
- ~~`MONITORED_APP_FOREGROUND`~~ - Ambiguous, replaced by explicit wake reasons
- ~~`INTENTION_EXPIRED`~~ - Now handled by System Brain event classification

### System Brain Requirements:

- Receive mechanical events from native ("TIMER_EXPIRED", "FOREGROUND_CHANGED")
- **Evaluate OS Trigger Brain priority chain**
- **Pre-decide UI flow** before launching SystemSurface
- Pass **explicit wake reason** that represents the decision

### SystemSurface Requirements:

- Read wake reason on startup
- **Directly dispatch session** based on wake reason (no logic)
- **NEVER** call `evaluateTriggerLogic()` (System Brain already decided)
- **NEVER** treat `QUICK_TASK_EXPIRED_FOREGROUND` as a normal trigger

---

## Quick Task — Boundary Rules

### Native MAY:

- Persist `quickTaskActiveUntil`
- Detect quick task expiration
- Wake the System Surface on expiry

### Native MUST NOT:

- Show Quick Task dialog
- Decide if Quick Task is available
- Re-enter normal priority chain on expiry

### JavaScript MUST:

- Show Quick Task dialog when appropriate
- Show Quick Task Expired screen on expiry
- Reset `t_intention` 
- Navigate Home after expiry

---

## Intention Timer — Boundary Rules

### Native MAY:

- Persist intention expiration timestamps
- Detect expiration timing

### Native MUST:

- Trigger wake **ONLY** if the expired intention belongs to the **CURRENT foreground app**

### Native MUST NOT:

- Decide intervention flow
- Trigger intervention for background apps

### JavaScript MUST:

- Decide intervention when intention expires
- Enforce per-app isolation of `t_intention`

---

## Red Flags (Immediate Failure)

If **ANY** of the following are true, **STOP and FIX**:

- ❌ Kotlin code checks `n_quickTask`
- ❌ Kotlin code chooses Quick Task vs Intervention
- ❌ Kotlin code decides navigation or screens
- ❌ JavaScript skips priority chain based on native assumptions
- ❌ `QUICK_TASK_EXPIRED` triggers Quick Task dialog again
- ❌ Main app UI appears in System Surface
- ❌ Native logic duplicates JS logic

---

## Final Check

Answer **YES** or **NO**:

- [ ] Is native logic purely mechanical?
- [ ] Is JavaScript the single semantic authority?
- [ ] Is every wake-up contextualized by a wake reason?
- [ ] Are Quick Task and Intervention still separate flows?

**If any answer is NO → architecture drift detected.**

---

## Verification Checklist

When reviewing code changes, verify:

1. **Native Code Review:**
   - [ ] Only detects events and persists timestamps
   - [ ] Never makes semantic decisions
   - [ ] Always passes wake reason to JavaScript
   - [ ] Never checks Quick Task availability or counts

2. **JavaScript Code Review:**
   - [ ] Always reads wake reason on startup
   - [ ] Runs full priority chain evaluation
   - [ ] Makes all flow decisions (Quick Task vs Intervention)
   - [ ] Handles `QUICK_TASK_EXPIRED` as special case
   - [ ] Never duplicates native timestamp logic

3. **Integration Points:**
   - [ ] Wake reason is always provided
   - [ ] Wake reason is always consumed
   - [ ] No semantic logic in native layer
   - [ ] No mechanical logic in JavaScript layer

---
