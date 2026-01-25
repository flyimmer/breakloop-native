# BreakLoop Architecture Invariants v3

## Purpose
This document defines **authoritative architectural invariants** for BreakLoop. These invariants exist to prevent regressions such as:
- stuck overlays
- duplicated Quick Task dialogs
- JS/native desynchronization
- recursive or unstable state transitions

Any change that violates these invariants is considered **architecturally incorrect**, even if it appears to work locally.

---

## Invariant 1 — Native Mechanical Authority

**The Native layer is the single source of truth for system-level behavior.**

- The Android Native layer (ForegroundDetectionService + SystemSurfaceManager) is **always alive**.
- Native owns:
  - Foreground app detection
  - Per-app Quick Task state machines
  - Timers, quotas, cooldowns, suppression windows
  - OS invariants ("no stuck overlay", "no duplicate monitoring")

JS **never** directly enforces timing, lifecycle, or OS safety rules.

---

## Invariant 2 — Per-App Quick Task State Machine (Native)

Each monitored app has its own **independent native state machine**.

**Canonical States (per app):**
- IDLE
- ELIGIBLE
- QUICK_TASK_SHOWN
- POST_CHOICE
- SUPPRESSED (temporary, time-bound)

Rules:
- State transitions are evaluated **only** in Native.
- JS may *suggest* intent; Native decides transitions.
- Suppression windows (e.g. after POST_QUIT) are enforced natively.

---

## Invariant 3 — SystemSurface is Ephemeral UI

SystemSurface (React Native runtime inside SystemSurfaceActivity) is **pure UI**.

- It is **not authoritative**.
- It does not own state machines.
- It does not own timers.
- It may be killed, restarted, or recreated at any time.

If SystemSurface crashes or JS freezes, **Native must still recover safely**.

---

## Invariant 4 — Native-First Finish Guarantee

SystemSurface **must always be closable by Native alone**.

Mechanism:
- SystemSurfaceManager holds a **WeakReference** to SystemSurfaceActivity.
- Any FINISH command:
  1. Emits semantic signal to JS (best-effort)
  2. Immediately calls `finish()` natively on main thread

Watchdogs:
- If finish requested but `onDestroy` not observed → force finish
- If surface open too long → force finish

JS is never trusted to close the window.

---

## Invariant 5 — Monitoring Lives Only in MAIN_APP Context

Foreground monitoring is **singleton and global**.

Rules:
- AppMonitorModule.startMonitoring() runs **only** in MAIN_APP runtime.
- SYSTEM_SURFACE runtime must **never** start monitoring.

Reason:
- Prevent duplicate foreground events
- Prevent re-trigger loops
- Prevent Quick Task reopening itself

---

## Invariant 6 — Explicit Semantic Boundary

**Native emits commands. JS emits intents.**

Native → JS (Commands):
- SHOW_QUICK_TASK_DIALOG
- SHOW_POST_QUICK_TASK_CHOICE
- SHOW_INTERVENTION
- FINISH_SYSTEM_SURFACE

JS → Native (Intents):
- QT_ACCEPT
- QT_DECLINE
- QT_POST_CONTINUE
- QT_POST_QUIT
- QT_SWITCH_TO_INTERVENTION

JS never directly changes lifecycle or OS state.

---

## Invariant 7 — Conscious Process Transition Is Non-Terminal

"Start Conscious Process" is **not a finish**.

Rules:
- Transition from QUICK_TASK → INTERVENTION:
  - Does NOT close SystemSurface
  - Does NOT emit FINISH_SYSTEM_SURFACE
- Native transitions app state to IDLE / INTERVENTION_ALLOWED

This avoids accidental surface teardown and re-entry loops.

---

## Invariant 8 — Stability Before Re-Entry

After a user explicitly quits a Quick Task:

- The app enters a **suppression window** (~1.5s).
- Re-entry is allowed **only if**:
  - App remains foreground ≥ stability threshold (e.g. 200ms)
  - User intent is stable

Purpose:
- Eliminate launcher flicker loops
- Prevent accidental re-triggering

---

## Invariant 9 — No Recursive Entry Evaluation

Native entry evaluation must be **acyclic**.

Rules:
- Deferred checks are time-based, not recursive
- Each recheck is bounded (max attempts)
- Suppression state must always self-clean

Infinite re-evaluation is a critical bug.

---

## Invariant 10 — Logs Reflect Authority

Log meaning:
- Native logs = ground truth
- JS logs = best-effort diagnostics

If Native and JS disagree, **Native wins**.

---

## Summary

BreakLoop stability depends on a strict separation:

- **Native** = mechanical truth, timers, safety
- **SystemSurface JS** = ephemeral UI
- **System Brain JS** = semantic interpretation only

Violating this separation leads to:
- stuck overlays
- duplicated dialogs
- infinite loops
- broken intervention flows

These invariants are mandatory for all future changes.