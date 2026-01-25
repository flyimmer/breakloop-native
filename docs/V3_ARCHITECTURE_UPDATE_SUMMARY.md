# BreakLoop Architecture V3 Update Summary

**Date:** January 2026
**Status:** **AUTHORITATIVE**
**Supersedes:** Phase 2 Architecture, System Brain Authority

---

## 🚀 Executive Summary: Native Authority

The **V3 Architecture** fundamentally shifts the "Brain" of the operation from JavaScript to Native.

| Feature | Phase 2 (Old/Deprecated) | V3 (Current/Authoritative) |
| :--- | :--- | :--- |
| **Decision Maker** | System Brain JS | **Native Service** (Android/iOS) |
| **State Machine** | JS State + Native Shadow | **Native Only** (Single Source of Truth) |
| **Timers** | JS `setTimeout` (unreliable) | **Native Alarms/Handlers** |
| **SystemSurface Launch** | JS calls `launchSystemSurface` | **Native launches Activity directly** |
| **Wake Reason** | "Pre-decided" by JS | **Command** from Native (e.g. `SHOW_QUICK_TASK`) |
| **JS Role** | Authority & Decision Engine | **Semantic Renderer** (Pixels & Content) |

---

## 1. Native is the Mechanical Authority

The Native Layer (ForegroundDetectionService, SystemSurfaceManager) is now the sole owner of:
1.  **Foregroud Monitoring**: Detecting which app is open.
2.  **OS Trigger Logic**: Deciding *if* an intervention is needed.
3.  **State Machines**: Maintaining `IDLE` → `ELIGIBLE` → `QUICK_TASK` states per app.
4.  **Timers**: Managing `t_quickTask`, `t_intention` timers.
5.  **Lifecycle**: Opening and closing `SystemSurfaceActivity`.

**Why?**
JS runtimes are ephemeral and can be killed. Native Services are persistent. Moving state to Native guarantees stability and prevents "stuck" or "forgotten" timers.

---

## 2. JavaScript is the Semantic Renderer

The JavaScript layers (`SystemSurface`, `SystemBrain`) responsibility is strictly limited to:
1.  **Rendering UI**: Showing the Quick Task dialog or Intervention screens.
2.  **Semantic Content**: Deciding *which* breathing exercise to show, or *which* reflection data to load.
3.  **User Intent**: Capturing "I want to continue" and sending that intent back to Native.

**JS does NOT:**
- Decide IF a Quick Task should show.
- Enforce quotas (e.g. `n_quickTask`).
- Close the window (it requests Native to close it).

---

## 3. The New Runtime Contract

### Timeline V3
1.  **Native** detecting triggering event (App Open).
2.  **Native** evaluates rules locally (Is eligible? Is timer active?).
3.  **Native** decides: `SHOW_QUICK_TASK`.
4.  **Native** launches `SystemSurfaceActivity` with command extras.
5.  **JS** boots up, reads command, renders UI.
6.  **User** clicks "Quick Task".
7.  **JS** sends `QT_ACCEPT` intent to Native.
8.  **Native** updates state to `QUICK_TASK_ACTIVE`, starts `t_quickTask` timer, closes UI.

### Invariants
- **Non-blocking**: Native decisions happen immediately without waiting for JS boot.
- **Fail-safe**: If JS crashes, Native cleans up state.
- **Single Source**: If Logs disagree, Native Log is truth.

---

## 4. Documentation Status

| Document | Status | Notes |
| :--- | :--- | :--- |
| `CLAUDE.md` | ✅ **Updated** | Primary dev guide, aligned with V3. |
| `spec/break_loop_architecture_invariants_v_3.md` | ✅ **Authoritative** | The "Constitution" of V3. |
| `spec/break_loop_os_runtime_contract.md` | ✅ **Authoritative** | Runtime event rules. |
| `docs/SYSTEM_SURFACE_ARCHITECTURE.md` | ⚠️ **Partial** | "Decision Engine" logic deprecated. |
| `docs/PHASE2_ARCHITECTURE_UPDATE.md` | ❌ **Deprecated** | Describes obsolete JS-first logic. |
| `docs/SYSTEM_BRAIN_ARCHITECTURE.md` | ❌ **Deprecated** | Describes obsolete JS-first logic. |

---

## 5. Migration Guide for Developers

If you see code like this:
```typescript
// OLD / DEPRECATED
if (isMonitoredApp) {
  const decision = decideAction(); // JS logic
  Native.launchSystemSurface(decision);
}
```

Replace/Refactor to:
```typescript
// NEW / V3
// Native handles this automatically.
// JS only handles:
if (props.command === 'SHOW_QUICK_TASK') {
  return <QuickTaskDialog />;
}
```
