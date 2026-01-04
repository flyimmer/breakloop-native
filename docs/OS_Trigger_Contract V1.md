# OS Trigger Contract V1

**Status:** ✅ DEFINITION  
**Version:** V1 (without `t_appSwitchInterval`)

---

## Overview

This document defines the OS Trigger Contract V1 for the BreakLoop intervention system. The contract specifies when interventions should fire, when they must NOT fire, and how timers interact to control intervention behavior.

---

## Monitored Apps Definition

**What counts as a "monitored app":**
- Apps and Websites listed under Settings → "Monitored apps"
- Both applications and websites are monitored and will trigger the conscious process intervention
- Each monitored app/website is treated as an individual entity

---

## Timer/Parameter Scope

Each individual monitored app shall have its own timers/parameters below, **except** `n_quickTasks` which is global:

| Timer/Parameter | Scope | Notes |
|----------------|-------|-------|
| `t_intention` | Per-app | Each monitored app has its own intention timer |
| `t_quickTask` | Per-app | Each monitored app has its own Quick Task active timer |
| `n_quickTask` | **GLOBAL** | Usage count is shared - using Quick Task on Instagram consumes quota for TikTok too |

---

## Intervention Trigger Rules

### When Intervention Should Fire

**Core Principle:** Every app shall be treated as individual.

**Evaluation Rule:**
- Every time a monitored app enters foreground, the OS trigger logic must evaluate whether an intervention should start.

### When Intervention Must NOT Fire

When the intervention for a monitored app has already been started, the system must monitor:

**Suppression Conditions:**
- If the intention timer (`t_intention`) is chosen and `t_intention` is not over, **OR**
- If the "alternative activity" is started (not to implement it at this moment),  
- **Then:** the intervention shall NOT be started.

**Else:** the intervention shall be started from the beginning again.

### Intention Timer (`t_intention`) Behavior

**Definition:** The timer set by the user for this monitored app during the intervention flow indicating how long the user wants to use this app.

**Rules:**
- When `t_intention` is over and the user is still using this monitored app, the intervention should start again.
- Every time the intervention flow starts or restarts, the `t_intention` for this app shall be deleted.

---

## Incomplete Intervention Cancellation

When user switches away from a monitored app, cancel intervention ONLY if it's incomplete.

### Incomplete States (Cancel Intervention)

These states indicate the user hasn't completed the intervention flow:
- **`breathing`** - User hasn't finished breathing
- **`root-cause`** - User hasn't selected causes
- **`alternatives`** - User hasn't chosen alternative
- **`action`** - User hasn't started activity
- **`reflection`** - User hasn't finished reflection

**Behavior:** Cancel intervention when user switches away in these states.

### Complete/Preserved States (Do NOT Cancel)

These states indicate the user has made meaningful progress:
- **`action_timer`** - User is doing alternative activity → preserve
- **`timer`** - User set `t_intention` → this transitions to idle AND launches the app, so user can use it normally → preserve
- **`idle`** - No intervention → nothing to cancel

**Key Insight:** When user sets `t_intention`, the intervention completes and transitions to `idle`, then the app launches normally. The `t_intention` timer is now active and will suppress future interventions until it expires.

---

## Quick Task System

### Definitions

- **`t_quickTask`**: Duration of the emergency allowance
- **`n_quickTask`**: Number of Quick Tasks allowed within the rolling window (e.g., 15 minutes)

### Rules

1. **Quick Task temporarily suppresses all intervention triggers.**
2. **During `t_quickTask`:**
   - User may freely switch apps and return to monitored apps
   - No intervention process shall start
3. **Quick Task does NOT create or extend `t_intention`.**
4. **When `t_quickTask` expires:**
   - `t_intention` is reset to 0
   - System shows the screen "QuickTaskExpiredScreen"
   - User will press the button and leave to the home screen of the cellphone
5. **After Quick Task expiry:**
   - The next opening of a monitored app triggers:
     - the intervention process, OR
     - the Quick Task dialog (if `n_quickTask` allows)
6. **No timer state from before the Quick Task is resumed or reused.**
7. **`n_quickTask` is counted globally across all monitored apps within the window.**

---

## Logic Between `t_intention`, `t_quickTask`, `n_quickTasks`

When a monitored app enters foreground, evaluate in this order:

### Step 1: Check `t_intention` for this opening monitored app

**If `t_intention != 0`:**
- No Quick Task dialog
- No intervention
- **SUPPRESS everything**

**If `t_intention = 0`:**
- Proceed to Step 2

### Step 2: Check `n_quickTasks` (global count)

**If `n_quickTasks != 0`:**
- Proceed to Step 3

**If `n_quickTasks = 0`:**
- No Quick Task dialog
- **START INTERVENTION**

### Step 3: Check `t_quickTask` for this app

**If `t_quickTask != 0`:**
- No Quick Task dialog
- No intervention
- **SUPPRESS (Quick Task active)**

**If `t_quickTask = 0` or has no value:**
- **SHOW QUICK TASK DIALOG**

---

## Decision Tree Summary

```
Monitored App Enters Foreground
    ↓
Check t_intention for this app
    ↓
[t_intention != 0?] ─YES→ SUPPRESS (no Quick Task, no intervention)
    ↓ NO (t_intention = 0)
Check n_quickTask (global)
    ↓
[n_quickTask != 0?]
    ↓ YES
    Check t_quickTask for this app
        ↓
    [t_quickTask != 0?] ─YES→ SUPPRESS (no Quick Task, no intervention)
        ↓ NO (t_quickTask = 0)
    SHOW QUICK TASK DIALOG
    ↓ NO (n_quickTask = 0)
START INTERVENTION FLOW
(delete t_intention for this app)
```

---

## Key Principles

1. **Per-App Isolation:** Each monitored app has its own `t_intention` and `t_quickTask` timers. Instagram's timers don't affect TikTok's behavior.

2. **Global Quick Task Quota:** `n_quickTask` is shared across all monitored apps. Using Quick Task on one app consumes the quota for all apps.

3. **Intervention Reset:** Every time intervention starts or restarts, `t_intention` for that app is deleted.

4. **Intention Timer Expiry:** When `t_intention` expires while user is still in the app, intervention starts again.

5. **Quick Task Independence:** Quick Task does NOT create or extend `t_intention`. They are separate mechanisms.

6. **Incomplete Cancellation:** Only cancel intervention when user switches away in incomplete states (breathing, root-cause, alternatives, action, reflection).

7. **Complete Preservation:** Preserve intervention state when user sets `t_intention` (transitions to idle) or starts alternative activity (action_timer state).

---

## Related Documentation

- `Trigger_logic_priority.md` - Decision tree implementation details
- `OS_TRIGGER_LOGIC_REFACTOR_SUMMARY.md` - Implementation changes
- `OS_TRIGGER_LOGIC_TEST_SCENARIOS.md` - Comprehensive test scenarios
- `NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `System_Session_Definition.md` - System session definitions
