# SystemSurface Lifecycle Contract (Authoritative)

**Version:** 1.0  
**Date:** January 5, 2026  
**Status:** AUTHORITATIVE - This is the single source of truth for how SystemSurface must behave.  
**You should treat this as non-negotiable.**

---

## Purpose

SystemSurface is a modal overlay that temporarily interrupts an app.  
It must behave like a single, exclusive, disposable transaction.

---

## Core Invariants (Must Always Hold)

### 🔒 Invariant 1 — Single Active Instance

At most ONE SystemSurface instance may exist at any time.

- No overlapping overlays
- No re-entrant launches
- No stacking

---

### 🔒 Invariant 2 — Exclusive Ownership of Input

While SystemSurface is active, it owns all user input.

- Underlying app must not receive touch
- When SystemSurface finishes, input must be fully released

**If input is blocked after finish → contract violation**

---

### 🔒 Invariant 3 — Deterministic End

Every SystemSurface launch must end exactly once.

- `END_SESSION` must be:
  - idempotent
  - dispatched once
- `finish()` must be called once
- No async work may delay finish()

---

### 🔒 Invariant 4 — No Launch While Active

No code path may call `launchSystemSurface()` while another SystemSurface is active.

This includes:
- OS Trigger Brain
- Quick Task enforcement
- User interaction handling
- Foreground change handling

---

### 🔒 Invariant 5 — Launch Permission Boundary

SystemSurface may only be launched from UI-safe boundaries, never from:
- timer expiration
- background headless tasks
- async callbacks without UI event

---

## Allowed State Transitions

```
IDLE
  └─ launchSystemSurface() → ACTIVE

ACTIVE
  └─ safeEndSession() → FINISHING

FINISHING
  └─ finish() confirmed → IDLE
```

**Any other transition is a bug.**

---

## Forbidden States (Must Never Occur)

- `ACTIVE` → `launchSystemSurface()` again ❌
- `FINISHING` → `launchSystemSurface()` ❌
- `ACTIVE` without guaranteed `FINISH` ❌
- `FINISH` without `ACTIVE` ❌

---

## Required Signals (Debug Invariants)

These logs must always appear in pairs:

```
[SystemSurfaceInvariant] LAUNCH
[SystemSurfaceInvariant] FINISH
```

If you ever see:
- `LAUNCH` without `FINISH`
- `FINISH` without `LAUNCH`
- two `LAUNCH` in a row

→ **Lifecycle violation**

---

## Summary Rule (One Line)

**SystemSurface is a single-instance, exclusive, transactional overlay.**  
Any double launch or incomplete finish is a critical bug.

---

## Integration with System Surface Architecture

This contract must be satisfied by the implementation described in:
- `SYSTEM_SURFACE_ARCHITECTURE.md` - Complete System Surface architecture
- `system_surface_bootstrap.md` - Bootstrap lifecycle details

**All implementations must verify these invariants are maintained.**

---

## Verification Checklist

When reviewing code changes that affect SystemSurface lifecycle:

- [ ] Only one SystemSurface can exist at any time (Invariant 1)
- [ ] Input is exclusive while active and fully released on finish (Invariant 2)
- [ ] Every launch has exactly one finish() call (Invariant 3)
- [ ] No launch while another SystemSurface is active (Invariant 4)
- [ ] Launches only from UI-safe boundaries (Invariant 5)
- [ ] State transitions follow allowed paths only
- [ ] Debug logs appear in pairs (LAUNCH + FINISH)
- [ ] No forbidden state transitions occur

---

**END OF DOCUMENT**
