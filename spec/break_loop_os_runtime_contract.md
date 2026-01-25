# BreakLoop OS Runtime Contract

> **Status:** Reference / Bridge Document
>
> **Audience:** Future engineers, AI agents, and maintainers
>
> **Purpose:** Explain *how the OS-facing runtime actually works* in practice, bridging the gap between **Intervention OS Contract** (behavioral law) and **Architecture / Native code** (mechanics).

---

## 1. Why This Document Exists

BreakLoop has three layers that are intentionally separated:

1. **Intervention OS Contract** – defines *what must happen* (behavioral rules)
2. **Architecture & Invariants** – defines *who is allowed to decide*
3. **OS Runtime (this document)** – explains *how events flow at runtime*

This document exists because many bugs historically came from **misunderstanding runtime interactions**, not from broken rules.

---

## 2. Runtime Contexts

BreakLoop runs **multiple React Native runtimes** and **long-lived native services** simultaneously.

### 2.1 MAIN_APP Runtime

Purpose:
- User settings
- Configuration
- Persistence
- Starting OS monitoring

Characteristics:
- Visible UI
- Long-lived
- Safe place to start OS monitoring

Key rule:
- **Only MAIN_APP is allowed to start foreground monitoring**

---

### 2.2 SYSTEM_SURFACE Runtime

Purpose:
- Render Quick Task dialog
- Render Post-Quick-Task choice
- Render Intervention UI

Characteristics:
- Ephemeral
- May be killed/recreated frequently
- Must never own behavioral state

Key rule:
- SYSTEM_SURFACE is a *pure rendering runtime*
- It must never start OS monitoring

---

### 2.3 Native Service Runtime

Components:
- Accessibility-based foreground detection
- Timers
- Per-app state machines

Characteristics:
- Always authoritative
- Survives UI lifecycle

---

## 3. Foreground Monitoring

### 3.1 What Monitoring Does

Foreground monitoring:
- Observes OS accessibility events
- Detects **foreground app changes**
- Emits *raw foreground transitions* into Native logic

Monitoring does **not**:
- Decide Quick Task vs Intervention
- Enforce suppression rules
- Track timers

---

### 3.2 When Monitoring Starts

Monitoring starts when:
- MAIN_APP runtime is active
- User has granted accessibility permission
- Monitored apps are loaded

Monitoring must **not** start in SYSTEM_SURFACE because:
- It would duplicate events
- It would cause re-entrant triggers
- It historically caused Quick Task loops

---

## 4. Native Per-App State Machine

Each monitored app has an **independent native state machine**.

### 4.1 States

- IDLE
- QUICK_TASK_ACTIVE
- POST_QUICK_TASK_CHOICE
- INTERVENTION_ACTIVE

### 4.2 Why Per-App

- Users switch apps rapidly
- Timers must not leak across apps
- Suppression is app-specific

---

## 5. Timers & Counters (Runtime View)

### 5.1 Owned by Native

Native owns:
- t_quickTask
- t_intention
- n_quickTasks
- suppression windows

JS:
- May display values
- Must never infer expiration

---

## 6. Suppression Windows

### 6.1 Why Suppression Exists

OS foreground events are noisy:
- App switch animations
- Home screen flickers
- Activity transitions

Suppression prevents:
- Immediate re-trigger after Quit
- Accidental loops

### 6.2 Stability-Based Re-entry

After Quit:
- App is suppressed briefly
- Re-entry must be *stable* to count

This allows:
- User to intentionally return
- Flicker to be ignored

---

## 7. SystemSurface Lifecycle

### 7.1 Why Finishing Is Native-Driven

JS can:
- Crash
- Stall
- Miss events

Native:
- Must guarantee UI closes

Therefore:
- Native can force-finish SystemSurface
- JS receives semantic notification only

---

## 8. Common Failure Modes (Historical)

- Double monitoring (MAIN_APP + SYSTEM_SURFACE)
- JS timers racing Native timers
- Orphaned UI surfaces
- Flicker-triggered re-entry

All fixes in current architecture directly address these.

---

## 9. Relationship to Other Docs

| Document | Role |
|-------|------|
| Intervention OS Contract | Behavioral law |
| Architecture Invariants | Authority & constraints |
| **OS Runtime Contract** | Runtime explanation |

---

## 10. Design Principle

> **If behavior feels unstable, inspect runtime flows before changing rules.**

Most BreakLoop bugs are *coordination bugs*, not logic bugs.

---

## 11. Runtime Event Timeline (One-Page Reference)

This section provides a **linear, end-to-end view** of what happens at runtime, from an OS foreground change to UI teardown. It is intended as a quick mental model and debugging aid.

---

### 11.1 Foreground Detection → Decision

1. **OS Event Fired**
   - Android AccessibilityService emits raw events (e.g. `TYPE_WINDOW_STATE_CHANGED`).
   - These events are noisy and may include flickers, animations, and transient states.

2. **Native ForegroundDetectionService Receives Event**
   - Updates `currentForegroundApp`.
   - Tracks `lastForegroundChangeTime` to measure stability.

3. **Stability Gate**
   - If the app has not remained foreground long enough, the event is ignored.
   - This prevents animation flicker from triggering logic.

4. **Per-App State Lookup**
   - Native retrieves the state machine for the foreground app:
     - IDLE
     - QUICK_TASK_ACTIVE
     - POST_QUICK_TASK_CHOICE
     - INTERVENTION_ACTIVE

5. **Suppression Check**
   - If the app is within a quit-suppression window, entry is temporarily ignored.
   - A deferred re-check may be scheduled.

6. **Decision Evaluation (Native)**
   - If `INTERVENTION_ACTIVE` → no action
   - Else if `t_intention < threshold` → start intervention
   - Else if `n_quickTasks > 0` → start Quick Task
   - Else → no action

> At this point, **only Native decides** what should happen next.

---

### 11.2 Decision → SystemSurface

7. **Native Emits Command**
   - Native emits a semantic command (e.g. `SHOW_QUICK_TASK_DIALOG`, `POST_QUICK_TASK_CHOICE`).
   - This command is informational; Native has already committed to the decision.

8. **SystemSurfaceActivity Launched (if needed)**
   - Activity is launched with a wake reason and triggering app.
   - `SystemSurfaceManager` registers a weak reference to the activity.

9. **SYSTEM_SURFACE React Runtime Boots**
   - JS renders UI based on wake reason.
   - SYSTEM_SURFACE may subscribe to foreground changes *for UI context only*.
   - SYSTEM_SURFACE must not start monitoring or timers.

---

### 11.3 User Interaction → Native Transition

10. **User Action Occurs**
   - Examples:
     - Accept Quick Task
     - Quit app
     - Start Conscious Process

11. **JS Sends Intent to Native**
   - JS emits a single, explicit intent (e.g. `ACCEPT`, `POST_QUIT`, `SWITCH_TO_INTERVENTION`).
   - JS does not perform state transitions itself.

12. **Native Updates State Machine**
   - State transitions occur atomically in Native.
   - Timers (`t_quickTask`, `t_intention`) are started, cleared, or updated.

---

### 11.4 Finish → Cleanup

13. **Native Decides Whether to Finish UI**
   - Some transitions require closing the surface (e.g. Quit).
   - Others do not (e.g. Switch to Intervention).

14. **Native Forces Finish (if required)**
   - `SystemSurfaceManager.finish()` is called on the main thread.
   - JS notification is secondary and best-effort.

15. **SystemSurfaceActivity Destroyed**
   - Weak reference is cleared.
   - Native lifecycle flags are reset.
   - Watchdog ensures no orphaned surface remains.

---

### 11.5 Post-Conditions

16. **MAIN_APP Monitoring Continues**
   - Foreground monitoring remains active only in MAIN_APP.
   - SYSTEM_SURFACE runtime may be killed at any time without semantic impact.

17. **System Is Stable Again**
   - No UI is present unless explicitly required.
   - Native state machine is the single source of truth.

---

> **Key Insight:**
> 
> UI is ephemeral. Decisions are permanent. Native state always wins.

---

**End of BreakLoop OS Runtime Contract**

